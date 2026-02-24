# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** v2.0 Quality & Intelligence — COMPLETE (all 13 phases shipped)

## Current Position

Phase: 13 of 13 (Test Infrastructure & Polish)
Plan: 13-04 — MCP Discovery (complete)
Status: Milestone v2.0 complete
Last activity: 2026-02-24 — Finalized v2.0 milestone: all 36 requirements complete, 297 tests passing

Progress: [████████████████████████████] 100% (13/13 phases complete)

## Accumulated Context

### Decisions

All v1.0 and v1.1 decisions recorded in PROJECT.md Key Decisions table with outcomes.
v2.0 decision: Platform target is OpenCode only (Claude Code version stays as-is).
v2.0 decision: May introduce bundled dependencies if they demonstrably reduce tokens or improve quality.
v2.0 decision: Zero new npm runtime dependencies — all v2.0 features use Node.js built-ins only.
v2.0 decision: Dual-store pattern — STATE.md (human-readable, authoritative) + memory.json (machine-optimized, advisory).
v2.0 decision: Advisory-only state validation first — never blocks workflows, warns only.
- [Phase 10]: Issue structure uses { type, location, expected, actual, severity } for machine-readable validation output
- [Phase 10]: Auto-fix only corrects plan count drift, not timestamps or position (needs human judgment)
- [Phase 10]: Raw config read for gates.* keys since loadConfig only returns CONFIG_SCHEMA keys
- [Phase 11]: Sacred data protection — decisions and lessons never pruned during compaction
- [Phase 11]: Bookmark drift detection warns when filesystem doesn't match saved position
- [Phase 12]: Quality scoring uses 4 dimensions: tests 30%, must_haves 30%, requirements 20%, regression 20%
- [Phase 12]: SR scoring uses union-find for concern grouping with split suggestions
- [Phase 13]: Bundle size tracked in build.js with 400KB budget ceiling
- [Phase 13]: --compact is now the default; --verbose is opt-out

### Pending Todos

None — v2.0 milestone complete.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed v2.0 milestone finalization
Resume file: None
