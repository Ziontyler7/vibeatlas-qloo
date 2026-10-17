/**
 * Gate 3: Concierge Passport Exporter (RFC 7946 GeoJSON, RFC 5545 iCal .ics, & Markdown)
 *
 * Exports solved Day-to-Night Qloo cultural itineraries into:
 *  1. RFC 7946 GeoJSON FeatureCollection ([longitude, latitude] Point + LineString features)
 *  2. RFC 5545 iCalendar (.ics) schedule with deterministic VEVENT entries
 *  3. Concierge Markdown Passport with Qloo cross-domain entity bridge explanations
 */

import type { SolvedDayToNightItinerary } from '../routing/day-to-night-itinerary-solver.ts';
import type { CulturalSeedEntity } from '../taste/qloo-taste-graph.ts';

export interface GeoJsonPointFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // RFC 7946 [longitude, latitude]
  };
  properties: {
    stopIndex: number;
    stage: string;
    windowLabel: string;
    venueId: string;
    qlooPlaceUrn: string;
    name: string;
    neighborhood: string;
    categoryLabel: string;
    primaryDomain: string;
    estimatedCostUsd: number;
    compositeAffinityScore: number;
    qlooLiftMultiplier: number;
    stepFreeAccess: boolean;
    dietaryTags: string[];
    whyItMatches: string;
  };
}

export interface GeoJsonLineStringFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: Array<[number, number]>; // RFC 7946 [longitude, latitude]
  };
  properties: {
    hubId: string;
    city: string;
    corridorName: string;
    totalWalkDistanceKm: number;
    totalWalkMinutes: number;
    totalEstimatedCostUsd: number;
    meanAffinityScore: number;
  };
}

export interface ItineraryGeoJsonCollection {
  type: 'FeatureCollection';
  features: Array<GeoJsonPointFeature | GeoJsonLineStringFeature>;
}

/**
 * Exports a SolvedDayToNightItinerary to an RFC 7946 compliant GeoJSON FeatureCollection.
 */
export function exportItineraryGeoJson(
  itinerary: SolvedDayToNightItinerary
): ItineraryGeoJsonCollection {
  const pointFeatures: GeoJsonPointFeature[] = itinerary.stops.map((stop) => {
    const { venue } = stop.affinityMatch;
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [venue.coordinates.lng, venue.coordinates.lat],
      },
      properties: {
        stopIndex: stop.stopIndex,
        stage: stop.stage,
        windowLabel: stop.windowLabel,
        venueId: venue.venueId,
        qlooPlaceUrn: venue.qlooPlaceUrn,
        name: venue.name,
        neighborhood: venue.neighborhood,
        categoryLabel: venue.categoryLabel,
        primaryDomain: venue.primaryDomain,
        estimatedCostUsd: venue.estimatedCostUsd,
        compositeAffinityScore: stop.affinityMatch.compositeAffinityScore,
        qlooLiftMultiplier: stop.affinityMatch.qlooLiftMultiplier,
        stepFreeAccess: venue.stepFreeAccess,
        dietaryTags: [...venue.dietaryTags],
        whyItMatches: stop.affinityMatch.whyItMatches,
      },
    };
  });

  const routeFeature: GeoJsonLineStringFeature = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: itinerary.stops.map((stop) => [
        stop.affinityMatch.venue.coordinates.lng,
        stop.affinityMatch.venue.coordinates.lat,
      ]),
    },
    properties: {
      hubId: itinerary.hubId,
      city: itinerary.city,
      corridorName: itinerary.corridorName,
      totalWalkDistanceKm: itinerary.totalWalkDistanceKm,
      totalWalkMinutes: itinerary.totalWalkMinutes,
      totalEstimatedCostUsd: itinerary.totalEstimatedCostUsd,
      meanAffinityScore: itinerary.meanAffinityScore,
    },
  };

  return {
    type: 'FeatureCollection',
    features: [...pointFeatures, routeFeature],
  };
}

function formatIcsTime(dateCode: string, hour24: number, minute: number): string {
  const hh = String(Math.floor(hour24)).padStart(2, '0');
  const mm = String(Math.floor(minute)).padStart(2, '0');
  return `${dateCode}T${hh}${mm}00`;
}

/**
 * Exports a SolvedDayToNightItinerary to an RFC 5545 compliant iCalendar (.ics) string.
 */
