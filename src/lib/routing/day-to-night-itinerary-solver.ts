/**
 * Gate 2: Day-to-Night Chronological Itinerary Solver & Geodesic Constraint Engine
 *
 * Sequences a 5-stop Day-to-Night cultural arc (MORNING -> MIDDAY -> AFTERNOON -> EVENING -> LATE_NIGHT)
 * while enforcing hard Haversine walkability radii, per-person budget ceilings,
 * ADA step-free wheelchair accessibility, and strict dietary filters.
 */

import {
  DAY_STAGES,
  type CulturalHubPreset,
  type CulturalSeedEntity,
  type CulturalVenueCandidate,
  type DayStage,
  type DietaryTag,
  type TasteVector6D,
  type VenueAffinityMatch,
  computeCrossDomainAffinityScore,
  synthesizeCompositeTasteVector,
} from '../taste/qloo-taste-graph.ts';

export interface ItineraryConstraints {
  maxBudgetUsd: number; // e.g., $60 .. $350 total day spend
  maxWalkPerLegKm: number; // e.g., 0.6 .. 5.0 km per transition leg
  requireWheelchairAccess: boolean;
  requiredDietaryTags: DietaryTag[];
}

export interface ItineraryRouteLeg {
  fromStage: DayStage;
  toStage: DayStage;
  fromVenueName: string;
  toVenueName: string;
  distanceKm: number;
  estimatedWalkMinutes: number;
  withinWalkLimit: boolean;
  svgPath: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface ScheduledItineraryStop {
  stopIndex: number;
  stage: DayStage;
  windowLabel: string;
  affinityMatch: VenueAffinityMatch;
  cumulativeCostUsd: number;
  dietaryCompliant: boolean;
  stepFreeCompliant: boolean;
  substitutedForBudgetOrFilter: boolean;
}

export type ItinerarySolverStatus =
  | 'OPTIMAL_ITINERARY_LOCKED'
  | 'CONSTRAINT_ADAPTED_SUBSTITUTION'
  | 'CONSTRAINT_CONFLICT_HOLD';

export interface SolvedDayToNightItinerary {
  hubId: string;
  city: string;
  corridorName: string;
  status: ItinerarySolverStatus;
  constraints: ItineraryConstraints;
  compositeTasteVector: TasteVector6D;
  stops: ScheduledItineraryStop[];
  routeLegs: ItineraryRouteLeg[];
  totalEstimatedCostUsd: number;
  remainingBudgetUsd: number;
  totalWalkDistanceKm: number;
  totalWalkMinutes: number;
  maxSingleLegKm: number;
  meanAffinityScore: number;
  constraintViolations: string[];
  substitutionNotes: string[];
}

const EARTH_RADIUS_KM = 6371.0088;

/**
 * Computes exact Haversine great-circle distance in kilometers between two geographic coordinates.
 */
export function computeHaversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // Multiply by 1.22 urban street-grid tortuosity factor for realistic pedestrian walking distance
  const pedestrianKm = EARTH_RADIUS_KM * c * 1.22;
  return Number(pedestrianKm.toFixed(2));
}

/**
 * Estimates pedestrian walk duration in minutes at a comfortable 4.6 km/h urban promenade pace.
 */
export function estimateWalkMinutes(distanceKm: number): number {
  return Math.max(2, Math.round((distanceKm / 4.6) * 60));
}

function venueSatisfiesHardFilters(
  venue: CulturalVenueCandidate,
  constraints: ItineraryConstraints
): boolean {
  if (constraints.requireWheelchairAccess && !venue.stepFreeAccess) {
    return false;
  }

  for (const requiredTag of constraints.requiredDietaryTags) {
    if (!venue.dietaryTags.includes(requiredTag)) {
      return false;
    }
  }

  return true;
}

/**
 * Solves the 5-stage Day-to-Night cultural itinerary for a given hub, seed list, and constraint set.
 */
