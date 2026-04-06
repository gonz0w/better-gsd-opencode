# Project Research Summary

**Project:** bGSD Plugin v19.3 Workflow Acceleration
**Domain:** CLI workflow orchestration / Node.js hot-path optimization
**Researched:** 2026-04-05
**Confidence:** HIGH (stack/features/architecture); MEDIUM (prioritization — needs repo-local measurement)

<!-- section: compact -->
<compact_summary>

**Summary:** v19.3 accelerates the bGSD CLI through pre-computed routing tables in SQLite, batched I/O operations, and Kahn-sort parallel stage execution. No new npm dependencies required — all work uses existing `node:sqlite`, `node:child_process`, and existing `PlanningCache` infrastructure. The three P1 differentiators (planner self-check, `--fast`/`--batch` modes, snapshot I/O audit) are achievable without architectural risk; parallel stages (P2) require mutex-protected cache writes and preserved JJ proof gates.

**Recommended stack:** node:sqlite (hot-path routing cache with TTL), node:child_process (parallel stage spawn), PlanningCache (SQLite-backed mtime cache), DECISION_REGISTRY (19 routing functions), fast-glob/valibot/fuse.js (existing supporting libs)

**Architecture:** Layered CLI monolith with SQLite-backed planning cache, agent manifests, Kahn topological sort for parallel waves, statement caching via `createTagStore()`. Anti-patterns: blocking I/O on hot paths, eager full-file reads, N+1 SQLite writes.

**Recommended skills:** None — `planner-dependency-graph` (wave analysis) and `cmux` (terminal orchestration) already cover the parallelization guidance needed; remaining work is internal CLI implementation.

**Top pitfalls:**
1. Optimizing without baseline measurement — mandatory `workflow:baseline` before any routing/caching changes
2. Cache invalidation races — parallel stages need mutex per cache key; always retry once on transient crash
3. Bypassing JJ workspace proof gates — `workspace prove` triple-match must remain required on all accelerated paths

**Suggested phases:**
1. Phase 201: Measurement Foundation — baseline hot-path profiling, adaptive telemetry hooks
2. Phase 202: Parallelization Safety — mutex-protected cache, Kahn sort verification, proof gate preservation
3. Phase 203: State Mutation Safety — batched writes with `verify:state validate` regression coverage

**Confidence:** MEDIUM | **Gaps:** planner self-check quality threshold, parallel-stage correctness boundary, and --fast/--batch user-turn reduction all need repo-local measurement before final claims
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

The v19.3 milestone targets workflow acceleration through three mechanisms: faster task routing via pre-computed SQLite decision tables, reduced I/O through batched snapshot reads and state writes, and parallel stage execution using Kahn topological sort over task dependencies. This is an internal CLI optimization — no new npm packages are needed; the existing `node:sqlite`, `node:child_process`, `PlanningCache`, and `DECISION_REGISTRY` infrastructure is sufficient.

The P1 features (planner self-check before checker spawn, `discuss-phase --fast`, `verify-work --batch N`, phase snapshot I/O coverage audit) are achievable with low risk using existing patterns. The P2 feature (parallel workflow stage dispatch) offers the highest payoff but requires correct dependency graph handling, mutex-protected shared cache entries, and preservation of the v19.0 JJ workspace proof gate — acceleration must never bypass the triple-match safety check.

The primary risk is optimizing without measurement. The workflow measurement infrastructure (`workflow:baseline`, `workflow:compare`) exists but must be used before any routing/caching changes are committed. Without a pre-change baseline, there is no way to verify improvement, detect regression, or attribute changes to specific PRs.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

v19.3 accelerates existing infrastructure without new npm dependencies. The core technology vector is SQLite-first hot-path memoization: storing `classifyTaskComplexity` and `routeTask` results in TTL-backed computed-value tables eliminates repeated computation on every call. Batch I/O operations read-ahead phase/plan fingerprints in a single SQLite transaction instead of per-file mtime checks. Built-in `Promise.all` with `child_process.spawn` handles independent workflow stage parallelism without additional packages.

**Core technologies:**
- `node:sqlite` (Node 22.5+ built-in): Hot-path routing cache with TTL storage — extends existing `PlanningCache` with computed-value tables at zero additional cost
- `node:child_process` (Node 22.5+ built-in): Parallel workflow stage execution via `spawn()` for independent agents without async I/O rewrite
- `PlanningCache`: SQLite-backed mtime cache — already handles roadmap/plan/task caching; extend with routing-decision tables
- `DECISION_REGISTRY`: 19 deterministic routing functions — pre-compute and store results for repeated calls
- `fast-glob` / `valibot` / `fuse.js`: Existing supporting libs — no changes needed

**Avoid:** `lru-cache` (CLI short-lived, Map sufficient), `worker_threads` (CPU-bound parallelism not the bottleneck; routing is I/O-bound), new async I/O infrastructure (sync I/O appropriate for CLI tool)

### Expected Features

