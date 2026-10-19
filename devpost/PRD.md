# Product Requirements Document (PRD) — VibeAtlas: Qloo Cross-Domain Cultural Curator

## 1. Problem Statement
Travelers and local explorers rarely discover neighborhoods through generic star ratings. A listener drawn to Ryuichi Sakamoto's ambient minimalism, Wim Wenders' *Perfect Days*, and Fumihiko Maki's modernist concrete architecture wants a cohesive **Day-to-Night neighborhood arc**—not a list of tourist traps. Existing LLM travel planners hallucinate distances, ignore budget ceilings, drop dietary/step-free constraints, and lack grounded cross-domain cultural taste data.

## 2. Solution Overview
**VibeAtlas** pairs **Qloo Taste AI** (`/v2/entities`, `/v2/tags`, `/v2/insights`) with a deterministic **Geodesic Day-to-Night Constraint Solver**:
- **6-Domain Cultural Taste Synthesis**: Bridges `MUSIC`, `FILM`, `LITERATURE`, `ARCHITECTURE`, `CULINARY`, and `NIGHTLIFE_DESIGN` into explainable venue recommendations.
- **5-Stage Chronological Sequencing**: Guarantees a natural progression (`MORNING` -> `MIDDAY` -> `AFTERNOON` -> `EVENING` -> `LATE_NIGHT`).
- **Hard Physical & Dietary Guardrails**: Enforces Haversine walkability limits, full-day per-person budget ceilings, step-free wheelchair routing, and dietary compliance (`VEGAN`, `GLUTEN_FREE`, `HALAL`, `KOSHER`, `ZERO_PROOF`).
- **Privacy-First Zero-PII Sanitizer**: Automatically redacts emails, phone numbers, payment cards, passport IDs, and hotel room numbers before constructing Qloo API queries.

## 3. Target Users
- **Independent Cultural Travelers**: Curating walkable, authentic neighborhood days anchored by their favorite films, records, and books.
- **Boutique Hospitality Concierges**: Issuing attested, constraint-verified GeoJSON and `.ics` itineraries for guests with strict dietary or accessibility needs.

- **Qloo Taste AI v2 `GET /v2/insights` Explainability Contract (`QLOO_API_SPEC`)**: Exposes the exact `filter.type=urn:entity:place`, `signal.interests.entities`, `signal.interests.tags`, and `feature.explainability=true` query parameters with zero-PII headers.
