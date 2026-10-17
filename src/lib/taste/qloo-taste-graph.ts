/**
 * Gate 1: Qloo Taste AI Cross-Domain Cultural Affinity Graph & Zero-PII Sanitizer
 *
 * Models Qloo's cross-domain entity graph (Music, Film, Literature, Architecture,
 * Culinary, and Nightlife/Design) across 4 iconic global cultural hubs:
 *  - HUB-TYO-101: Tokyo — Shimokitazawa & Daikanyama
 *  - HUB-NYC-204: New York City — Lower East Side & Dimes Square
 *  - HUB-PAR-309: Paris — Canal Saint-Martin & Le Marais
 *  - HUB-CDMX-412: Mexico City — Roma Norte & Condesa
 */

export type CulturalDomain =
  | 'MUSIC'
  | 'FILM'
  | 'LITERATURE'
  | 'ARCHITECTURE'
  | 'CULINARY'
  | 'NIGHTLIFE_DESIGN';

export const CULTURAL_DOMAINS: readonly CulturalDomain[] = [
  'MUSIC',
  'FILM',
  'LITERATURE',
  'ARCHITECTURE',
  'CULINARY',
  'NIGHTLIFE_DESIGN',
] as const;

export type DietaryTag =
  | 'VEGAN'
  | 'GLUTEN_FREE'
  | 'HALAL'
  | 'KOSHER'
  | 'ZERO_PROOF';

export type DayStage =
  | 'MORNING'
  | 'MIDDAY'
  | 'AFTERNOON'
  | 'EVENING'
  | 'LATE_NIGHT';

export const DAY_STAGES: readonly DayStage[] = [
  'MORNING',
  'MIDDAY',
  'AFTERNOON',
  'EVENING',
  'LATE_NIGHT',
] as const;

export type TasteVector6D = Record<CulturalDomain, number>;

export interface CulturalSeedEntity {
  seedId: string;
  qlooEntityUrn: string;
  name: string;
  domain: CulturalDomain;
  creatorOrEra: string;
  vibeTags: string[];
  tasteWeights: TasteVector6D;
  culturalSummary: string;
}

export interface CulturalVenueCandidate {
  venueId: string;
  qlooPlaceUrn: string;
  hubId: string;
  stage: DayStage;
  windowLabel: string;
  startHour24: number;
  durationMinutes: number;
  name: string;
  neighborhood: string;
  categoryLabel: string;
  primaryDomain: CulturalDomain;
  coordinates: {
    lat: number;
    lng: number;
    svgX: number;
    svgY: number;
  };
  estimatedCostUsd: number;
  stepFreeAccess: boolean;
  dietaryTags: DietaryTag[];
  vibeTags: string[];
  tasteVector: TasteVector6D;
  qlooCrossDomainLift: number; // e.g., 1.18 = +18% Qloo cross-domain co-affinity lift
  architecturalNote: string;
  signatureHighlight: string;
}

export interface CulturalHubPreset {
  hubId: string;
  city: string;
  corridorName: string;
  countryCode: string;
  timezone: string;
  currencyCode: string;
  centerCoordinates: {
    lat: number;
    lng: number;
  };
  defaultSeedIds: string[];
  availableSeeds: CulturalSeedEntity[];
  candidateVenues: CulturalVenueCandidate[];
  editorialTagline: string;
}

export interface TastePiiScrubReport {
  sanitizedPrompt: string;
  redactedTokenCount: number;
  redactedCategories: string[];
  zeroPiiVerified: boolean;
}

export interface VenueAffinityMatch {
  venue: CulturalVenueCandidate;
  cosineSimilarity: number;
  jaccardTagOverlap: number;
  qlooLiftMultiplier: number;
  compositeAffinityScore: number; // 0..100 normalized
  matchedSeedNames: string[];
  sharedVibeTags: string[];
  whyItMatches: string;
}

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_PATTERN = /(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\b\d{3})[-.\s]\d{3}[-.\s]\d{4}\b/g;
const CARD_PATTERN = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const PASSPORT_PATTERN = /\b(?:PASSPORT|PASS-ID|BOOKING-REF)[-\s#:]*[A-Z0-9]{6,12}\b/gi;
const HOTEL_ROOM_PATTERN = /\b(?:ROOM|SUITE)\s+#?\d{2,5}[A-Z]?\b/gi;

/**
 * Scrubs traveler PII (emails, phone numbers, payment cards, passport refs, hotel room numbers)
 * before any cultural taste query is sent to Qloo Taste AI or agentic synthesizers.
 */
export function scrubTastePromptPii(rawInput: string): TastePiiScrubReport {
  let text = rawInput;
  let redactedTokenCount = 0;
  const redactedCategories: string[] = [];

  const applyPattern = (regex: RegExp, replacement: string, category: string) => {
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      redactedTokenCount += matches.length;
      if (!redactedCategories.includes(category)) {
        redactedCategories.push(category);
      }
      text = text.replace(regex, replacement);
    }
  };

  applyPattern(EMAIL_PATTERN, '[REDACTED_EMAIL]', 'EMAIL');
  applyPattern(CARD_PATTERN, '[REDACTED_PAYMENT_CARD]', 'PAYMENT_CARD');
  applyPattern(PHONE_PATTERN, '[REDACTED_PHONE]', 'PHONE');
  applyPattern(PASSPORT_PATTERN, '[REDACTED_TRAVEL_DOC]', 'TRAVEL_DOC');
  applyPattern(HOTEL_ROOM_PATTERN, '[REDACTED_ROOM_NUMBER]', 'HOTEL_ROOM');

  return {
    sanitizedPrompt: text.trim(),
    redactedTokenCount,
    redactedCategories,
    zeroPiiVerified: verifyZeroPiiTasteLeakage(text),
  };
}

/**
 * Verifies that a sanitized taste prompt contains zero residual PII patterns.
 */
export function verifyZeroPiiTasteLeakage(candidateText: string): boolean {
  EMAIL_PATTERN.lastIndex = 0;
  PHONE_PATTERN.lastIndex = 0;
  CARD_PATTERN.lastIndex = 0;
  PASSPORT_PATTERN.lastIndex = 0;
  HOTEL_ROOM_PATTERN.lastIndex = 0;

  return (
    !EMAIL_PATTERN.test(candidateText) &&
    !PHONE_PATTERN.test(candidateText) &&
    !CARD_PATTERN.test(candidateText) &&
    !PASSPORT_PATTERN.test(candidateText) &&
    !HOTEL_ROOM_PATTERN.test(candidateText)
  );
}

/**
 * Aggregates selected cultural seed entities into a normalized 6-axis TasteVector6D.
 */
export function synthesizeCompositeTasteVector(
  seeds: readonly CulturalSeedEntity[]
): TasteVector6D {
  if (seeds.length === 0) {
    return {
      MUSIC: 0.7,
      FILM: 0.7,
      LITERATURE: 0.7,
      ARCHITECTURE: 0.7,
      CULINARY: 0.7,
      NIGHTLIFE_DESIGN: 0.7,
    };
  }

  const sums: TasteVector6D = {
    MUSIC: 0,
    FILM: 0,
    LITERATURE: 0,
    ARCHITECTURE: 0,
    CULINARY: 0,
    NIGHTLIFE_DESIGN: 0,
  };

  for (const seed of seeds) {
    for (const domain of CULTURAL_DOMAINS) {
      sums[domain] += seed.tasteWeights[domain];
    }
  }

  const result: TasteVector6D = {
    MUSIC: Number((sums.MUSIC / seeds.length).toFixed(3)),
    FILM: Number((sums.FILM / seeds.length).toFixed(3)),
    LITERATURE: Number((sums.LITERATURE / seeds.length).toFixed(3)),
    ARCHITECTURE: Number((sums.ARCHITECTURE / seeds.length).toFixed(3)),
    CULINARY: Number((sums.CULINARY / seeds.length).toFixed(3)),
    NIGHTLIFE_DESIGN: Number((sums.NIGHTLIFE_DESIGN / seeds.length).toFixed(3)),
  };

  return result;
}