**Must have (table stakes — must not regress):**
- `phase:snapshot` — single CLI call replacing repeated phase discovery calls (shipped v16.1)
- `verify:state complete-plan` — atomic batched state mutation (shipped v16.1)
- Phase handoff artifacts — durable machine-readable chaining contract between discuss/research/plan/execute/verify steps
- PlanningCache-backed plan reads — SQLite-first parsed plan/task data avoiding markdown reparse

**Should have (v19.3 differentiators):**
- Planner self-check before checker spawn — planner folds in checker rubric for straightforward phases; standalone checker spawns only on strict flag, low confidence, or failed self-check. Reduces agent hop count without degrading quality.
- `discuss-phase --fast` — batch low-risk clarification choices; reduce turns for routine phases. Opt-in flag; default unchanged.
- `verify-work --batch N` — batch routine test verification. Default stays one-at-a-time for ambiguous/high-risk.
- Phase:snapshot I/O coverage audit — extend snapshot to include all repeated discovery calls currently made by discuss-phase, research-phase, plan-phase workflows.

**Defer (v2+):**
- `/bgsd-deliver-phase --fresh-step-context` — end-to-end fresh-context chained delivery pipeline
- Dynamic parallelization — runtime dependency graph analysis to auto-detect parallelizable segments
- Autonomous agent team coordination, dynamic agent spawning

### Architecture Approach

Layered CLI monolith with SQLite-backed planning cache as the central acceleration primitive. `orchestration.js` owns task complexity scoring and execution mode selection (single/sequential/parallel/pipeline). `planning-cache.js` provides mtime-based cache for roadmap/plan/task/requirements with SQLite persistence and dual-write backup. Kahn topological sort (already in `resolvePhaseDependencies`) orders phases by `depends_on` for parallel wave execution. Statement caching via `createTagStore()` delivers ~43% p50 latency reduction on repeated SQL shapes.

**Major components:**
1. `orchestration.js` — Task complexity classification (1-5 scoring), execution mode selection, hot-path task routing with model profile resolution
2. `planning-cache.js` — SQLite-backed mtime-tracked cache for roadmap/plan/task/requirements; extend with routing-decision tables
3. `cache.js` — General LRU cache with SQLite/Map dual-backend; workflow-specific caching (structural fingerprints, hot-path results)
4. `phase-handoff.js` — Durable phase-step artifact lifecycle with validation and resume support; add parallel write support without changing contract
5. `context.js` — Token budgeting, agent manifest filtering, task-scoped file relevance scoring
6. `workflow.js` — Structural fingerprint extraction, baseline comparison, measurement

### Critical Pitfalls

1. **Optimizing without measurement baseline** — Mandatory `workflow:baseline` run before any routing/caching/batching changes. No baseline = no way to verify improvement or detect regression.

2. **Cache invalidation races in parallel stages** — Parallel stages sharing a cache layer need mutex/locking at the cache key level. Simultaneous invalidation of the same entry returns stale data, crashes with "undefined helper" errors, or corrupts shared cache state. Always retry cache-dependent operations once on transient crash before escalating.

3. **Bypassing JJ workspace proof gates** — Acceleration must never remove or short-circuit the `workspace prove` triple-match check. If the proof check itself is slow, optimize the proof check, not the bypassing of it. Any "fallback to sequential" must preserve proof as the triggering condition.

4. **Breaking backward compatibility in state mutations** — Batched state writes must support both old and new STATE.md formats. Run `verify:state validate` after any batched write. Never batch sacred data writes — only cache/non-critical state.

5. **Hot-path assumption drift** — Hot-path profile identified during research may not match actual usage. Build adaptive profiling telemetry into acceleration work; make hot-path detection adaptive, not hardcoded.

### Recommended Skills

No strong external skill recommendations for v19.3. The existing `planner-dependency-graph` skill already provides wave analysis, vertical-vs-horizontal decomposition, and file-ownership rules for parallel execution — covering the parallel workflow stages target. The `cmux` skill handles terminal orchestration for parallel panes. The remaining acceleration targets (routing speed, I/O batching) are implementation concerns in `src/` modules, not skill guidance.

Rejected candidates: `parallel-task` (unproven, 0 installs, overlaps with existing skills), `CCPM` (requires GitHub/Git worktrees, incompatible with JJ/markdown workflow), `opencode-parallel-agents` (multi-model diversity pattern, not workflow acceleration).
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure addresses the acceleration targets while respecting the identified pitfalls.

### Phase 201: Measurement Foundation
**Rationale:** All acceleration work must be grounded in pre-change measurement. Without `workflow:baseline` data, there is no way to verify improvement or detect regression. This phase establishes the measurement infrastructure and adaptive telemetry hooks that subsequent phases depend on.
**Delivers:** Saved baseline metrics, profiling hooks in hot-path code, telemetry on which routing paths are actually taken.
**Addresses:** FEATURES.md P1 priorities (planner self-check quality threshold measurement, --fast/--batch user-turn reduction baseline).
**Avoids:** Pitfall 1 (optimizing without baseline), Pitfall 5 (hot-path assumption drift).
**Research flag:** Standard pattern — `workflow:baseline` and `workflow:compare` are well-documented and established.

