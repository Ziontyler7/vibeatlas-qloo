import { useMemo, useState } from 'react';
import {
  CULTURAL_DOMAINS,
  GLOBAL_CULTURAL_HUBS,
  type CulturalDomain,
  type DietaryTag,
  getCulturalHubById,
  scrubTastePromptPii,
} from './lib/taste/qloo-taste-graph.ts';
import {
  type ItineraryConstraints,
  solveDayToNightItinerary,
  verifyItineraryConstraintBounds,
} from './lib/routing/day-to-night-itinerary-solver.ts';
import {
  exportConciergeMarkdown,
  exportItineraryGeoJson,
  exportItineraryIcs,
} from './lib/export/concierge-passport-exporter.ts';
import {
  type ConciergePassportAttestation,
  type QlooCuratorExecutionResult,
  createConciergePassportAttestation,
  runQlooAgenticCuratorPipeline,
  verifyConciergeAttestationIntegrity,
} from './lib/qloo/qloo-agentic-supervisor.ts';

const ALL_DIETARY_TAGS: readonly DietaryTag[] = [
  'VEGAN',
  'GLUTEN_FREE',
  'HALAL',
  'KOSHER',
  'ZERO_PROOF',
];

const DOMAIN_LABELS: Record<CulturalDomain, string> = {
  MUSIC: 'Music',
  FILM: 'Film',
  LITERATURE: 'Lit',
  ARCHITECTURE: 'Arch',
  CULINARY: 'Food',
  NIGHTLIFE_DESIGN: 'Night',
};