export function solveDayToNightItinerary(
  hub: CulturalHubPreset,
  selectedSeeds: readonly CulturalSeedEntity[],
  constraints: ItineraryConstraints
): SolvedDayToNightItinerary {
  const activeSeeds =
    selectedSeeds.length > 0
      ? selectedSeeds
      : hub.availableSeeds.filter((s) => hub.defaultSeedIds.includes(s.seedId));

  const compositeTasteVector = synthesizeCompositeTasteVector(activeSeeds);
  const substitutionNotes: string[] = [];
  const constraintViolations: string[] = [];

  // Step 1: For each of the 5 chronological stages, rank candidates by Qloo affinity
  const selectedByStage: Map<DayStage, { match: VenueAffinityMatch; substituted: boolean }> =
    new Map();

  for (const stage of DAY_STAGES) {
    const stageCandidates = hub.candidateVenues
      .filter((v) => v.stage === stage)
      .map((v) => computeCrossDomainAffinityScore(v, activeSeeds))
      .sort((a, b) => b.compositeAffinityScore - a.compositeAffinityScore);

    const compliantCandidates = stageCandidates.filter((m) =>
      venueSatisfiesHardFilters(m.venue, constraints)
    );

    if (compliantCandidates.length > 0) {
      const topPick = compliantCandidates[0];
      const wasSubstituted = topPick.venue.venueId !== stageCandidates[0]?.venue.venueId;
      if (wasSubstituted) {
        substitutionNotes.push(
          `${stage}: Swapped to ${topPick.venue.name} to satisfy accessibility/dietary filter.`
        );
      }
      selectedByStage.set(stage, { match: topPick, substituted: wasSubstituted });
    } else if (stageCandidates.length > 0) {
      selectedByStage.set(stage, { match: stageCandidates[0], substituted: false });
      constraintViolations.push(
        `No candidate in ${stage} fully satisfied step-free/dietary filter combination.`
      );
    }
  }

  // Step 2: Check total budget ceiling and down-tier expensive stages (e.g. EVENING) if needed
  let currentTotalCost = Array.from(selectedByStage.values()).reduce(
    (sum, item) => sum + item.match.venue.estimatedCostUsd,
    0
  );

  if (currentTotalCost > constraints.maxBudgetUsd) {
    for (const stage of DAY_STAGES) {
      if (currentTotalCost <= constraints.maxBudgetUsd) break;
      const currentPick = selectedByStage.get(stage);
      if (!currentPick) continue;

      const cheaperAlternatives = hub.candidateVenues
        .filter(
          (v) =>
            v.stage === stage &&
            venueSatisfiesHardFilters(v, constraints) &&
            v.estimatedCostUsd < currentPick.match.venue.estimatedCostUsd
        )
        .map((v) => computeCrossDomainAffinityScore(v, activeSeeds))
        .sort((a, b) => a.venue.estimatedCostUsd - b.venue.estimatedCostUsd);

      if (cheaperAlternatives.length > 0) {
        const replacement = cheaperAlternatives[0];
        const saved =
          currentPick.match.venue.estimatedCostUsd - replacement.venue.estimatedCostUsd;
        currentTotalCost -= saved;
        selectedByStage.set(stage, { match: replacement, substituted: true });
        substitutionNotes.push(
          `${stage}: Selected ${replacement.venue.name} ($${replacement.venue.estimatedCostUsd} vs $${currentPick.match.venue.estimatedCostUsd}) to keep full-day spend within $${constraints.maxBudgetUsd} budget.`
        );
      }
    }
  }

  // Step 3: Build ordered stops and compute Haversine route legs
  const stops: ScheduledItineraryStop[] = [];
  let runningCost = 0;

  DAY_STAGES.forEach((stage, idx) => {
    const entry = selectedByStage.get(stage);
    if (!entry) return;
    runningCost += entry.match.venue.estimatedCostUsd;

    const dietaryCompliant = constraints.requiredDietaryTags.every((tag) =>
      entry.match.venue.dietaryTags.includes(tag)
    );
    const stepFreeCompliant =
      !constraints.requireWheelchairAccess || entry.match.venue.stepFreeAccess;

    stops.push({
      stopIndex: idx + 1,
      stage,
      windowLabel: entry.match.venue.windowLabel,
      affinityMatch: entry.match,
      cumulativeCostUsd: runningCost,
      dietaryCompliant,
      stepFreeCompliant,
      substitutedForBudgetOrFilter: entry.substituted,
    });
  });

  const routeLegs: ItineraryRouteLeg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const fromStop = stops[i];
    const toStop = stops[i + 1];
    const distanceKm = computeHaversineKm(
      fromStop.affinityMatch.venue.coordinates.lat,
      fromStop.affinityMatch.venue.coordinates.lng,
      toStop.affinityMatch.venue.coordinates.lat,
      toStop.affinityMatch.venue.coordinates.lng
    );
    const estimatedWalkMinutes = estimateWalkMinutes(distanceKm);
    const withinWalkLimit = distanceKm <= constraints.maxWalkPerLegKm;

    if (!withinWalkLimit) {
      constraintViolations.push(
        `Leg ${fromStop.stage} -> ${toStop.stage} (${distanceKm.toFixed(2)} km) exceeds max walk limit of ${constraints.maxWalkPerLegKm.toFixed(2)} km.`
      );
    }

    routeLegs.push({
      fromStage: fromStop.stage,
      toStage: toStop.stage,
      fromVenueName: fromStop.affinityMatch.venue.name,
      toVenueName: toStop.affinityMatch.venue.name,
      distanceKm,
      estimatedWalkMinutes,
      withinWalkLimit,
      svgPath: {
        x1: fromStop.affinityMatch.venue.coordinates.svgX,
        y1: fromStop.affinityMatch.venue.coordinates.svgY,
        x2: toStop.affinityMatch.venue.coordinates.svgX,
        y2: toStop.affinityMatch.venue.coordinates.svgY,
      },
    });
  }

  if (runningCost > constraints.maxBudgetUsd) {
    constraintViolations.push(
      `Total estimated spend ($${runningCost}) exceeds hard budget ceiling ($${constraints.maxBudgetUsd}).`
    );
  }

  const totalWalkDistanceKm = Number(
    routeLegs.reduce((sum, leg) => sum + leg.distanceKm, 0).toFixed(2)
  );
  const totalWalkMinutes = routeLegs.reduce((sum, leg) => sum + leg.estimatedWalkMinutes, 0);
  const maxSingleLegKm =
    routeLegs.length > 0 ? Math.max(...routeLegs.map((l) => l.distanceKm)) : 0;

  const meanAffinityScore =
    stops.length > 0
      ? Number(
          (
            stops.reduce((sum, s) => sum + s.affinityMatch.compositeAffinityScore, 0) /
            stops.length
          ).toFixed(1)
        )
      : 0;

  let status: ItinerarySolverStatus = 'OPTIMAL_ITINERARY_LOCKED';
  if (constraintViolations.length > 0) {
    status = 'CONSTRAINT_CONFLICT_HOLD';
  } else if (substitutionNotes.length > 0) {
    status = 'CONSTRAINT_ADAPTED_SUBSTITUTION';
  }

  return {
    hubId: hub.hubId,
    city: hub.city,
    corridorName: hub.corridorName,
    status,
    constraints,
    compositeTasteVector,
    stops,
    routeLegs,
    totalEstimatedCostUsd: runningCost,
    remainingBudgetUsd: constraints.maxBudgetUsd - runningCost,
    totalWalkDistanceKm,
    totalWalkMinutes,
    maxSingleLegKm,
    meanAffinityScore,
    constraintViolations,
    substitutionNotes,
  };
}

