---
phase: 127-agent-routing-enhancement
plan: 01
status: complete
completed: 2026-03-15
commit: 076c72f
---

# Plan 01 Summary: Tool Availability + Tool Routing Decision Functions

## What Was Built

**Task 1: tool_availability in enricher + three resolve functions**

- `src/lib/decision-rules.js`: Added three new pure decision functions registered in `DECISION_REGISTRY` under category `'tool-routing'`:
  - `resolveFileDiscoveryMode(state)` — recommends `fd` vs `node` based on `scope` and `tool_availability.fd`
  - `resolveSearchMode(state)` — recommends `ripgrep` → `fd` → `node` fallback chain with `.gitignore` respect logic
  - `resolveJsonTransformMode(state)` — recommends `jq` vs `javascript` based on `json_complexity` and `tool_availability.jq`
  
- `src/plugin/command-enricher.js`: Added `tool_availability` field to enrichment output (reads from `.planning/.cache/tools.json` file cache — avoids `child_process` in ESM plugin context). Defaults to all-false if cache absent/stale.

**Task 2: Tool-Aware Planning Guidance**

- `workflows/plan-phase.md`: Added `## Tool-Aware Planning Guidance` section documenting the AGENT-01 principle: task decomposition is tool-agnostic, tool selection is an executor concern resolved at runtime.

## Verification

- Build passes: `npm run build` ✓ (ESM validation: 0 require() calls)
- All 1440+ existing tests pass (0 failures)
- Three resolve functions exported from `src/lib/decision-rules.js`
- All three registered in `DECISION_REGISTRY` with category `'tool-routing'`
- `tool_availability` reads safely from file cache (no child_process in ESM)

## Key Decisions Made

- Used file cache approach for `tool_availability` in ESM plugin (not direct `getToolStatus()` call) — avoids CJS `child_process` in ESM bundle
- All tools default to `false` when cache absent (conservative fallback)
- Planning guidance documents that task structure does NOT change based on tool availability — only executor runtime choices change

## Self-Check: PASSED

All success criteria met:
- [x] bgsd-context includes tool_availability with true/false per tool (SC-1)
- [x] resolveFileDiscoveryMode works correctly (SC-2)
- [x] resolveSearchMode works correctly (SC-3)
- [x] resolveJsonTransformMode works correctly (SC-4)
- [x] Plan decomposition heuristic guidance exists in workflow markdown (SC-5)
- [x] All existing tests pass (no regressions)