### Phase 202: Parallelization Safety
**Rationale:** Parallel workflow stages offer the highest acceleration payoff but introduce cache race conditions and proof-gate bypass risks. This phase implements mutex-protected cache writes and Kahn sort verification before any parallel fan-out.
**Delivers:** Mutex-protected cache entries for parallel stages, Kahn topological sort verification, preserved JJ workspace proof gate on all accelerated paths.
**Uses:** `node:child_process` spawn, `Promise.all` fan-in, WAL-mode SQLite coordination.
**Implements:** ARCHITECTURE.md Pattern 5 (batch-parallel stage execution with dependency gating).
**Avoids:** Pitfall 2 (cache invalidation races), Pitfall 3 (JJ proof gate bypass).
**Research flag:** Complex integration — parallel dispatch correctness needs careful verification during planning.

### Phase 203: State Mutation Safety
**Rationale:** Batched state mutations (the write-side counterpart to read-batching) must not break STATE.md format compatibility or skip the canonical dual-write path. This phase wires `verify:state complete-plan` into the execute workflow and adds regression coverage.
**Delivers:** Batched execute-plan state mutations, `verify:state validate` regression coverage, cached handoff validation at snapshot time.
**Uses:** Existing `verify:state complete-plan` infrastructure, SQLite batch transactions.
**Avoids:** Pitfall 4 (backward compatibility in state mutations).
**Research flag:** Well-documented — existing `complete-plan` and STATE.md format patterns are stable.

### Phase Ordering Rationale

- **201 before 202:** Parallelization cannot be verified without measurement baseline. Without Phase 201, there is no way to confirm that parallel stages actually improve throughput.
- **202 before 203:** State mutation batching depends on the same cache infrastructure that Phase 202 hardens. Parallel cache writes must be mutex-protected before batch writes extend to sacred data.
- **All phases:** `npm run build` smoke test must be green after every phase — bundle parity failures are a recurring issue pattern.

### Research Flags

Phases needing deeper research during planning:
- **Phase 202:** Parallel stage correctness boundary — complex integration with JJ workspace proof gate, needs careful dependency graph validation before dispatch

Phases with standard patterns (skip research-phase):
- **Phase 201:** `workflow:baseline` is established infrastructure with clear docs
- **Phase 203:** `verify:state complete-plan` is shipped and stable; batch extension follows existing patterns
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are existing codebase infrastructure; no new dependencies |
| Features | HIGH (inventory); MEDIUM (prioritization) | Feature inventory is complete; ROI requires repo-local measurement |
| Architecture | HIGH | Patterns (mtime cache, Kahn sort, statement caching) are existing and well-understood |
| Pitfalls | HIGH | Recurring lessons from v17–v19 document these patterns extensively |
| Skills | HIGH | No external skills meet the bar; existing skills cover the need |

**Overall confidence:** HIGH for implementation feasibility; MEDIUM for ROI claims without measurement

### Gaps to Address

- **Planner self-check quality threshold:** When does planner self-check produce comparable output to standalone checker? Needs calibrated measurement during Phase 201.
- **Parallel-stage correctness boundary:** What is the maximum safe parallel fan-out? Needs JJ workspace proof gate timing data and mutex contention modeling.
- **--fast/--batch user-turn reduction:** Expected turn reduction based on workflow traces; actual reduction requires user study after Phase 201 baseline.
- **Hot-path profile drift:** Usage patterns may shift which operations are on the critical path over time. Adaptive telemetry from Phase 201 addresses this but needs validation.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- **Context7** — `node:sqlite` built-in docs, `node:child_process` built-in docs
- **Local project** — `src/lib/planning-cache.js`, `src/lib/orchestration.js`, `src/lib/cache.js`, `src/lib/phase-handoff.js`, `src/lib/context.js`, `src/lib/workflow.js`
- **Decision registry** — 19 routing functions in `src/lib/decisions.js`; pre-computing is additive, not architectural
- **JJ workspace docs** — parallel execution context for Kahn topological sort

### Secondary (MEDIUM confidence)
- **Project lessons** — `.planning/memory/lessons.json` (recurring cache/verifier/bundle patterns from v17–v19)
- **Workflow measurement** — `workflow:baseline`, `workflow:compare`, `workflow:verify-structure` (v14.0)
- **v19.3 PRD** — `.planning/research/completed/WORKFLOW-ACCELERATION-PRD.md`

### Tertiary (LOW confidence)
- **Feature ROI claims** — planner self-check quality delta, --fast/--batch turn reduction, parallelization throughput gain; all need repo-local measurement validation

---
*Research completed: 2026-04-05*
*Ready for roadmap: yes*
