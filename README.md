# VibeAtlas · Cross-Domain Cultural Taste Itinerary & Neighborhood Curator

**Hackathon Track**: Qloo Agentic Hackathon (`$25,000`)  
**Local Studio Port**: `http://127.0.0.1:5186` (`strictPort: true`)

VibeAtlas transforms **Qloo Taste AI** cross-domain cultural entity graphs (`Music`, `Film`, `Literature`, `Architecture`, `Culinary`, and `Nightlife/Design`) into walkable, budget-verified, 5-stage **Day-to-Night Neighborhood Itineraries**.

---

## Key Capabilities

1. **Cross-Domain Qloo Taste Graph (`src/lib/taste/qloo-taste-graph.ts`)**:
   - Curates 4 global cultural corridors (**Tokyo: Shimokitazawa & Daikanyama**, **NYC: Lower East Side & Dimes Square**, **Paris: Canal Saint-Martin & Le Marais**, and **Mexico City: Roma Norte & Condesa**).
   - Computes 6-dimensional cosine affinity blended with Jaccard tag resonance and Qloo Cross-Domain Lift multipliers (`urn:entity:artist`, `urn:entity:movie`, `urn:entity:book` -> `urn:entity:place`).
   - Scrubs all traveler PII (`scrubTastePromptPii`) before any external entity resolution.
2. **Geodesic Walkability & Hard Constraint Solver (`src/lib/routing/day-to-night-itinerary-solver.ts`)**:
   - Sequences a 5-stage chronological arc (`MORNING`, `MIDDAY`, `AFTERNOON`, `EVENING`, `LATE_NIGHT`).
   - Enforces Haversine pedestrian walk radii, per-person full-day budget ceilings (`$95–$320`), step-free wheelchair accessibility, and strict dietary filters (`VEGAN`, `GLUTEN_FREE`, `HALAL`, `KOSHER`, `ZERO_PROOF`).
3. **RFC 7946 GeoJSON & RFC 5545 iCal Exporter (`src/lib/export/concierge-passport-exporter.ts`)**:
   - Exports `[longitude, latitude]` GeoJSON `FeatureCollection` routes, `.ics` calendar events, and Markdown Concierge Passports.
4. **4-Stage Qloo Agentic Curator & FNV-1a Concierge Seal (`src/lib/qloo/qloo-agentic-supervisor.ts`)**:
   - Orchestrates live `/v2/insights` calls with a `4.5s` `AbortController` circuit breaker fallback and cryptographic FNV-1a-32 attestation lock.

---

## Quick Verification Commands

```bash
# Run 6/6 Verification Gates
npm test

# Typecheck & Build Production Bundle
npm run build

# Launch Interactive Studio on Port 5186
npm run dev
```
