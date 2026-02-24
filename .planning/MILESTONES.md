# Milestones

## ✅ v2.0 Quality & Intelligence (Shipped: 2026-02-24)

**Phases completed:** 4 phases, 13 plans
**Commits:** 25 | **Files changed:** 61 | **Lines:** +14,172 / -2,553
**Timeline:** 3 days (2026-02-22 → 2026-02-24)
**Tests:** 297 passing (0 failures)
**Bundle:** 373KB / 400KB budget

**Key accomplishments:**
- Built state validation engine with 5 drift-detection checks (plan count, position, stale activity, blocker staleness, plan claims) and auto-fix for unambiguous corrections
- Implemented cross-session memory system with dual-store pattern (STATE.md authority + memory.json cache), sacred data protection, bookmark auto-save, and deterministic compaction
- Added comprehensive quality gates: test gating, requirement checking, regression detection, multi-dimensional quality scoring (A-F grades), and plan single-responsibility analysis with union-find concern grouping
- Created integration test infrastructure: workflow sequence tests, state round-trips, E2E simulation, snapshot tests, and test coverage tracking across 297 tests
- Added bundle size tracking (400KB budget), token budgets for workflows, compact-as-default for all init commands, and MCP server discovery

**Archives:**
- `.planning/milestones/v2.0-ROADMAP.md`
- `.planning/milestones/v2.0-REQUIREMENTS.md`

---

## ✅ v1.1 Context Reduction & Tech Debt (Shipped: 2026-02-22)

**Phases completed:** 4 phases, 10 plans
**Commits:** 42 | **Files changed:** 78 | **Lines:** +12,642 / -4,576
**Timeline:** 1 day (2026-02-22)

**Key accomplishments:**
- Integrated tokenx for accurate BPE-based token estimation with workflow baseline measurement and before/after comparison tooling
- Added --compact flag achieving 46.7% average output reduction across all 12 init commands, plus opt-in --manifest for context-aware loading
- Built extract-sections CLI with dual-boundary parsing enabling 67% reference file reduction via selective section loading
- Compressed top 8 workflows by 54.6% average (39,426 to 15,542 tokens) preserving all behavioral logic
- Added summary/detail tiers to all 6 research templates for context-aware planner loading
- Resolved all pre-existing tech debt: fixed failing test, completed 44-command help coverage, created plan templates

**Archives:**
- `.planning/milestones/v1.1-ROADMAP.md`
- `.planning/milestones/v1.1-REQUIREMENTS.md`

---

## ✅ v1.0 Performance & Quality (Shipped: 2026-02-22)

**Phases completed:** 5 phases, 14 plans
**Commits:** 63 | **Files changed:** 86 | **Lines:** +24,142 / -5,143
**Timeline:** 2 days (2026-02-21 → 2026-02-22)

**Key accomplishments:**
- Built safety net with 153+ tests covering state mutations, frontmatter parsing, and config schema
- Instrumented all 96 catch blocks with GSD_DEBUG-gated stderr logging for full observability
- Made all 15 feature commands discoverable via --help (43 entries) and 11 new slash commands
- Split monolith into 15 organized src/ modules with esbuild bundler producing single-file deploy
- Added in-memory file cache and batch grep to eliminate redundant I/O
- Hardened CLI against shell injection and temp file leaks with sanitizeShellArg() and cleanup handlers

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`

---