export function exportItineraryIcs(
  itinerary: SolvedDayToNightItinerary,
  dateCompact = '20261030'
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VibeAtlas Qloo Cultural Curator//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:VibeAtlas - ${itinerary.city} (${itinerary.corridorName})`,
  ];

  for (const stop of itinerary.stops) {
    const { venue } = stop.affinityMatch;
    const startHour = venue.startHour24;
    const totalEndMinutes = startHour * 60 + venue.durationMinutes;
    const endHour = Math.min(23, Math.floor(totalEndMinutes / 60));
    const endMinute = totalEndMinutes % 60;

    const dtStart = formatIcsTime(dateCompact, startHour, 0);
    const dtEnd = formatIcsTime(dateCompact, endHour, endMinute);
    const cleanDescription = `${stop.affinityMatch.whyItMatches} | Highlight: ${venue.signatureHighlight} | Est. Spend: $${venue.estimatedCostUsd}`.replace(
      /[,;]/g,
      ' '
    );

    lines.push(
      'BEGIN:VEVENT',
      `UID:vibeatlas-${itinerary.hubId.toLowerCase()}-${stop.stage.toLowerCase()}-${dateCompact}@vibeatlas.local`,
      `DTSTAMP:${dateCompact}T080000Z`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:[${stop.stage}] ${venue.name} (${stop.affinityMatch.compositeAffinityScore}% Qloo Match)`,
      `LOCATION:${venue.neighborhood} - ${itinerary.city} (${venue.coordinates.lat.toFixed(4)} ${venue.coordinates.lng.toFixed(4)})`,
      `DESCRIPTION:${cleanDescription}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Exports a rich Markdown Concierge Passport summarizing the Qloo cross-domain taste bridges and route.
 */
export function exportConciergeMarkdown(
  itinerary: SolvedDayToNightItinerary,
  selectedSeeds: readonly CulturalSeedEntity[],
  attestationHash?: string
): string {
  const seedList = selectedSeeds
    .map((s) => `- **${s.name}** (\`${s.domain}\` · \`${s.qlooEntityUrn}\`)`)
    .join('\n');

  const stopBlocks = itinerary.stops
    .map((stop) => {
      const { venue } = stop.affinityMatch;
      return [
        `### ${stop.stopIndex}. [${stop.stage} · ${stop.windowLabel}] ${venue.name}`,
        `- **Neighborhood & Category**: ${venue.neighborhood} · *${venue.categoryLabel}*`,
        `- **Qloo Entity URN**: \`${venue.qlooPlaceUrn}\` (**${stop.affinityMatch.compositeAffinityScore}% Affinity** · \`${stop.affinityMatch.qlooLiftMultiplier.toFixed(2)}x\` Cross-Domain Lift)`,
        `- **Spend & Accessibility**: \`$${venue.estimatedCostUsd}\` est. (Cumulative: \`$${stop.cumulativeCostUsd}\`) · Step-Free: \`${venue.stepFreeAccess ? 'YES' : 'NO'}\` · Dietary: \`${venue.dietaryTags.join(', ')}\``,
        `- **Why Qloo Matched This Stop**: ${stop.affinityMatch.whyItMatches}`,
        `- **Architectural & Culinary Highlight**: ${venue.architecturalNote} — *${venue.signatureHighlight}*`,
      ].join('\n');
    })
    .join('\n\n');

  const legSummary = itinerary.routeLegs
    .map(
      (leg, idx) =>
        `${idx + 1}. **${leg.fromStage} → ${leg.toStage}**: ${leg.distanceKm.toFixed(2)} km (${leg.estimatedWalkMinutes} min walk) — \`${leg.withinWalkLimit ? 'WITHIN_RADIUS' : 'EXCEEDS_RADIUS'}\``
    )
    .join('\n');

  return [
    `# VibeAtlas Concierge Passport — ${itinerary.city}: ${itinerary.corridorName}`,
    '',
    `- **Hub ID**: \`${itinerary.hubId}\``,
    `- **Solver Status**: \`${itinerary.status}\``,
    `- **Mean Qloo Cross-Domain Affinity**: \`${itinerary.meanAffinityScore}%\``,
    `- **Total Estimated Day-to-Night Spend**: \`$${itinerary.totalEstimatedCostUsd}\` / \`$${itinerary.constraints.maxBudgetUsd}\` Ceiling`,
    `- **Total Pedestrian Walk**: \`${itinerary.totalWalkDistanceKm.toFixed(2)} km\` (${itinerary.totalWalkMinutes} mins total across 4 transitions)`,
    attestationHash ? `- **Concierge Seal FNV-1a-32**: \`${attestationHash}\`` : null,
    '',
    '## Cross-Domain Qloo Taste Seeds',
    seedList,
    '',
    '## 5-Stage Day-to-Night Cultural Arc',
    stopBlocks,
    '',
    '## Geodesic Pedestrian Transitions',
    legSummary,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}