export default function App() {
  const [selectedHubId, setSelectedHubId] = useState<string>(GLOBAL_CULTURAL_HUBS[0].hubId);
  const currentHub = useMemo(() => getCulturalHubById(selectedHubId), [selectedHubId]);

  const [selectedSeedIds, setSelectedSeedIds] = useState<string[]>(currentHub.defaultSeedIds);
  const [maxBudgetUsd, setMaxBudgetUsd] = useState<number>(220);
  const [maxWalkPerLegKm, setMaxWalkPerLegKm] = useState<number>(3.2);
  const [requireWheelchairAccess, setRequireWheelchairAccess] = useState<boolean>(true);
  const [requiredDietaryTags, setRequiredDietaryTags] = useState<DietaryTag[]>(['ZERO_PROOF']);
  const [rawTravelerNote, setRawTravelerNote] = useState<string>(
    'Seeking analog vinyl acoustics, timber architecture, and fermented botanical dining. Contact: guest@example.com or 415-555-0199.'
  );
  const [activeExportTab, setActiveExportTab] = useState<'MARKDOWN' | 'GEOJSON' | 'ICS'>(
    'MARKDOWN'
  );
  const [attestation, setAttestation] = useState<ConciergePassportAttestation | null>(null);
  const [pipelineResult, setPipelineResult] = useState<QlooCuratorExecutionResult | null>(null);

  const activeSeeds = useMemo(() => {
    const matched = currentHub.availableSeeds.filter((s) => selectedSeedIds.includes(s.seedId));
    return matched.length > 0 ? matched : currentHub.availableSeeds.slice(0, 2);
  }, [currentHub, selectedSeedIds]);

  const constraints: ItineraryConstraints = useMemo(
    () => ({
      maxBudgetUsd,
      maxWalkPerLegKm,
      requireWheelchairAccess,
      requiredDietaryTags,
    }),
    [maxBudgetUsd, maxWalkPerLegKm, requireWheelchairAccess, requiredDietaryTags]
  );

  const solvedItinerary = useMemo(
    () => solveDayToNightItinerary(currentHub, activeSeeds, constraints),
    [currentHub, activeSeeds, constraints]
  );

  const boundsVerification = useMemo(
    () => verifyItineraryConstraintBounds(solvedItinerary),
    [solvedItinerary]
  );

  const piiScrubReport = useMemo(
    () => scrubTastePromptPii(rawTravelerNote),
    [rawTravelerNote]
  );

  const attestationValid = useMemo(() => {
    if (!attestation) return false;
    return verifyConciergeAttestationIntegrity(attestation, solvedItinerary, activeSeeds);
  }, [attestation, solvedItinerary, activeSeeds]);

  const handleSelectHub = (hubId: string) => {
    const nextHub = getCulturalHubById(hubId);
    setSelectedHubId(hubId);
    setSelectedSeedIds(nextHub.defaultSeedIds);
    setAttestation(null);
  };

  const handleToggleSeed = (seedId: string) => {
    setSelectedSeedIds((prev) => {
      if (prev.includes(seedId)) {
        return prev.length > 1 ? prev.filter((id) => id !== seedId) : prev;
      }
      return [...prev, seedId];
    });
    setAttestation(null);
  };

  const handleToggleDietary = (tag: DietaryTag) => {
    setRequiredDietaryTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setAttestation(null);
  };

  const handleRunAgenticPipeline = async () => {
    const result = await runQlooAgenticCuratorPipeline(
      currentHub,
      activeSeeds,
      constraints,
      { travelerNote: rawTravelerNote }
    );
    setPipelineResult(result);
  };

  const handleIssueConciergeSeal = () => {
    if (!boundsVerification.passed) return;
    const seal = createConciergePassportAttestation(solvedItinerary, activeSeeds);
    setAttestation(seal);
  };

  const exportPayloadText = useMemo(() => {
    if (activeExportTab === 'GEOJSON') {
      return JSON.stringify(exportItineraryGeoJson(solvedItinerary), null, 2);
    }
    if (activeExportTab === 'ICS') {
      return exportItineraryIcs(solvedItinerary);
    }
    return exportConciergeMarkdown(
      solvedItinerary,
      activeSeeds,
      attestationValid ? attestation?.fnv1aHash : undefined
    );
  }, [activeExportTab, solvedItinerary, activeSeeds, attestationValid, attestation]);

  // Compute 6-axis radar polygon coordinates
  const radarPolygonPoints = useMemo(() => {
    const cx = 135;
    const cy = 130;
    const maxR = 88;
    return CULTURAL_DOMAINS.map((domain, idx) => {
      const angle = (Math.PI * 2 * idx) / CULTURAL_DOMAINS.length - Math.PI / 2;
      const val = solvedItinerary.compositeTasteVector[domain] ?? 0.75;
      const r = maxR * val;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [solvedItinerary.compositeTasteVector]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <h1>
            <span>🧭 VibeAtlas</span>
            <span className="pill pill-teal">Qloo Taste AI Cross-Domain Curator</span>
          </h1>
          <p>
            Synthesizes Music, Film, Literature &amp; Architecture taste graphs into walkable,
            budget-verified 5-stage Day-to-Night neighborhood itineraries
          </p>
        </div>
        <div className="badge-row">
          <span className="pill pill-teal">
            Zero-PII Sanitizer: {piiScrubReport.redactedTokenCount} Redacted
          </span>
          <span
            className={`pill ${
              boundsVerification.passed ? 'pill-teal' : 'pill-rose'
            }`}
          >
            Solver: {solvedItinerary.status}
          </span>
          <span className="pill pill-amber">
            Seal: {attestationValid && attestation ? attestation.fnv1aHash : 'UNSEALED'}
          </span>
        </div>
      </header>

      <section className="hub-tabs" aria-label="Global Cultural Hubs">
        {GLOBAL_CULTURAL_HUBS.map((hub) => (
          <button
            key={hub.hubId}
            type="button"
            className={`hub-tab ${hub.hubId === currentHub.hubId ? 'active' : ''}`}
            onClick={() => handleSelectHub(hub.hubId)}
          >
            <div className="hub-tab-city">
              <span>
                {hub.city} · {hub.countryCode}
              </span>
              <span className="pill">{hub.hubId}</span>
            </div>
            <div className="hub-tab-corridor">{hub.corridorName}</div>
          </button>
        ))}
      </section>

      <div className="studio-grid">
        <aside>
          <div className="panel">
            <h2>1. Qloo Cross-Domain Seed Entities</h2>
            <div className="seed-list">
              {currentHub.availableSeeds.map((seed) => {
                const isSelected = selectedSeedIds.includes(seed.seedId);
                return (
                  <button
                    key={seed.seedId}
                    type="button"
                    className={`seed-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleSeed(seed.seedId)}
                  >
                    <div className="seed-header">
                      <span>{seed.name}</span>
                      <span className="pill">{seed.domain}</span>
                    </div>
                    <div className="seed-urn">{seed.qlooEntityUrn}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <h2>2. What-If Hard Constraint Sliders</h2>
            <div className="control-group">
              <div className="control-label">
                <span>Full-Day Per-Person Budget Ceiling</span>
                <strong>${maxBudgetUsd} USD</strong>
              </div>
              <input
                type="range"
                className="control-slider"
                min={95}
                max={320}
                step={5}
                value={maxBudgetUsd}
                onChange={(e) => {
                  setMaxBudgetUsd(Number(e.target.value));
                  setAttestation(null);
                }}
              />
            </div>

            <div className="control-group">
              <div className="control-label">
                <span>Max Pedestrian Walk Per Leg</span>
                <strong>{maxWalkPerLegKm.toFixed(1)} km</strong>
              </div>
              <input
                type="range"
                className="control-slider"
                min={0.6}
                max={4.5}
                step={0.1}
                value={maxWalkPerLegKm}
                onChange={(e) => {
                  setMaxWalkPerLegKm(Number(e.target.value));
                  setAttestation(null);
                }}
              />
            </div>

            <div className="control-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}>
                <input
                  type="checkbox"
                  checked={requireWheelchairAccess}
                  onChange={(e) => {
                    setRequireWheelchairAccess(e.target.checked);
                    setAttestation(null);
                  }}
                />
                Enforce Step-Free Wheelchair Access (All 5 Stops)
              </label>
            </div>

            <div className="control-group">
              <div className="control-label">
                <span>Required Dietary / Zero-Proof Filters</span>
              </div>
              <div className="dietary-chips">
                {ALL_DIETARY_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`chip-btn ${requiredDietaryTags.includes(tag) ? 'active' : ''}`}
                    onClick={() => handleToggleDietary(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <div className="control-label">
                <span>Traveler Brief (Auto-Scrubbed for Zero-PII)</span>
              </div>
              <textarea
                rows={2}
                value={rawTravelerNote}
                onChange={(e) => setRawTravelerNote(e.target.value)}
                style={{
                  width: '100%',
                  background: '#090d16',
                  color: '#f8fafc',
                  border: '1px solid rgba(148,163,184,0.25)',
                  borderRadius: 8,
                  padding: 8,
                  fontSize: '0.78rem',
                }}
              />
              <div style={{ fontSize: '0.73rem', color: '#5eead4', marginTop: 4 }}>
                Sanitized Query: {piiScrubReport.sanitizedPrompt}
              </div>
            </div>

            <div className="btn-row">
              <button
                type="button"
                className="action-btn primary"
                onClick={handleRunAgenticPipeline}
              >
                Run 4-Stage Qloo Agentic Curator
              </button>
              <button
                type="button"
                className="action-btn"
                disabled={!boundsVerification.passed}
                onClick={handleIssueConciergeSeal}
              >
                Seal Concierge Passport (FNV-1a)
              </button>
            </div>
          </div>
        </aside>

        <main>
          <div className="kpi-strip">
            <div className="kpi-card">
              <div className="kpi-label">Mean Qloo Affinity</div>
              <div className="kpi-value">{solvedItinerary.meanAffinityScore}%</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Est. Day-to-Night Spend</div>
              <div className="kpi-value">
                ${solvedItinerary.totalEstimatedCostUsd} / ${maxBudgetUsd}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Geodesic Walk</div>
              <div className="kpi-value">
                {solvedItinerary.totalWalkDistanceKm.toFixed(2)} km ({solvedItinerary.totalWalkMinutes}m)
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Hard Filter Compliance</div>
              <div className="kpi-value">
                {boundsVerification.passed ? '5 / 5 PASS' : 'HOLD'}
              </div>
            </div>
          </div>

          <div className="visual-row">
            <div className="panel" style={{ marginBottom: 0 }}>
              <h2>Neighborhood Geodesic Route Canvas ({currentHub.city})</h2>
              <div className="svg-box">
                <svg viewBox="0 0 820 340" width="100%" height="260" role="img" aria-label="Neighborhood Geodesic Route Map">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path
                        d="M 40 0 L 0 0 0 40"
                        fill="none"
                        stroke="rgba(148,163,184,0.08)"
                        strokeWidth="1"
                      />
                    </pattern>
                  </defs>
                  <rect width="820" height="340" fill="url(#grid)" />

                  {solvedItinerary.routeLegs.map((leg, i) => {
                    const midX = (leg.svgPath.x1 + leg.svgPath.x2) / 2;
                    const midY = (leg.svgPath.y1 + leg.svgPath.y2) / 2 - 10;
                    return (
                      <g key={`${leg.fromStage}-${leg.toStage}`}>
                        <line
                          x1={leg.svgPath.x1}
                          y1={leg.svgPath.y1}
                          x2={leg.svgPath.x2}
                          y2={leg.svgPath.y2}
                          stroke={leg.withinWalkLimit ? '#14b8a6' : '#f43f5e'}
                          strokeWidth="3"
                          strokeDasharray={leg.withinWalkLimit ? 'none' : '6 4'}
                        />
                        <text
                          x={midX}
                          y={midY}
                          fill={leg.withinWalkLimit ? '#5eead4' : '#fda4af'}
                          fontSize="11"
                          textAnchor="middle"
                        >
                          Leg {i + 1}: {leg.distanceKm.toFixed(2)}km ({leg.estimatedWalkMinutes}m)
                        </text>
                      </g>
                    );
                  })}

                  {solvedItinerary.stops.map((stop) => {
                    const { svgX, svgY } = stop.affinityMatch.venue.coordinates;
                    return (
                      <g key={stop.stage}>
                        <circle
                          cx={svgX}
                          cy={svgY}
                          r={16}
                          fill="#1e293b"
                          stroke="#f59e0b"
                          strokeWidth="2.5"
                        />
                        <text
                          x={svgX}
                          y={svgY + 4}
                          fill="#f8fafc"
                          fontSize="11"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {stop.stopIndex}
                        </text>
                        <text
                          x={svgX}
                          y={svgY + 32}
                          fill="#e2e8f0"
                          fontSize="11"
                          textAnchor="middle"
                        >
                          {stop.stage} (${stop.affinityMatch.venue.estimatedCostUsd})
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 0 }}>
              <h2>6-Axis Qloo Cross-Domain Radar</h2>
              <div className="svg-box">
                <svg viewBox="0 0 270 260" width="100%" height="260" role="img" aria-label="6-Axis Cross-Domain Taste Radar">
                  <circle cx="135" cy="130" r="88" fill="none" stroke="rgba(148,163,184,0.18)" />
                  <circle cx="135" cy="130" r="58" fill="none" stroke="rgba(148,163,184,0.14)" />
                  <circle cx="135" cy="130" r="30" fill="none" stroke="rgba(148,163,184,0.12)" />
                  <polygon
                    points={radarPolygonPoints}
                    fill="rgba(20, 184, 166, 0.28)"
                    stroke="#14b8a6"
                    strokeWidth="2.2"
                  />
                  {CULTURAL_DOMAINS.map((domain, idx) => {
                    const angle = (Math.PI * 2 * idx) / CULTURAL_DOMAINS.length - Math.PI / 2;
                    const lx = 135 + 108 * Math.cos(angle);
                    const ly = 130 + 108 * Math.sin(angle);
                    const weightPct = Math.round(
                      (solvedItinerary.compositeTasteVector[domain] ?? 0.7) * 100
                    );
                    return (
                      <text
                        key={domain}
                        x={lx}
                        y={ly}
                        fill="#cbd5e1"
                        fontSize="10.5"
                        textAnchor="middle"
                      >
                        {DOMAIN_LABELS[domain]} {weightPct}%
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          {solvedItinerary.substitutionNotes.length > 0 && (
            <div className="panel">
              <h2>Dynamic Constraint Adaptations</h2>
              {solvedItinerary.substitutionNotes.map((note) => (
                <div key={note} style={{ fontSize: '0.84rem', color: '#fcd34d' }}>
                  • {note}
                </div>
              ))}
            </div>
          )}

          <div className="panel">
            <h2>5-Stage Day-to-Night Curated Itinerary &amp; Qloo Explainability</h2>
            <div className="stop-cards">
              {solvedItinerary.stops.map((stop) => {
                const { venue } = stop.affinityMatch;
                return (
                  <div key={stop.stage} className="stop-card">
                    <div className="stop-header">
                      <div>
                        <div className="stop-title">
                          {stop.stopIndex}. [{stop.stage} · {stop.windowLabel}] {venue.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          {venue.neighborhood} · {venue.categoryLabel} ·{' '}
                          <code>{venue.qlooPlaceUrn}</code>
                        </div>
                      </div>
                      <div className="badge-row">
                        <span className="pill pill-teal">
                          {stop.affinityMatch.compositeAffinityScore}% Qloo Match
                        </span>
                        <span className="pill pill-amber">${venue.estimatedCostUsd} USD</span>
                      </div>
                    </div>
                    <div className="stop-why">{stop.affinityMatch.whyItMatches}</div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: 8 }}>
                      <strong>Architecture &amp; Highlight:</strong> {venue.architecturalNote} —{' '}
                      <em>{venue.signatureHighlight}</em>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {pipelineResult && (
            <div className="panel">
              <h2>4-Stage Qloo Agentic Curator Trace ({pipelineResult.executionMode})</h2>
              <div style={{ fontSize: '0.83rem', color: '#94a3b8', marginBottom: 10 }}>
                {pipelineResult.executiveNarrative}
              </div>
              {pipelineResult.stageTraces.map((trace) => (
                <div
                  key={trace.stageNumber}
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid rgba(148,163,184,0.14)',
                    fontSize: '0.81rem',
                  }}
                >
                  <strong>
                    Stage {trace.stageNumber}: {trace.agentName}
                  </strong>{' '}
                  (<code>{trace.qlooEndpointOrModule}</code> · {trace.latencyMs}ms ·{' '}
                  <span>{trace.status}</span>) — {trace.summary}
                </div>
              ))}
            </div>
          )}

          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Concierge Passport Export (GeoJSON / iCal .ics / Markdown)</h2>
              <div className="badge-row">
                {(['MARKDOWN', 'GEOJSON', 'ICS'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`chip-btn ${activeExportTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveExportTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <pre className="code-preview" style={{ marginTop: 12 }}>
              {exportPayloadText}
            </pre>
          </div>
        </main>
      </div>
    </div>
  );
}