/**
 * Verifies whether a SolvedDayToNightItinerary satisfies all hard chronological,
 * walkability, budget, dietary, and accessibility invariants.
 */
export function verifyItineraryConstraintBounds(
  itinerary: SolvedDayToNightItinerary
): {
  passed: boolean;
  chronologicalOrderValid: boolean;
  budgetCompliant: boolean;
  walkabilityCompliant: boolean;
  accessibilityCompliant: boolean;
  dietaryCompliant: boolean;
} {
  const chronologicalOrderValid =
    itinerary.stops.length === DAY_STAGES.length &&
    itinerary.stops.every((stop, idx) => stop.stage === DAY_STAGES[idx]);

  const budgetCompliant =
    itinerary.totalEstimatedCostUsd <= itinerary.constraints.maxBudgetUsd;

  const walkabilityCompliant = itinerary.routeLegs.every(
    (leg) => leg.distanceKm <= itinerary.constraints.maxWalkPerLegKm
  );

  const accessibilityCompliant = itinerary.stops.every((s) => s.stepFreeCompliant);
  const dietaryCompliant = itinerary.stops.every((s) => s.dietaryCompliant);

  const passed =
    chronologicalOrderValid &&
    budgetCompliant &&
    walkabilityCompliant &&
    accessibilityCompliant &&
    dietaryCompliant &&
    itinerary.status !== 'CONSTRAINT_CONFLICT_HOLD';

  return {
    passed,
    chronologicalOrderValid,
    budgetCompliant,
    walkabilityCompliant,
    accessibilityCompliant,
    dietaryCompliant,
  };
}
