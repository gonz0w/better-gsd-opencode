# Roadmap: bGSD Plugin

## Milestones

- ✅ **v19.1 Execution Simplicity, Speculative Decoding & JJ-First UX** - Phases 188-200 (shipped 2026-04-05)
- ✅ **v19.3 Workflow Acceleration** - Phases 201-205 (shipped 2026-04-06)

<details>
<summary>v19.3 Workflow Acceleration — shipped 2026-04-06</summary>

**Phases:** 5 (201-205), **Plans:** 13, **Commits:** 68, **Files:** 153 changed, **Lines:** +21,915 / -9,177

**Key accomplishments:**
- Measurement infrastructure: telemetryLog hooks, TTL-computed PlanningCache, batchCheckFreshness, ACCEL-BASELINE.json
- Fast-mode commands: `--fast` in discuss-phase, `--batch N` in verify-work, `workflow:hotpath` telemetry
- Mutex-protected PlanningCache with Atomics+SharedArrayBuffer CAS primitives for parallel cache access
- Kahn topological sort with cycle detection in resolvePhaseDependencies
- JJ workspace proof gate preservation and Promise.all fan-in parallel coordination
- Batch transaction API with sacred data guards for non-sacred state mutations
- CLI contract validation wired into execute-phase after routing changes
- canBatch routing and storeSessionBundleBatch wired into cmdStateCompletePlan
- Kahn wave routing and mutex-protected cache access in fanInParallelSpawns

**Archives:**
- `.planning/milestones/v19.3-ROADMAP.md`
- `.planning/milestones/v19.3-REQUIREMENTS.md`
- `.planning/milestones/v19.3-DOCS.md`
- `.planning/milestones/v19.3-MILESTONE-AUDIT.md`
- `.planning/milestones/v19.3-phases/`

</details>

## Status

No active milestone. Run `/bgsd-new-milestone` to start the next one.

---

*Last updated: 2026-04-06 during v19.3 milestone completion*
