# 🌍🎵 Qloo Agentic Hackathon — Complete Devpost Submission Package

**Project Title:** VibeAtlas — Qloo Cross-Domain Cultural Taste & Geodesic Day-to-Night Itinerary Curator  
**Tagline (<= 60 chars):** Qloo cross-domain taste graph & geodesic itinerary solver.  
**Competition:** Qloo Agentic Hackathon (`$25,000` Prize Pool)  
**Local Studio Port:** `http://127.0.0.1:5186` (`strictPort: true`)

---

## 1. Inspiration

Travelers and neighborhood explorers rarely discover meaningful places through generic 5-star review averages. A listener drawn to Ryuichi Sakamoto's ambient minimalism, Wim Wenders' *Perfect Days*, and Fumihiko Maki's modernist architecture wants a cohesive **Day-to-Night neighborhood arc**—not a disconnected list of tourist traps. Worse, unconstrained LLM travel planners hallucinate walking distances, bust budgets, and ignore wheelchair step-free or dietary requirements. We built **VibeAtlas** to pair **Qloo Taste AI v2 (`GET /v2/insights`)** with a deterministic **5-Stage Geodesic & Hard-Constraint Solver**.

---

## 2. What It Does

1. **Qloo 6-Domain Cultural Taste Graph & Zero-PII Sanitizer (`qloo-taste-graph.ts`)**:
   - Bridges 6 cultural domains (`MUSIC`, `FILM`, `LITERATURE`, `ARCHITECTURE`, `CULINARY`, `NIGHTLIFE_DESIGN`) across 4 global cultural corridors (**Tokyo: Shimokitazawa & Daikanyama**, **NYC: Lower East Side & Dimes Square**, **Paris: Canal Saint-Martin & Le Marais**, **Mexico City: Roma Norte & Condesa**).
   - Computes 6D cosine affinity blended with Jaccard tag overlap and Qloo Cross-Domain Lift (`urn:entity:artist`, `urn:entity:movie`, `urn:entity:book` ➔ `urn:entity:place`) after scrubbing all traveler PII (`scrubTastePromptPii`).
2. **5-Stage Day-to-Night Geodesic & Budget Constraint Solver (`day-to-night-itinerary-solver.ts`)**:
   - Sequences `MORNING` ➔ `MIDDAY` ➔ `AFTERNOON` ➔ `EVENING` ➔ `LATE_NIGHT` while enforcing urban Haversine walking limits, full-day per-person budget ceilings (`$95–$320`), step-free wheelchair accessibility, and strict dietary filters (`VEGAN`, `GLUTEN_FREE`, `HALAL`, `KOSHER`, `ZERO_PROOF`).
3. **Qloo `/v2/insights` Inspector, RFC 7946 GeoJSON & RFC 5545 `.ics` Exporter**:
   - Exports standards-compliant **RFC 7946 `[longitude, latitude]` GeoJSON**, **RFC 5545 iCalendar (`.ics`)**, **Markdown Concierge Passports**, and the live **Qloo Taste AI v2 `GET /v2/insights` Request Specification (`QLOO_API_SPEC`)** sealed with an FNV-1a-32 signature (`VBA-QLOO-...`).

---

## 3. How We Built It

- **4 Pure-Math Cultural & Geodesic Modules (`src/lib/`)**: Verified by **6/6 automated verification gates (`npm test`, `~80ms`)** with `0` TypeScript errors.
- **Dual SVG Visualization Studio**: Renders both the **Neighborhood Geodesic Route Canvas** and the **6-Axis Qloo Cross-Domain Taste Radar** in real time.

---

## 4. Challenges We Ran Into & Accomplishments

- **Dynamic Venue Down-Tiering Without Breaking Cultural Affinity**: When a user lowers their full-day budget ceiling from `$220` to `$110` or enables **Step-Free Wheelchair Access**, our solver dynamically swaps out over-budget or stepped venues for the highest-Qloo-affinity compliant alternative in the same time slot while maintaining the Haversine walk radius.

---

## 5. "Built With" Tags

`qloo-taste-ai`, `agentic-ai`, `cross-domain-recommendations`, `geojson-rfc7946`, `icalendar-rfc5545`, `haversine-routing`, `typescript`, `react`, `svg`

---

## 6. 90-Second Demo Video Narration Script

- **`0:00 – 0:25` · Qloo Cross-Domain Seeds & 6-Axis Taste Radar**:
  - *Visual*: Open `http://127.0.0.1:5186`. Select **Tokyo (Shimokitazawa & Daikanyama)**, toggle cultural seeds (*Ryuichi Sakamoto*, *Perfect Days*, *Kengo Kuma*), and watch the **6-Axis Qloo Cross-Domain Radar** and **Geodesic Route Canvas** update live.
- **`0:25 – 0:55` · Budget Ceiling, Step-Free Access & Dietary Dynamic Substitution**:
  - *Visual*: Lower the **Max Daily Budget** slider and toggle **Step-Free Wheelchair Access** + **Vegan/Zero-Proof** filters to demonstrate automatic venue substitution with `100%` constraint satisfaction.
- **`0:55 – 1:30` · `QLOO_API_SPEC` (`/v2/insights`), GeoJSON & `.ics` Concierge Seal**:
  - *Visual*: Click **Seal Concierge Passport (`VBA-QLOO-...`)** and switch across the **GeoJSON (RFC 7946)**, **iCal (`.ics`)**, **Markdown Passport**, and **Qloo `/v2/insights` API Spec (`QLOO_API_SPEC`)** tabs.