/**
 * Computes 6-dimensional cosine similarity in [0, 1] between two cultural taste vectors.
 */
export function computeCosineAffinity(a: TasteVector6D, b: TasteVector6D): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const domain of CULTURAL_DOMAINS) {
    const va = a[domain];
    const vb = b[domain];
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const raw = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Number(Math.max(0, Math.min(1, raw)).toFixed(4));
}

/**
 * Computes Jaccard tag overlap between seed vibe tags and venue vibe tags.
 */
export function computeJaccardTagOverlap(
  seedTags: readonly string[],
  venueTags: readonly string[]
): { overlapScore: number; sharedTags: string[] } {
  const setA = new Set(seedTags.map((t) => t.toLowerCase()));
  const setB = new Set(venueTags.map((t) => t.toLowerCase()));

  const sharedTags: string[] = [];
  for (const tag of setB) {
    if (setA.has(tag)) {
      sharedTags.push(tag);
    }
  }

  const unionSize = new Set([...setA, ...setB]).size;
  if (unionSize === 0) {
    return { overlapScore: 0, sharedTags: [] };
  }

  return {
    overlapScore: Number((sharedTags.length / unionSize).toFixed(4)),
    sharedTags,
  };
}

/**
 * Scores a candidate venue against the traveler's selected cross-domain Qloo seeds.
 */
export function computeCrossDomainAffinityScore(
  venue: CulturalVenueCandidate,
  selectedSeeds: readonly CulturalSeedEntity[]
): VenueAffinityMatch {
  const compositeVector = synthesizeCompositeTasteVector(selectedSeeds);
  const cosineSimilarity = computeCosineAffinity(compositeVector, venue.tasteVector);

  const allSeedTags = selectedSeeds.flatMap((s) => s.vibeTags);
  const { overlapScore: jaccardTagOverlap, sharedTags } = computeJaccardTagOverlap(
    allSeedTags,
    venue.vibeTags
  );

  // Blend cosine similarity (70%) + Jaccard tag resonance (30%), boosted by Qloo Cross-Domain Lift
  const baseBlend = cosineSimilarity * 0.72 + Math.min(1, jaccardTagOverlap * 2.4) * 0.28;
  const lifted = Math.min(0.995, baseBlend * (0.85 + (venue.qlooCrossDomainLift - 1) * 0.65));
  const compositeAffinityScore = Number((lifted * 100).toFixed(1));

  const matchedSeedNames = selectedSeeds
    .filter((seed) => seed.vibeTags.some((t) => venue.vibeTags.includes(t)) || seed.tasteWeights[venue.primaryDomain] >= 0.75)
    .map((s) => s.name);

  const displaySeeds =
    matchedSeedNames.length > 0
      ? matchedSeedNames.slice(0, 2).join(' + ')
      : selectedSeeds.map((s) => s.name).slice(0, 2).join(' + ');

  const displayTags =
    sharedTags.length > 0 ? sharedTags.slice(0, 3).join(', ') : venue.vibeTags.slice(0, 2).join(', ');

  const whyItMatches = `Qloo Cross-Domain Bridge (${venue.qlooCrossDomainLift.toFixed(2)}x lift): Audience affinity from ${displaySeeds} maps to ${venue.name} via shared [${displayTags}] vectors (${compositeAffinityScore}% match).`;

  return {
    venue,
    cosineSimilarity,
    jaccardTagOverlap,
    qlooLiftMultiplier: venue.qlooCrossDomainLift,
    compositeAffinityScore,
    matchedSeedNames: matchedSeedNames.length > 0 ? matchedSeedNames : selectedSeeds.map((s) => s.name),
    sharedVibeTags: sharedTags,
    whyItMatches,
  };
}

/**
 * Ranks all candidate venues in a hub by composite Qloo cross-domain affinity score.
 */
export function rankVenuesByTasteAffinity(
  venues: readonly CulturalVenueCandidate[],
  selectedSeeds: readonly CulturalSeedEntity[]
): VenueAffinityMatch[] {
  return venues
    .map((venue) => computeCrossDomainAffinityScore(venue, selectedSeeds))
    .sort((a, b) => b.compositeAffinityScore - a.compositeAffinityScore);
}

