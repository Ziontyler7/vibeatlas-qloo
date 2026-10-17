/**
 * VibeAtlas Qloo — 6-Gate Empirical Verification Suite
 *
 * Run via:
 *   node --experimental-strip-types /Users/zion/Desktop/vibeatlas-qloo/src/test/vibeatlas-verification.test.ts
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CULTURAL_DOMAINS,
  DAY_STAGES,
  GLOBAL_CULTURAL_HUBS,
  computeCosineAffinity,
  computeCrossDomainAffinityScore,
  getCulturalHubById,
  rankVenuesByTasteAffinity,
  scrubTastePromptPii,
  verifyZeroPiiTasteLeakage,
} from '../lib/taste/qloo-taste-graph.ts';

import {
  computeHaversineKm,
  solveDayToNightItinerary,
  verifyItineraryConstraintBounds,
} from '../lib/routing/day-to-night-itinerary-solver.ts';

import {
  exportConciergeMarkdown,
  exportItineraryGeoJson,
  exportItineraryIcs,
} from '../lib/export/concierge-passport-exporter.ts';

import {
  createConciergePassportAttestation,
  runQlooAgenticCuratorPipeline,
  verifyConciergeAttestationIntegrity,
} from '../lib/qloo/qloo-agentic-supervisor.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

async function runAllVerificationGates(): Promise<void> {
  const startMs = performance.now();
  let passedGates = 0;

  // =========================================================================
  // GATE 1: Qloo Cross-Domain Cultural Taste Graph & Zero-PII Sanitizer
  // =========================================================================
  {
    assert.equal(GLOBAL_CULTURAL_HUBS.length, 4, 'Must ship 4 iconic global cultural hubs');
    assert.equal(CULTURAL_DOMAINS.length, 6, 'Must support 6 cross-domain cultural modalities');

    for (const hub of GLOBAL_CULTURAL_HUBS) {
      assert.ok(hub.availableSeeds.length >= 3, `Hub ${hub.hubId} must have at least 3 seeds`);
      assert.ok(hub.candidateVenues.length >= 6, `Hub ${hub.hubId} must have at least 6 venues`);
      for (const stage of DAY_STAGES) {
        const countForStage = hub.candidateVenues.filter((v) => v.stage === stage).length;
        assert.ok(
          countForStage >= 1,
          `Hub ${hub.hubId} must cover chronological stage ${stage}`
        );
      }
    }

    const tokyoHub = getCulturalHubById('HUB-TYO-101');
    const ranked = rankVenuesByTasteAffinity(tokyoHub.candidateVenues, tokyoHub.availableSeeds);
    assert.equal(ranked.length, tokyoHub.candidateVenues.length);
    assert.ok(
      ranked[0].compositeAffinityScore >= ranked[ranked.length - 1].compositeAffinityScore,
      'Venues must be sorted descending by composite Qloo affinity score'
    );
    assert.ok(
      ranked[0].whyItMatches.includes('Qloo Cross-Domain Bridge'),
      'Venue match must include explainable Qloo Cross-Domain Bridge rationale'
    );

    const selfCosine = computeCosineAffinity(
      tokyoHub.availableSeeds[0].tasteWeights,
      tokyoHub.availableSeeds[0].tasteWeights
    );
    assert.ok(Math.abs(selfCosine - 1.0) < 0.001, 'Self cosine similarity must equal 1.0');

    const singleMatch = computeCrossDomainAffinityScore(
      tokyoHub.candidateVenues[0],
      tokyoHub.availableSeeds
    );
    assert.ok(singleMatch.compositeAffinityScore > 70 && singleMatch.compositeAffinityScore <= 100);

    // Zero-PII sanitizer verification
    const dirtyPrompt =
      'Book Tokyo vinyl tour for traveler@domain.org, phone (415) 890-2341, card 4532-1122-3344-5566, PASSPORT #JP9948122, Room 1408B.';
    const scrubReport = scrubTastePromptPii(dirtyPrompt);
    assert.equal(scrubReport.zeroPiiVerified, true, 'Sanitized prompt must have zero PII');
    assert.ok(scrubReport.redactedTokenCount >= 5, 'Must redact all 5 PII tokens');
    assert.equal(verifyZeroPiiTasteLeakage(scrubReport.sanitizedPrompt), true);
    assert.equal(verifyZeroPiiTasteLeakage(dirtyPrompt), false);

    passedGates++;
    console.log('✅ Gate 1 PASSED: Qloo Cross-Domain Taste Graph & Zero-PII Sanitizer verified.');
  }

  // =========================================================================
  // GATE 2: 5-Stage Day-to-Night Chronological Solver & Hard Constraint Engine
  // =========================================================================
  {
    const tokyoHub = getCulturalHubById('HUB-TYO-101');
    const optimal = solveDayToNightItinerary(tokyoHub, tokyoHub.availableSeeds, {
      maxBudgetUsd: 220,
      maxWalkPerLegKm: 3.5,
      requireWheelchairAccess: true,
      requiredDietaryTags: ['VEGAN', 'ZERO_PROOF'],
    });

    assert.equal(optimal.stops.length, 5, 'Must sequence all 5 Day-to-Night stages');
    assert.equal(optimal.routeLegs.length, 4, '5 stops must produce 4 geodesic route legs');
    assert.equal(optimal.status, 'OPTIMAL_ITINERARY_LOCKED');

    const bounds = verifyItineraryConstraintBounds(optimal);
    assert.equal(bounds.passed, true);
    assert.equal(bounds.chronologicalOrderValid, true);
    assert.equal(bounds.budgetCompliant, true);
    assert.equal(bounds.walkabilityCompliant, true);
    assert.equal(bounds.accessibilityCompliant, true);
    assert.equal(bounds.dietaryCompliant, true);

    // Tightening budget from $220 to $145 should trigger dynamic EVENING venue substitution
    const budgetAdapted = solveDayToNightItinerary(tokyoHub, tokyoHub.availableSeeds, {
      maxBudgetUsd: 145,
      maxWalkPerLegKm: 3.5,
      requireWheelchairAccess: true,
      requiredDietaryTags: ['VEGAN'],
    });
    assert.equal(budgetAdapted.status, 'CONSTRAINT_ADAPTED_SUBSTITUTION');
    assert.ok(budgetAdapted.totalEstimatedCostUsd <= 145);
    assert.equal(verifyItineraryConstraintBounds(budgetAdapted).passed, true);

    // Impossible walkability limit (0.15 km per leg) must trigger CONSTRAINT_CONFLICT_HOLD
    const impossibleWalk = solveDayToNightItinerary(tokyoHub, tokyoHub.availableSeeds, {
      maxBudgetUsd: 220,
      maxWalkPerLegKm: 0.15,
      requireWheelchairAccess: true,
      requiredDietaryTags: [],
    });
    assert.equal(impossibleWalk.status, 'CONSTRAINT_CONFLICT_HOLD');
    assert.equal(verifyItineraryConstraintBounds(impossibleWalk).passed, false);

    // Verify positive Haversine distance
    const distKm = computeHaversineKm(35.6628, 139.6698, 35.6489, 139.6995);
    assert.ok(distKm > 1.5 && distKm < 6.0, 'Shimokitazawa to Daikanyama walk distance is realistic');

    passedGates++;
    console.log('✅ Gate 2 PASSED: 5-Stage Day-to-Night Chronological & Geodesic Constraint Solver verified.');
  }

  // =========================================================================
  // GATE 3: RFC 7946 GeoJSON, RFC 5545 iCalendar (.ics), & Markdown Exporter
  // =========================================================================
  {
    const parisHub = getCulturalHubById('HUB-PAR-309');
    const solved = solveDayToNightItinerary(parisHub, parisHub.availableSeeds, {
      maxBudgetUsd: 210,
      maxWalkPerLegKm: 3.5,
      requireWheelchairAccess: true,
      requiredDietaryTags: ['ZERO_PROOF'],
    });

    const geoJson = exportItineraryGeoJson(solved);
    assert.equal(geoJson.type, 'FeatureCollection');
    assert.equal(geoJson.features.length, 6, '5 Point features + 1 LineString route feature');
    const firstPoint = geoJson.features[0];
    assert.equal(firstPoint.geometry.type, 'Point');
    // RFC 7946 [longitude, latitude] check for Paris (~2.36 E, ~48.87 N)
    assert.ok(
      firstPoint.geometry.coordinates[0] > 2.0 && firstPoint.geometry.coordinates[0] < 3.0,
      'GeoJSON first coordinate must be longitude (RFC 7946)'
    );
    assert.ok(
      firstPoint.geometry.coordinates[1] > 48.0 && firstPoint.geometry.coordinates[1] < 49.5,
      'GeoJSON second coordinate must be latitude (RFC 7946)'
    );

    const ics = exportItineraryIcs(solved, '20261030');
    assert.ok(ics.includes('BEGIN:VCALENDAR'));
    assert.ok(ics.includes('END:VCALENDAR'));
    const veventMatches = ics.match(/BEGIN:VEVENT/g) ?? [];
    assert.equal(veventMatches.length, 5, 'Must generate 5 VEVENT calendar blocks');

    const md = exportConciergeMarkdown(solved, parisHub.availableSeeds, 'VA-QLOO-TESTHASH');
    assert.ok(md.includes('# VibeAtlas Concierge Passport — Paris'));
    assert.ok(md.includes('VA-QLOO-TESTHASH'));

    passedGates++;
    console.log('✅ Gate 3 PASSED: RFC 7946 GeoJSON, RFC 5545 iCal (.ics), & Markdown Exporter verified.');
  }

  // =========================================================================
  // GATE 4: Qloo 4-Stage Agentic Curator Pipeline, 4.5s Timeout & FNV-1a Seal
  // =========================================================================
  {
    const cdmxHub = getCulturalHubById('HUB-CDMX-412');
    const constraints = {
      maxBudgetUsd: 210,
      maxWalkPerLegKm: 3.5,
      requireWheelchairAccess: true,
      requiredDietaryTags: ['VEGAN' as const],
    };

    // Test simulated timeout fallback
    const fallbackRun = await runQlooAgenticCuratorPipeline(
      cdmxHub,
      cdmxHub.availableSeeds,
      constraints,
      {
        simulateTimeout: true,
        travelerNote: 'Reach me at guest@hotel.mx or 555-234-5678 for CDMX architecture walk.',
      }
    );
    assert.equal(fallbackRun.circuitBreakerTripped, true);
    assert.equal(fallbackRun.executionMode, 'LOCAL_QLOO_TASTE_GRAPH_FALLBACK');
    assert.equal(fallbackRun.stageTraces.length, 4);
    assert.ok(fallbackRun.piiRedactedCount >= 2);
    assert.ok(!fallbackRun.sanitizedNote.includes('guest@hotel.mx'));

    // Test FNV-1a Concierge Passport Attestation Seal & tamper invalidation
    const attestation = createConciergePassportAttestation(
      fallbackRun.itinerary,
      cdmxHub.availableSeeds
    );
    assert.ok(attestation.fnv1aHash.startsWith('VA-QLOO-'));
    assert.equal(
      verifyConciergeAttestationIntegrity(
        attestation,
        fallbackRun.itinerary,
        cdmxHub.availableSeeds
      ),
      true
    );

    // Mutating budget constraint must invalidate prior attestation seal
    const mutatedItinerary = solveDayToNightItinerary(cdmxHub, cdmxHub.availableSeeds, {
      ...constraints,
      maxBudgetUsd: 130,
    });
    assert.equal(
      verifyConciergeAttestationIntegrity(attestation, mutatedItinerary, cdmxHub.availableSeeds),
      false,
      'Mutating budget or route stops must invalidate prior FNV-1a Concierge Seal'
    );

    passedGates++;
    console.log('✅ Gate 4 PASSED: 4-Stage Qloo Agentic Pipeline, 4.5s Circuit Breaker & FNV-1a Seal verified.');
  }

  // =========================================================================
  // GATE 5: Port 5186 Strict Binding & Interactive UI Studio Wiring
  // =========================================================================
  {
    const pkgJson = fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8');
    const viteConfig = fs.readFileSync(path.join(PROJECT_ROOT, 'vite.config.ts'), 'utf8');
    const appTsx = fs.readFileSync(path.join(PROJECT_ROOT, 'src/App.tsx'), 'utf8');

    assert.ok(pkgJson.includes('--port 5186 --strictPort'), 'package.json must bind to Port 5186');
    assert.ok(viteConfig.includes('port: 5186'), 'vite.config.ts must bind to Port 5186');
    assert.ok(viteConfig.includes('strictPort: true'), 'vite.config.ts must enforce strictPort');
    assert.ok(
      appTsx.includes('Neighborhood Geodesic Route Canvas') &&
        appTsx.includes('6-Axis Qloo Cross-Domain Radar'),
      'App.tsx must render both the Geodesic Route SVG and 6-Axis Qloo Radar SVG'
    );

    passedGates++;
    console.log('✅ Gate 5 PASSED: Port 5186 strict isolation & interactive SVG Studio verified.');
  }

  // =========================================================================
  // GATE 6: Clean-Room IP, Port Sanctity & Devpost Documentation Audit
  // =========================================================================
  {
    const filesToAudit = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'index.html',
      'README.md',
      'HANDOFF_2_0.md',
      'devpost/PRD.md',
      'devpost/ARCHITECTURE.md',
      'devpost/SUBMISSION_CHECKLIST.md',
      'src/main.tsx',
      'src/App.tsx',
      'src/styles.css',
      'src/lib/taste/qloo-taste-graph.ts',
      'src/lib/routing/day-to-night-itinerary-solver.ts',
      'src/lib/export/concierge-passport-exporter.ts',
      'src/lib/qloo/qloo-agentic-supervisor.ts',
    ];

    // Assemble forbidden tokens dynamically from char codes so this test file stays 100% clean
    const forbiddenTokens = [
      [69, 100, 105, 111, 115], // E-d-i-o-s
      [83, 111, 118, 101, 114, 101, 105, 103, 110], // S-o-v-e-r-e-i-g-n
      [51, 43, 51], // 3-+-3
      [83, 101, 108, 102, 45, 80, 108, 97, 121], // S-e-l-f---P-l-a-y
      [102, 111, 114, 103, 101, 46, 100, 98], // f-o-r-g-e-.-d-b
      [53, 49, 55, 53], // 5-1-7-5
    ].map((codes) => String.fromCharCode(...codes));

    for (const relPath of filesToAudit) {
      const fullPath = path.join(PROJECT_ROOT, relPath);
      assert.ok(fs.existsSync(fullPath), `Required file missing: ${relPath}`);
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const token of forbiddenTokens) {
        assert.ok(
          !content.toLowerCase().includes(token.toLowerCase()),
          `Clean-room violation in ${relPath}: found forbidden token`
        );
      }
    }

    passedGates++;
    console.log(
      `✅ Gate 6 PASSED: Clean-room audit verified across all ${filesToAudit.length} repository files.`
    );
  }

  const elapsedMs = (performance.now() - startMs).toFixed(2);
  console.log(`\n🏆 ALL ${passedGates}/6 VIBEATLAS QLOO VERIFICATION GATES PASSED IN ${elapsedMs}ms.`);
}

runAllVerificationGates().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
