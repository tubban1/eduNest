# AI Education Innovation Radar — Demonstrator Implementation

## Boundary
This module implements only the BeLEARN Booster project scope. It lives inside the eduNest repository for infrastructure reuse, but does not integrate with eduNest learning content, users, payments, course generation or other product features.

## Research-product flow
SCAN → STRUCTURE → LOCATE → ASSESS → CONNECT → TRANSLATE → HUMAN REVIEW

The demonstrator intentionally avoids a single ranking score. Novelty, maturity, evidence, educational relevance, contextual dependence and transferability remain separate, inspectable dimensions.

## Architecture
- `apps/radar`: standalone Next.js application, independently deployable to `radar.edunest.app`.
- Existing Supabase project may be reused only as infrastructure. Radar data is isolated in `radar_*` tables.
- `/mcp`: read-oriented MCP interface for search, latest signals and structured profiles.
- Future ingestion workers can use Cloudflare without changing the web application.

## Booster deliverables represented
1. Source architecture and monitoring workflow: `radar_sources` plus future ingestion pipeline.
2. Assessment and localisation framework: structured signal fields for novelty, maturity, evidence and geography.
3. Innovation Map and Radar prototype: `/`, `/signals`, `/clusters`, `/innovation/[id]`.
4. Practitioner evaluation: `radar_reviews` supports later educator review without coupling to eduNest accounts.

## Non-goals for this demonstrator
- No eduNest course/content linkage.
- No automated recommendation claim.
- No single innovation score or leaderboard.
- No autonomous publication of AI judgements as validated evidence.
- No large-scale crawler yet.