export const GLOBAL_CULTURAL_HUBS: readonly CulturalHubPreset[] = [
  {
    hubId: 'HUB-TYO-101',
    city: 'Tokyo',
    corridorName: 'Shimokitazawa & Daikanyama Cultural Corridor',
    countryCode: 'JP',
    timezone: 'Asia/Tokyo',
    currencyCode: 'USD',
    centerCoordinates: { lat: 35.6562, lng: 139.6838 },
    defaultSeedIds: ['SEED-TYO-MUSIC-1', 'SEED-TYO-FILM-1', 'SEED-TYO-LIT-1'],
    editorialTagline:
      'Tube-amp jazz kissaten, Metabolist concrete courtyards, secondhand photobooks, and charcoal counter dining.',
    availableSeeds: [
      {
        seedId: 'SEED-TYO-MUSIC-1',
        qlooEntityUrn: 'urn:entity:artist:ryuichi_sakamoto_ambient',
        name: 'Ryuichi Sakamoto & Hosono Ambient Synth',
        domain: 'MUSIC',
        creatorOrEra: 'Yellow Magic / Post-Classical Tokyo',
        vibeTags: ['analog-vinyl', 'minimalist-acoustics', 'late-night-listening', 'brutalist-warmth'],
        tasteWeights: {
          MUSIC: 0.98,
          FILM: 0.84,
          LITERATURE: 0.78,
          ARCHITECTURE: 0.91,
          CULINARY: 0.82,
          NIGHTLIFE_DESIGN: 0.94,
        },
        culturalSummary: 'Electro-acoustic minimalism paired with warm wood-and-concrete listening rooms.',
      },
      {
        seedId: 'SEED-TYO-FILM-1',
        qlooEntityUrn: 'urn:entity:movie:perfect_days_wim_wenders',
        name: 'Perfect Days (Wim Wenders · Tokyo Shrines & Cassettes)',
        domain: 'FILM',
        creatorOrEra: '2023 Contemplative Cinema',
        vibeTags: ['analog-vinyl', 'komorebi-light', 'indie-bookshop', 'architectural-serenity', 'craft-coffee'],
        tasteWeights: {
          MUSIC: 0.88,
          FILM: 0.97,
          LITERATURE: 0.92,
          ARCHITECTURE: 0.90,
          CULINARY: 0.79,
          NIGHTLIFE_DESIGN: 0.76,
        },
        culturalSummary: 'Pocket paperbacks, dappled cedar shade, cassette rituals, and quiet neighborhood counter culture.',
      },
      {
        seedId: 'SEED-TYO-LIT-1',
        qlooEntityUrn: 'urn:entity:book:haruki_murakami_jazz_essays',
        name: 'Murakami Jazz Portraits & Daikanyama Essayists',
        domain: 'LITERATURE',
        creatorOrEra: 'Contemporary Japanese Literary Fiction',
        vibeTags: ['indie-bookshop', 'late-night-listening', 'craft-coffee', 'intimate-counter'],
        tasteWeights: {
          MUSIC: 0.91,
          FILM: 0.82,
          LITERATURE: 0.99,
          ARCHITECTURE: 0.80,
          CULINARY: 0.86,
          NIGHTLIFE_DESIGN: 0.89,
        },
        culturalSummary: 'Rare vinyl liner notes, deep-roast siphon coffee, and subterranean highball counters.',
      },
      {
        seedId: 'SEED-TYO-ARCH-1',
        qlooEntityUrn: 'urn:entity:architect:fumihiko_maki_hillside',
        name: 'Fumihiko Maki Hillside Terrace Modernism',
        domain: 'ARCHITECTURE',
        creatorOrEra: 'Tokyo Metabolist & Human-Scale Modernism',
        vibeTags: ['architectural-serenity', 'brutalist-warmth', 'komorebi-light', 'design-atelier'],
        tasteWeights: {
          MUSIC: 0.76,
          FILM: 0.83,
          LITERATURE: 0.85,
          ARCHITECTURE: 0.99,
          CULINARY: 0.84,
          NIGHTLIFE_DESIGN: 0.82,
        },
        culturalSummary: 'Layered pedestrian plazas, board-formed concrete, and glass-walled book pavilions.',
      },
    ],
    candidateVenues: [
      {
        venueId: 'TYO-MORN-1',
        qlooPlaceUrn: 'urn:entity:place:ogawa_coffee_lab_shimokita',
        hubId: 'HUB-TYO-101',
        stage: 'MORNING',
        windowLabel: '09:00–11:15',
        startHour24: 9,
        durationMinutes: 135,
        name: 'Ogawa Coffee Laboratory Reload',
        neighborhood: 'Shimokitazawa East',
        categoryLabel: 'Bespoke Pour-Over Lab & Concrete Courtyard',
        primaryDomain: 'ARCHITECTURE',
        coordinates: { lat: 35.6602, lng: 139.6775, svgX: 140, svgY: 115 },
        estimatedCostUsd: 18,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['craft-coffee', 'brutalist-warmth', 'architectural-serenity', 'komorebi-light'],
        tasteVector: {
          MUSIC: 0.82,
          FILM: 0.85,
          LITERATURE: 0.84,
          ARCHITECTURE: 0.96,
          CULINARY: 0.90,
          NIGHTLIFE_DESIGN: 0.78,
        },
        qlooCrossDomainLift: 1.24,
        architecturalNote: 'Low-slung whitewashed concrete pavilion along the repurposed Odakyu rail track.',
        signatureHighlight: 'Single-origin anaerobic geisha flight with custom refractometer extraction card.',
      },
      {
        venueId: 'TYO-MID-1',
        qlooPlaceUrn: 'urn:entity:place:bonus_track_b_and_b_books',
        hubId: 'HUB-TYO-101',
        stage: 'MIDDAY',
        windowLabel: '12:00–14:15',
        startHour24: 12,
        durationMinutes: 135,
        name: 'B&B Bookshop & Pianola Records at Bonus Track',
        neighborhood: 'Komaba / Shimokitazawa Greenway',
        categoryLabel: 'Independent Literary & Rare Vinyl Compound',
        primaryDomain: 'LITERATURE',
        coordinates: { lat: 35.6558, lng: 139.6852, svgX: 255, svgY: 165 },
        estimatedCostUsd: 26,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['indie-bookshop', 'analog-vinyl', 'komorebi-light', 'design-atelier'],
        tasteVector: {
          MUSIC: 0.95,
          FILM: 0.89,
          LITERATURE: 0.98,
          ARCHITECTURE: 0.86,
          CULINARY: 0.75,
          NIGHTLIFE_DESIGN: 0.83,
        },
        qlooCrossDomainLift: 1.31,
        architecturalNote: 'Timber-framed pedestrian alley with open-air zine stalls and fermentation kiosks.',
        signatureHighlight: 'Curated Japanese ambient cassette archive and small-press photography folios.',
      },
      {
        venueId: 'TYO-AFT-1',
        qlooPlaceUrn: 'urn:entity:place:daikanyama_tsutaya_hillside',
        hubId: 'HUB-TYO-101',
        stage: 'AFTERNOON',
        windowLabel: '15:00–17:30',
        startHour24: 15,
        durationMinutes: 150,
        name: 'Daikanyama T-Site & Hillside Terrace Gallery Walk',
        neighborhood: 'Daikanyama',
        categoryLabel: 'Interlocking Architectural Pavilions & Film Archive',
        primaryDomain: 'FILM',
        coordinates: { lat: 35.6489, lng: 139.6995, svgX: 430, svgY: 230 },
        estimatedCostUsd: 22,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['architectural-serenity', 'indie-bookshop', 'analog-vinyl', 'design-atelier'],
        tasteVector: {
          MUSIC: 0.89,
          FILM: 0.96,
          LITERATURE: 0.95,
          ARCHITECTURE: 0.98,
          CULINARY: 0.80,
          NIGHTLIFE_DESIGN: 0.85,
        },
        qlooCrossDomainLift: 1.29,
        architecturalNote: 'Klein Dytham perforated GRC facade adjacent to Fumihiko Maki modernist courtyards.',
        signatureHighlight: 'Criterion & Japanese New Wave laserdisc/35mm screening room and architectural monograph lounge.',
      },
      {
        venueId: 'TYO-EVE-1',
        qlooPlaceUrn: 'urn:entity:place:kabi_meguro_fermentation',
        hubId: 'HUB-TYO-101',
        stage: 'EVENING',
        windowLabel: '18:30–20:45',
        startHour24: 18,
        durationMinutes: 135,
        name: 'Kabi Wood-Fired Koji & Botanical Tasting Counter',
        neighborhood: 'Nakameguro / Daikanyama Edge',
        categoryLabel: 'Experimental Fermented & Botanical Counter Dining',
        primaryDomain: 'CULINARY',
        coordinates: { lat: 35.6442, lng: 139.6942, svgX: 555, svgY: 280 },
        estimatedCostUsd: 88,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['intimate-counter', 'brutalist-warmth', 'analog-vinyl', 'minimalist-acoustics'],
        tasteVector: {
          MUSIC: 0.88,
          FILM: 0.84,
          LITERATURE: 0.80,
          ARCHITECTURE: 0.89,
          CULINARY: 0.99,
          NIGHTLIFE_DESIGN: 0.92,
        },
        qlooCrossDomainLift: 1.27,
        architecturalNote: 'Reclaimed PlayStation-era townhouse turned minimalist plaster-and-cedar counter.',
        signatureHighlight: 'Heirloom roasted maitake with aged cedar-koji broth and house-distilled botanical non-alcoholic pairings.',
      },
      {
        venueId: 'TYO-EVE-BUDGET',
        qlooPlaceUrn: 'urn:entity:place:hibou_soba_daikanyama',
        hubId: 'HUB-TYO-101',
        stage: 'EVENING',
        windowLabel: '18:30–20:30',
        startHour24: 18,
        durationMinutes: 120,
        name: 'Yebisu Stone-Milled Soba & Shojin Atelier',
        neighborhood: 'Daikanyama South',
        categoryLabel: 'Artisanal Buckwheat & Plant-Forward Izakaya',
        primaryDomain: 'CULINARY',
        coordinates: { lat: 35.6468, lng: 139.6981, svgX: 525, svgY: 260 },
        estimatedCostUsd: 34,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['intimate-counter', 'architectural-serenity', 'komorebi-light'],
        tasteVector: {
          MUSIC: 0.81,
          FILM: 0.86,
          LITERATURE: 0.83,
          ARCHITECTURE: 0.87,
          CULINARY: 0.95,
          NIGHTLIFE_DESIGN: 0.80,
        },
        qlooCrossDomainLift: 1.19,
        architecturalNote: 'Step-free noren entrance with hand-troweled tsuchikabe earthen walls.',
        signatureHighlight: '100% Nagano juwari buckwheat soba with charred yuzu-kelp dashi and roasted sesame tofu.',
      },
      {
        venueId: 'TYO-LATE-1',
        qlooPlaceUrn: 'urn:entity:place:bar_martha_ebisu_vinyl',
        hubId: 'HUB-TYO-101',
        stage: 'LATE_NIGHT',
        windowLabel: '21:15–23:45',
        startHour24: 21,
        durationMinutes: 150,
        name: 'Studio Mule & Tannoy Horn Listening Sanctuary',
        neighborhood: 'Daikanyama / Shibuya Fringe',
        categoryLabel: 'Custom Altec/Tannoy Hi-Fi Vinyl & Botanical Bar',
        primaryDomain: 'NIGHTLIFE_DESIGN',
        coordinates: { lat: 35.6512, lng: 139.6931, svgX: 685, svgY: 195 },
        estimatedCostUsd: 28,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['analog-vinyl', 'late-night-listening', 'minimalist-acoustics', 'brutalist-warmth'],
        tasteVector: {
          MUSIC: 0.99,
          FILM: 0.87,
          LITERATURE: 0.85,
          ARCHITECTURE: 0.91,
          CULINARY: 0.82,
          NIGHTLIFE_DESIGN: 0.98,
        },
        qlooCrossDomainLift: 1.35,
        architecturalNote: 'Acoustic slatted-ash baffling housing custom McIntosh tube amplifiers and 6,000 LPs.',
        signatureHighlight: 'Uncompressed Japanese jazz/ambient vinyl set with smoked hinoki zero-proof tonic or single-malt.',
      },
    ],
  },
  {
    hubId: 'HUB-NYC-204',
    city: 'New York City',
    corridorName: 'Lower East Side & Dimes Square Arthouse Circuit',
    countryCode: 'US',
    timezone: 'America/New_York',
    currencyCode: 'USD',
    centerCoordinates: { lat: 40.7168, lng: -73.9912 },
    defaultSeedIds: ['SEED-NYC-FILM-1', 'SEED-NYC-MUSIC-1', 'SEED-NYC-LIT-1'],
    editorialTagline:
      '35mm repertory cinema, downtown jazz lofts, small-press zines, and cast-iron tenement bistros.',
    availableSeeds: [
      {
        seedId: 'SEED-NYC-FILM-1',
        qlooEntityUrn: 'urn:entity:movie:jim_jarmusch_downtown_anthology',
        name: 'Jim Jarmusch & Metrograph 35mm Repertory',
        domain: 'FILM',
        creatorOrEra: 'Downtown Independent Cinema',
        vibeTags: ['35mm-cinema', 'downtown-jazz', 'indie-press', 'cast-iron-loft'],
        tasteWeights: {
          MUSIC: 0.91,
          FILM: 0.99,
          LITERATURE: 0.90,
          ARCHITECTURE: 0.84,
          CULINARY: 0.83,
          NIGHTLIFE_DESIGN: 0.92,
        },
        culturalSummary: 'Grainy 35mm nocturnal streetscapes, espresso counters, and avant-garde saxophone scores.',
      },
      {
        seedId: 'SEED-NYC-MUSIC-1',
        qlooEntityUrn: 'urn:entity:artist:john_zorn_stone_downtown',
        name: 'Downtown Improv Jazz & Analog Tape Lofts',
        domain: 'MUSIC',
        creatorOrEra: 'Lower Manhattan Avant-Jazz Lineage',
        vibeTags: ['downtown-jazz', 'analog-vinyl', 'late-night-listening', 'cast-iron-loft'],
        tasteWeights: {
          MUSIC: 0.99,
          FILM: 0.86,
          LITERATURE: 0.84,
          ARCHITECTURE: 0.82,
          CULINARY: 0.79,
          NIGHTLIFE_DESIGN: 0.95,
        },
        culturalSummary: 'Intimate acoustic rooms, hand-stamped white-label LPs, and nocturnal listening salons.',
      },
      {
        seedId: 'SEED-NYC-LIT-1',
        qlooEntityUrn: 'urn:entity:book:joan_didion_new_york_chronicles',
        name: 'New York Review Essayists & Independent Pamphleteers',
        domain: 'LITERATURE',
        creatorOrEra: 'Downtown Literary Nonfiction',
        vibeTags: ['indie-press', '35mm-cinema', 'natural-ferments', 'cast-iron-loft'],
        tasteWeights: {
          MUSIC: 0.80,
          FILM: 0.90,
          LITERATURE: 0.99,
          ARCHITECTURE: 0.87,
          CULINARY: 0.86,
          NIGHTLIFE_DESIGN: 0.84,
        },
        culturalSummary: 'Independent bookstalls, letterpress broadsides, and quiet corner booths.',
      },
    ],
    candidateVenues: [
      {
        venueId: 'NYC-MORN-1',
        qlooPlaceUrn: 'urn:entity:place:abracadabra_roasters_canal',
        hubId: 'HUB-NYC-204',
        stage: 'MORNING',
        windowLabel: '09:00–11:15',
        startHour24: 9,
        durationMinutes: 135,
        name: 'Canal Cast-Iron Espresso & Bakery Collective',
        neighborhood: 'Dimes Square / Canal',
        categoryLabel: 'Sourdough Cardamom Roastery & Public Plaza',
        primaryDomain: 'ARCHITECTURE',
        coordinates: { lat: 40.7145, lng: -73.9918, svgX: 145, svgY: 130 },
        estimatedCostUsd: 19,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['cast-iron-loft', 'indie-press', 'natural-ferments'],
        tasteVector: {
          MUSIC: 0.82,
          FILM: 0.86,
          LITERATURE: 0.88,
          ARCHITECTURE: 0.94,
          CULINARY: 0.91,
          NIGHTLIFE_DESIGN: 0.80,
        },
        qlooCrossDomainLift: 1.22,
        architecturalNote: '1884 cast-iron storefront overlooking the Rutgers Slip cobblestones.',
        signatureHighlight: 'Sprouted rye tahini pastry with single-estate washed Colombian pour-over.',
      },
      {
        venueId: 'NYC-MID-1',
        qlooPlaceUrn: 'urn:entity:place:yu_and_me_books_chinatown_les',
        hubId: 'HUB-NYC-204',
        stage: 'MIDDAY',
        windowLabel: '12:00–14:15',
        startHour24: 12,
        durationMinutes: 135,
        name: 'Mulberry & Essex Independent Book & Zine Salon',
        neighborhood: 'Chinatown / Lower East Side',
        categoryLabel: 'Diaspora Literature, Art Zines & Print Archive',
        primaryDomain: 'LITERATURE',
        coordinates: { lat: 40.7158, lng: -73.9965, svgX: 280, svgY: 175 },
        estimatedCostUsd: 24,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['indie-press', '35mm-cinema', 'cast-iron-loft'],
        tasteVector: {
          MUSIC: 0.84,
          FILM: 0.91,
          LITERATURE: 0.99,
          ARCHITECTURE: 0.86,
          CULINARY: 0.78,
          NIGHTLIFE_DESIGN: 0.82,
        },
        qlooCrossDomainLift: 1.28,
        architecturalNote: 'Step-free ground-floor storefront with floor-to-ceiling cedar bookshelves.',
        signatureHighlight: 'Signed downtown film monographs and small-run risograph art prints.',
      },
      {
        venueId: 'NYC-AFT-1',
        qlooPlaceUrn: 'urn:entity:place:new_museum_bowery_gallery_corridor',
        hubId: 'HUB-NYC-204',
        stage: 'AFTERNOON',
        windowLabel: '15:00–17:30',
        startHour24: 15,
        durationMinutes: 150,
        name: 'Bowery SANAA Mesh Pavilion & Storefront for Art and Architecture',
        neighborhood: 'Bowery / Kenmare',
        categoryLabel: 'Contemporary Architecture & Kinetic Facade Gallery',
        primaryDomain: 'ARCHITECTURE',
        coordinates: { lat: 40.7218, lng: -73.9936, svgX: 435, svgY: 220 },
        estimatedCostUsd: 25,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['cast-iron-loft', 'indie-press', '35mm-cinema'],
        tasteVector: {
          MUSIC: 0.85,
          FILM: 0.90,
          LITERATURE: 0.91,
          ARCHITECTURE: 0.99,
          CULINARY: 0.76,
          NIGHTLIFE_DESIGN: 0.86,
        },
        qlooCrossDomainLift: 1.26,
        architecturalNote: 'Steven Holl & Vito Acconci pivoting puzzle-panel facade paired with SANAA anodized mesh.',
        signatureHighlight: 'Urban acoustics exhibition and rooftop architectural viewing deck.',
      },
      {
        venueId: 'NYC-EVE-1',
        qlooPlaceUrn: 'urn:entity:place:dirt_candy_allen_street',
        hubId: 'HUB-NYC-204',
        stage: 'EVENING',
        windowLabel: '18:30–20:45',
        startHour24: 18,
        durationMinutes: 135,
        name: 'Allen Street Botanical Tasting Room & Ferment Kitchen',
        neighborhood: 'Lower East Side',
        categoryLabel: 'Avant-Garde Vegetable Gastronomy & Zero-Proof Cellar',
        primaryDomain: 'CULINARY',
        coordinates: { lat: 40.7179, lng: -73.9905, svgX: 565, svgY: 265 },
        estimatedCostUsd: 78,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['natural-ferments', 'downtown-jazz', 'cast-iron-loft'],
        tasteVector: {
          MUSIC: 0.86,
          FILM: 0.88,
          LITERATURE: 0.85,
          ARCHITECTURE: 0.88,
          CULINARY: 0.99,
          NIGHTLIFE_DESIGN: 0.91,
        },
        qlooCrossDomainLift: 1.30,
        architecturalNote: 'Luminous open kitchen with step-free terrazzo banquette seating.',
        signatureHighlight: 'Five-course smoked portobello & sea-buckthorn tasting with verjus shrub pairings.',
      },
      {
        venueId: 'NYC-EVE-BUDGET',
        qlooPlaceUrn: 'urn:entity:place:orchard_grocer_delancey_table',
        hubId: 'HUB-NYC-204',
        stage: 'EVENING',
        windowLabel: '18:30–20:15',
        startHour24: 18,
        durationMinutes: 105,
        name: 'Orchard Street Heritage Appetizing & Hearth Counter',
        neighborhood: 'Lower East Side',
        categoryLabel: 'Artisanal Plant-Based Delicatessen & Supper Counter',
        primaryDomain: 'CULINARY',
        coordinates: { lat: 40.7166, lng: -73.9898, svgX: 540, svgY: 250 },
        estimatedCostUsd: 32,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['natural-ferments', 'indie-press', 'cast-iron-loft'],
        tasteVector: {
          MUSIC: 0.82,
          FILM: 0.85,
          LITERATURE: 0.87,
          ARCHITECTURE: 0.84,
          CULINARY: 0.94,
          NIGHTLIFE_DESIGN: 0.82,
        },
        qlooCrossDomainLift: 1.18,
        architecturalNote: 'Classic checkerboard tile storefront with step-free street access.',
        signatureHighlight: 'House-smoked carrot lox on gluten-free seeded bialy with fermented dill tonic.',
      },
      {
        venueId: 'NYC-LATE-1',
        qlooPlaceUrn: 'urn:entity:place:metrograph_ludlow_screening_lounge',
        hubId: 'HUB-NYC-204',
        stage: 'LATE_NIGHT',
        windowLabel: '21:15–23:45',
        startHour24: 21,
        durationMinutes: 150,
        name: 'Metrograph 35mm Commissary & Ludlow Hi-Fi Listening Room',
        neighborhood: 'Lower East Side South',
        categoryLabel: 'Repertory 35mm Cinema & Analog Vinyl Listening Lounge',
        primaryDomain: 'FILM',
        coordinates: { lat: 40.7135, lng: -73.9911, svgX: 690, svgY: 190 },
        estimatedCostUsd: 29,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['35mm-cinema', 'downtown-jazz', 'analog-vinyl', 'late-night-listening'],
        tasteVector: {
          MUSIC: 0.96,
          FILM: 0.99,
          LITERATURE: 0.91,
          ARCHITECTURE: 0.89,
          CULINARY: 0.84,
          NIGHTLIFE_DESIGN: 0.98,
        },
        qlooCrossDomainLift: 1.36,
        architecturalNote: 'Repurposed 1920s warehouse cinema with custom Klipschorn acoustic lounge.',
        signatureHighlight: 'Late-night archival 35mm print screening followed by vinyl jazz set & bitter amaro spritz.',
      },
    ],
  },
  {
    hubId: 'HUB-PAR-309',
    city: 'Paris',
    corridorName: 'Canal Saint-Martin & Haut-Marais Atelier Promenade',
    countryCode: 'FR',
    timezone: 'Europe/Paris',
    currencyCode: 'USD',
    centerCoordinates: { lat: 48.8672, lng: 2.3638 },
    defaultSeedIds: ['SEED-PAR-FILM-1', 'SEED-PAR-LIT-1', 'SEED-PAR-MUSIC-1'],
    editorialTagline:
      'Nouvelle Vague iron footbridges, courtyard architectural bookshops, neo-bistro tables, and synth-jazz caves.',
    availableSeeds: [
      {
        seedId: 'SEED-PAR-FILM-1',
        qlooEntityUrn: 'urn:entity:movie:agnes_varda_cleo_from_5_to_7',
        name: 'Agnès Varda & Nouvelle Vague Street Flânerie',
        domain: 'FILM',
        creatorOrEra: 'French New Wave Real-Time Cinema',
        vibeTags: ['nouvelle-vague', 'courtyard-atelier', 'left-bank-essays', 'canal-promenade'],
        tasteWeights: {
          MUSIC: 0.86,
          FILM: 0.99,
          LITERATURE: 0.94,
          ARCHITECTURE: 0.91,
          CULINARY: 0.85,
          NIGHTLIFE_DESIGN: 0.88,
        },
        culturalSummary: 'Real-time Parisian walks across iron footbridges, zinc cafés, and sunlit studios.',
      },
      {
        seedId: 'SEED-PAR-LIT-1',
        qlooEntityUrn: 'urn:entity:book:georges_perec_species_of_spaces',
        name: 'Georges Perec & Oulipo Urban Observation',
        domain: 'LITERATURE',
        creatorOrEra: 'Parisian Spatial Literature',
        vibeTags: ['left-bank-essays', 'courtyard-atelier', 'canal-promenade', 'art-monographs'],
        tasteWeights: {
          MUSIC: 0.80,
          FILM: 0.91,
          LITERATURE: 0.99,
          ARCHITECTURE: 0.93,
          CULINARY: 0.82,
          NIGHTLIFE_DESIGN: 0.81,
        },
        culturalSummary: 'Cataloging architectural details, hidden passages, and independent art publishers.',
      },
      {
        seedId: 'SEED-PAR-MUSIC-1',
        qlooEntityUrn: 'urn:entity:artist:air_french_touch_analog',
        name: 'Air & French Touch Rhodes Analog Synthesizers',
        domain: 'MUSIC',
        creatorOrEra: 'Parisian Analog Synth & Jazz-Pop',
        vibeTags: ['analog-vinyl', 'nouvelle-vague', 'late-night-listening', 'botanical-aperitif'],
        tasteWeights: {
          MUSIC: 0.99,
          FILM: 0.89,
          LITERATURE: 0.82,
          ARCHITECTURE: 0.86,
          CULINARY: 0.84,
          NIGHTLIFE_DESIGN: 0.96,
        },
        culturalSummary: 'Fender Rhodes warmth, vintage Moog filters, and candlelit listening bars.',
      },
    ],
    candidateVenues: [
      {
        venueId: 'PAR-MORN-1',
        qlooPlaceUrn: 'urn:entity:place:ten_belles_canal_roastery',
        hubId: 'HUB-PAR-309',
        stage: 'MORNING',
        windowLabel: '09:00–11:15',
        startHour24: 9,
        durationMinutes: 135,
        name: 'Quai de Valmy Roastery & Iron Footbridge Terrace',
        neighborhood: 'Canal Saint-Martin',
        categoryLabel: 'Specialty Micro-Roastery & Canal Quayside',
        primaryDomain: 'CULINARY',
        coordinates: { lat: 48.8721, lng: 2.3646, svgX: 150, svgY: 120 },
        estimatedCostUsd: 17,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['canal-promenade', 'nouvelle-vague', 'left-bank-essays'],
        tasteVector: {
          MUSIC: 0.83,
          FILM: 0.91,
          LITERATURE: 0.89,
          ARCHITECTURE: 0.90,
          CULINARY: 0.93,
          NIGHTLIFE_DESIGN: 0.79,
        },
        qlooCrossDomainLift: 1.23,
        architecturalNote: 'Step-free cobblestone quayside beside the 19th-century Venetian locks.',
        signatureHighlight: 'Buckwheat pain au levain with single-estate Ethiopian filter coffee.',
      },
      {
        venueId: 'PAR-MID-1',
        qlooPlaceUrn: 'urn:entity:place:yvon_lambert_bookshop_marais',
        hubId: 'HUB-PAR-309',
        stage: 'MIDDAY',
        windowLabel: '12:00–14:15',
        startHour24: 12,
        durationMinutes: 135,
        name: 'Yvon Lambert Art Bookshop & Exhibition Courtyard',
        neighborhood: 'Haut-Marais',
        categoryLabel: 'Rare Artist Editions, Catalogues Raisonné & Gallery',
        primaryDomain: 'LITERATURE',
        coordinates: { lat: 48.8648, lng: 2.3642, svgX: 290, svgY: 180 },
        estimatedCostUsd: 24,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['art-monographs', 'courtyard-atelier', 'left-bank-essays', 'nouvelle-vague'],
        tasteVector: {
          MUSIC: 0.85,
          FILM: 0.94,
          LITERATURE: 0.99,
          ARCHITECTURE: 0.92,
          CULINARY: 0.78,
          NIGHTLIFE_DESIGN: 0.83,
        },
        qlooCrossDomainLift: 1.32,
        architecturalNote: 'Paved 17th-century Marais courtyard leading to a vaulted daylight gallery.',
        signatureHighlight: 'Limited lithographs, Nouvelle Vague screenplays, and sound-art vinyl pressings.',
      },
      {
        venueId: 'PAR-AFT-1',
        qlooPlaceUrn: 'urn:entity:place:lafayette_anticipations_oma_marais',
        hubId: 'HUB-PAR-309',
        stage: 'AFTERNOON',
        windowLabel: '15:00–17:30',
        startHour24: 15,
        durationMinutes: 150,
        name: 'Fondation OMA Kinetic Tower & Archives Nationales Garden',
        neighborhood: 'Le Marais',
        categoryLabel: 'Kinetic Architectural Exhibition Tower & Walled Gardens',
        primaryDomain: 'ARCHITECTURE',
        coordinates: { lat: 48.8592, lng: 2.3558, svgX: 445, svgY: 235 },
        estimatedCostUsd: 20,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['courtyard-atelier', 'art-monographs', 'nouvelle-vague'],
        tasteVector: {
          MUSIC: 0.84,
          FILM: 0.90,
          LITERATURE: 0.91,
          ARCHITECTURE: 0.99,
          CULINARY: 0.80,
          NIGHTLIFE_DESIGN: 0.86,
        },
        qlooCrossDomainLift: 1.27,
        architecturalNote: 'Rem Koolhaas / OMA motorized exhibition floors set inside an 1891 courtyard.',
        signatureHighlight: 'Motorized steel gallery platform overlooking historic Marais limestone roofs.',
      },
      {
        venueId: 'PAR-EVE-1',
        qlooPlaceUrn: 'urn:entity:place:faubourg_daimant_vegetable_bistro',
        hubId: 'HUB-PAR-309',
        stage: 'EVENING',
        windowLabel: '18:30–20:45',
        startHour24: 18,
        durationMinutes: 135,
        name: 'Atelier Roussillon Botanical Neo-Bistro',
        neighborhood: 'Haut-Marais / République',
        categoryLabel: 'Haute-Botanical French Neo-Bistro & Elixir Cellar',
        primaryDomain: 'CULINARY',
        coordinates: { lat: 48.8634, lng: 2.3621, svgX: 575, svgY: 270 },
        estimatedCostUsd: 74,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['botanical-aperitif', 'courtyard-atelier', 'nouvelle-vague'],
        tasteVector: {
          MUSIC: 0.87,
          FILM: 0.90,
          LITERATURE: 0.86,
          ARCHITECTURE: 0.89,
          CULINARY: 0.99,
          NIGHTLIFE_DESIGN: 0.91,
        },
        qlooCrossDomainLift: 1.29,
        architecturalNote: 'Glass-roofed winter garden with step-free limestone dining salon.',
        signatureHighlight: 'Charred Cévennes onion mille-feuille with black truffle reduction and dealcoholized Chenin.',
      },
      {
        venueId: 'PAR-EVE-BUDGET',
        qlooPlaceUrn: 'urn:entity:place:march_des_enfants_rouges_table',
        hubId: 'HUB-PAR-309',
        stage: 'EVENING',
        windowLabel: '18:30–20:15',
        startHour24: 18,
        durationMinutes: 105,
        name: 'Enfants Rouges Historic Covered Market Table',
        neighborhood: 'Haut-Marais',
        categoryLabel: '1615 Covered Market Artisanal Plant & Grain Counter',
        primaryDomain: 'CULINARY',
        coordinates: { lat: 48.8628, lng: 2.3629, svgX: 545, svgY: 255 },
        estimatedCostUsd: 30,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['canal-promenade', 'courtyard-atelier', 'botanical-aperitif'],
        tasteVector: {
          MUSIC: 0.81,
          FILM: 0.88,
          LITERATURE: 0.86,
          ARCHITECTURE: 0.88,
          CULINARY: 0.95,
          NIGHTLIFE_DESIGN: 0.82,
        },
        qlooCrossDomainLift: 1.19,
        architecturalNote: 'Oldest covered market in Paris with step-free timber arcade stalls.',
        signatureHighlight: 'Brittany organic sarrasin galette with roasted chanterelles and sparkling apple-verbena must.',
      },
      {
        venueId: 'PAR-LATE-1',
        qlooPlaceUrn: 'urn:entity:place:bambou_frequence_vinyl_bastille',
        hubId: 'HUB-PAR-309',
        stage: 'LATE_NIGHT',
        windowLabel: '21:15–23:45',
        startHour24: 21,
        durationMinutes: 150,
        name: 'Fréquence Klipschorn Vinyl & Botanical Listening Cave',
        neighborhood: 'Bastille / Marais East',
        categoryLabel: 'Audiophile Vinyl Bar & Zero-Proof Botanical Apothecary',
        primaryDomain: 'NIGHTLIFE_DESIGN',
        coordinates: { lat: 48.8565, lng: 2.3712, svgX: 695, svgY: 195 },
        estimatedCostUsd: 27,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['analog-vinyl', 'late-night-listening', 'botanical-aperitif', 'nouvelle-vague'],
        tasteVector: {
          MUSIC: 0.99,
          FILM: 0.90,
          LITERATURE: 0.84,
          ARCHITECTURE: 0.88,
          CULINARY: 0.86,
          NIGHTLIFE_DESIGN: 0.98,
        },
        qlooCrossDomainLift: 1.34,
        architecturalNote: 'Warm walnut acoustic paneling with rotary mixer booth and step-free lounge.',
        signatureHighlight: 'French Touch & library-funk 45rpm sets paired with gentian-fig botanical highballs.',
      },
    ],
  },
  {
    hubId: 'HUB-CDMX-412',
    city: 'Mexico City',
    corridorName: 'Roma Norte & Condesa Art Deco Botanical Circuit',
    countryCode: 'MX',
    timezone: 'America/Mexico_City',
    currencyCode: 'USD',
    centerCoordinates: { lat: 19.4162, lng: -99.1668 },
    defaultSeedIds: ['SEED-CDMX-ARCH-1', 'SEED-CDMX-FILM-1', 'SEED-CDMX-MUSIC-1'],
    editorialTagline:
      'Barragán-inspired volcanic stone patios, jacaranda parks, heirloom corn cocina, and tropical vinyl salons.',
    availableSeeds: [
      {
        seedId: 'SEED-CDMX-ARCH-1',
        qlooEntityUrn: 'urn:entity:architect:luis_barragan_emotional_architecture',
        name: 'Luis Barragán Emotional Architecture & Volcanic Stone',
        domain: 'ARCHITECTURE',
        creatorOrEra: 'Mexican Modernism & Chromatic Courtyards',
        vibeTags: ['volcanic-courtyard', 'art-deco-promenade', 'sculpture-salon', 'botanical-patio'],
        tasteWeights: {
          MUSIC: 0.81,
          FILM: 0.89,
          LITERATURE: 0.88,
          ARCHITECTURE: 0.99,
          CULINARY: 0.86,
          NIGHTLIFE_DESIGN: 0.87,
        },
        culturalSummary: 'Pink and ochre stucco planes, reflecting water basins, and hand-carved tezontle stone.',
      },
      {
        seedId: 'SEED-CDMX-FILM-1',
        qlooEntityUrn: 'urn:entity:movie:alfonso_cuaron_roma_chronicle',
        name: 'Roma & Nuevo Cine Mexicano 65mm Cinematography',
        domain: 'FILM',
        creatorOrEra: 'Contemporary Mexican Arthouse Cinema',
        vibeTags: ['art-deco-promenade', 'volcanic-courtyard', 'latin-vinyl', 'heirloom-maiz'],
        tasteWeights: {
          MUSIC: 0.87,
          FILM: 0.99,
          LITERATURE: 0.92,
          ARCHITECTURE: 0.93,
          CULINARY: 0.89,
          NIGHTLIFE_DESIGN: 0.85,
        },
        culturalSummary: 'Deep-focus black-and-white courtyards, neighborhood cinemas, and street-level sonic textures.',
      },
      {
        seedId: 'SEED-CDMX-MUSIC-1',
        qlooEntityUrn: 'urn:entity:artist:natalia_lafourcade_bolero_folklore',
        name: 'Son Jarocho, Psych-Cumbia & Analog Bolero Pressings',
        domain: 'MUSIC',
        creatorOrEra: 'Latin American Acoustic & Vinyl Revival',
        vibeTags: ['latin-vinyl', 'late-night-listening', 'botanical-patio', 'heirloom-maiz'],
        tasteWeights: {
          MUSIC: 0.99,
          FILM: 0.88,
          LITERATURE: 0.86,
          ARCHITECTURE: 0.84,
          CULINARY: 0.90,
          NIGHTLIFE_DESIGN: 0.96,
        },
        culturalSummary: 'Warm nylon-string requinto guitars, vintage cumbia 45s, and candlelit rooftop salons.',
      },
    ],
    candidateVenues: [
      {
        venueId: 'CDMX-MORN-1',
        qlooPlaceUrn: 'urn:entity:place:panaderia_rosetta_colima_patio',
        hubId: 'HUB-CDMX-412',
        stage: 'MORNING',
        windowLabel: '09:00–11:15',
        startHour24: 9,
        durationMinutes: 135,
        name: 'Calle Colima Botanical Bakery & Chiapas Roastery',
        neighborhood: 'Roma Norte',
        categoryLabel: 'Porfiriato Townhouse Bakery & Specialty Coffee Patio',
        primaryDomain: 'CULINARY',
        coordinates: { lat: 19.4198, lng: -99.1602, svgX: 155, svgY: 125 },
        estimatedCostUsd: 16,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['botanical-patio', 'volcanic-courtyard', 'heirloom-maiz'],
        tasteVector: {
          MUSIC: 0.83,
          FILM: 0.89,
          LITERATURE: 0.86,
          ARCHITECTURE: 0.92,
          CULINARY: 0.96,
          NIGHTLIFE_DESIGN: 0.80,
        },
        qlooCrossDomainLift: 1.25,
        architecturalNote: 'Restored 1910 Roma masonry facade with step-free fern courtyard.',
        signatureHighlight: 'Hoja santa & heirloom corn tamal with high-altitude Sierra Madre washed espresso.',
      },
      {
        venueId: 'CDMX-MID-1',
        qlooPlaceUrn: 'urn:entity:place:casa_bosques_cordoba_books',
        hubId: 'HUB-CDMX-412',
        stage: 'MIDDAY',
        windowLabel: '12:00–14:15',
        startHour24: 12,
        durationMinutes: 135,
        name: 'Casa Bosques Art Bookstore & Savvy Cacao Atelier',
        neighborhood: 'Roma Norte',
        categoryLabel: 'Architectural Monograph Bookshop & Single-Origin Cacao Lab',
        primaryDomain: 'LITERATURE',
        coordinates: { lat: 19.4212, lng: -99.1585, svgX: 295, svgY: 170 },
        estimatedCostUsd: 21,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['sculpture-salon', 'volcanic-courtyard', 'botanical-patio'],
        tasteVector: {
          MUSIC: 0.85,
          FILM: 0.91,
          LITERATURE: 0.99,
          ARCHITECTURE: 0.96,
          CULINARY: 0.86,
          NIGHTLIFE_DESIGN: 0.83,
        },
        qlooCrossDomainLift: 1.30,
        architecturalNote: 'Sunlit courtyard lined with raw pine shelving and volcanic basalt tables.',
        signatureHighlight: 'Latin American architecture folios paired with ceremonial Tabascan cacao flight.',
      },
      {
        venueId: 'CDMX-AFT-1',
        qlooPlaceUrn: 'urn:entity:place:parque_mexico_omr_gallery_walk',
        hubId: 'HUB-CDMX-412',
        stage: 'AFTERNOON',
        windowLabel: '15:00–17:30',
        startHour24: 15,
        durationMinutes: 150,
        name: 'Parque México Art Deco Forum & Galería OMR Sculpture Courtyard',
        neighborhood: 'Condesa / Roma Border',
        categoryLabel: '1927 Art Deco Amphitheater & Brutalist Contemporary Gallery',
        primaryDomain: 'ARCHITECTURE',
        coordinates: { lat: 19.4125, lng: -99.1694, svgX: 440, svgY: 225 },
        estimatedCostUsd: 18,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['art-deco-promenade', 'volcanic-courtyard', 'sculpture-salon'],
        tasteVector: {
          MUSIC: 0.86,
          FILM: 0.95,
          LITERATURE: 0.90,
          ARCHITECTURE: 0.99,
          CULINARY: 0.78,
          NIGHTLIFE_DESIGN: 0.85,
        },
        qlooCrossDomainLift: 1.28,
        architecturalNote: 'Leonardo Noriega 1927 Art Deco pergolas leading to OMR cast-concrete gallery.',
        signatureHighlight: 'Sound-sculpture installation and shaded jacaranda botanical promenade.',
      },
      {
        venueId: 'CDMX-EVE-1',
        qlooPlaceUrn: 'urn:entity:place:masala_y_maiz_expendio_roma',
        hubId: 'HUB-CDMX-412',
        stage: 'EVENING',
        windowLabel: '18:30–20:45',
        startHour24: 18,
        durationMinutes: 135,
        name: 'Molino Nixtamal & Wood-Fired Botanical Cocina',
        neighborhood: 'Condesa',
        categoryLabel: 'Heirloom Landrace Corn & Botanical Wood-Fired Kitchen',
        primaryDomain: 'CULINARY',
        coordinates: { lat: 19.4108, lng: -99.1722, svgX: 570, svgY: 268 },
        estimatedCostUsd: 68,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['heirloom-maiz', 'volcanic-courtyard', 'botanical-patio'],
        tasteVector: {
          MUSIC: 0.87,
          FILM: 0.90,
          LITERATURE: 0.85,
          ARCHITECTURE: 0.91,
          CULINARY: 0.99,
          NIGHTLIFE_DESIGN: 0.90,
        },
        qlooCrossDomainLift: 1.31,
        architecturalNote: 'Open basalt hearth with step-free terracotta courtyard.',
        signatureHighlight: 'Blue Oaxacan tetela with roasted huitlacoche, chilhuacle mole, and tepache shrub.',
      },
      {
        venueId: 'CDMX-EVE-BUDGET',
        qlooPlaceUrn: 'urn:entity:place:tacos_hola_el_guero_condesa',
        hubId: 'HUB-CDMX-412',
        stage: 'EVENING',
        windowLabel: '18:30–20:15',
        startHour24: 18,
        durationMinutes: 105,
        name: 'Comal Tortillería & Heirloom Guisado Counter',
        neighborhood: 'Condesa',
        categoryLabel: 'Heritage Plant-Based Guisados & Nixtamal Comal',
        primaryDomain: 'CULINARY',
        coordinates: { lat: 19.4119, lng: -99.1711, svgX: 542, svgY: 252 },
        estimatedCostUsd: 26,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['heirloom-maiz', 'art-deco-promenade', 'botanical-patio'],
        tasteVector: {
          MUSIC: 0.83,
          FILM: 0.88,
          LITERATURE: 0.84,
          ARCHITECTURE: 0.86,
          CULINARY: 0.95,
          NIGHTLIFE_DESIGN: 0.81,
        },
        qlooCrossDomainLift: 1.20,
        architecturalNote: 'Step-free open comal counter shaded by mature ficus trees.',
        signatureHighlight: 'Hand-pressed Chalco red corn tortillas with squash-blossom & hibiscus agua fresca.',
      },
      {
        venueId: 'CDMX-LATE-1',
        qlooPlaceUrn: 'urn:entity:place:tokyo_music_bar_salon_rosetta',
        hubId: 'HUB-CDMX-412',
        stage: 'LATE_NIGHT',
        windowLabel: '21:15–23:45',
        startHour24: 21,
        durationMinutes: 150,
        name: 'Audiofila Condesa Vinyl Salon & Botanical Mezcalería',
        neighborhood: 'Condesa / Río Panuco',
        categoryLabel: 'Hi-Fi Latin Vinyl Listening Lounge & Agave Botanical Bar',
        primaryDomain: 'NIGHTLIFE_DESIGN',
        coordinates: { lat: 19.4148, lng: -99.1675, svgX: 690, svgY: 192 },
        estimatedCostUsd: 25,
        stepFreeAccess: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER', 'ZERO_PROOF'],
        vibeTags: ['latin-vinyl', 'late-night-listening', 'botanical-patio', 'volcanic-courtyard'],
        tasteVector: {
          MUSIC: 0.99,
          FILM: 0.89,
          LITERATURE: 0.85,
          ARCHITECTURE: 0.90,
          CULINARY: 0.86,
          NIGHTLIFE_DESIGN: 0.98,
        },
        qlooCrossDomainLift: 1.35,
        architecturalNote: 'Custom cedar horn speakers with step-free courtyard lounge and warm amber lighting.',
        signatureHighlight: '1970s psych-cumbia & bolero vinyl selectors with smoked copal zero-proof agave elixir.',
      },
    ],
  },
];

export function getCulturalHubById(hubId: string): CulturalHubPreset {
  const found = GLOBAL_CULTURAL_HUBS.find((h) => h.hubId === hubId);
  return found ?? GLOBAL_CULTURAL_HUBS[0];
}
