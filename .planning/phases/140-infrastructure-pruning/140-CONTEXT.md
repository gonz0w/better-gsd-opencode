# Phase 140: Infrastructure Pruning - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary
Identify and remove unused tool infrastructure code (dead code, vestigial paths, orphaned
detection/caching/decision paths, and specifically the `handoff_tool_context` enrichment field)
without breaking existing tests or functionality. Cleanup only — no new capabilities.
</domain>

<decisions>
## Implementation Decisions

### Pruning Aggressiveness
- **Threshold:** Zero consumers + vestigial paths. Remove dead code AND paths that only existed
  to support the removed features. Do not touch code that has any real consumer.
- **Rationale:** Phase 139 just validated the chain — pruning should be surgical, not a refactor.
  Touching working code now risks destabilizing what we just confirmed.
- **Cascade rule:** If a consumer is itself vestigial, remove the whole chain in one pass.
  Half-pruned is worse than unpruned — partial cleanups leave confusing orphaned fragments.
- **Dead tests:** Remove tests for deleted code. Dead tests are noise that inflates coverage
  without testing anything real. Simpler test suite = clearer signal.

### Deletion Confidence Bar
- **Gate:** Static analysis (no callers) + grep for string/config key references + tests pass
  after removal.
- **String refs:** Explicitly grep code AND workflow `.md` files for field names before deleting.
  Config-driven paths are often under-tested; grep is cheap insurance.
- **Rationale:** Full trace is too slow for an internal tool cleanup. Tests as the gate is
  pragmatic — if tests pass, nothing critical was removed. Grep over `.md` files added after
  stress test to catch silent workflow consumers.

### Removal Style
- **Approach:** Remove outright in one pass. No deprecation cycle.
- **Rationale:** Internal-only infrastructure with no public API surface. Git is the safety net —
  if we're wrong, revert. A deprecation cycle would just delay an inevitable removal.

### Commit Structure
- **Format:** Group by artifact type — one commit per category:
  1. Audit findings documentation
  2. Enrichment field removals (e.g., `handoff_tool_context`)
  3. Detection/caching/decision path removals
  4. Test cleanup (removed tests for deleted code)
- **Message format:** `chore(prune): remove X — no consumers found, tests passed`
  Include the evidence in the message so git log is self-documenting.
- **Rationale:** Per-deletion commits with 15+ removals creates an unreviable git history.
  Grouping by artifact type keeps each commit cohesive and reviewable as a unit.
- **No deletion log file:** Git log IS the audit trail. A separate doc duplicates git and will drift.

### `handoff_tool_context` Fate
- **Consumer standard:** Agent's discretion — a real consumer is code that makes a decision
  based on the field's values, not just passes it around or logs it.
- **Ambiguous default:** Simplify to the minimal form covering confirmed consumers. Ambiguity
  about purpose is a design smell — shrink it, don't document the confusion.
- **Pipeline:** Audit the enrichment pipeline that populates `handoff_tool_context` independently.
  Do not assume it's dead just because the output field is removed. One audit at a time.

### Agent's Discretion
- What qualifies as a "documented consumer" for `handoff_tool_context`
- Whether the enrichment pipeline has independent value beyond the field
- Per-artifact judgment calls on the zero+vestigial boundary
- Commit grouping if fewer than ~5 things are removed (may collapse into fewer commits)
</decisions>

<specifics>
## Specific Ideas
- Test count is intentionally being reduced — the project has over 1000 tests and quality
  matters more than quantity. Removing tests for deleted code is expected and desirable.
- The next milestone will do a comprehensive end-to-end CLI and workflow validation pass
  with better, more targeted tests. Phase 140 pruning cleans the surface before that deep dive.
- Commit message format example: `chore(prune): remove handoff_tool_context enrichment field — no workflow consumers found via grep, tests passed`
</specifics>

<stress_tested>
## Stress-Tested Decisions

**Silent consumers (Challenge 1):** Concern that static + tests isn't enough — workflows could
read fields silently. Resolution: add explicit grep pass over workflow `.md` files before any
field removal. This closes the gap. Decision held with one addition.

**Test count drop looks suspicious (Challenge 2):** Concern that removing tests looks like
coverage being gamed. Resolution: commit message format documents why tests were removed.
The project intentionally has too many tests; quality over quantity is the explicit goal.
Decision held.

**"Simplify" is vague for enrichment fields (Challenge 3):** Concern that "simplify when
ambiguous" gives the agent too much latitude. Resolution: simplify means reduce to the minimal
form covering confirmed consumers — not a redesign. If zero confirmed consumers, default flips
to remove. Decision held with clarification.

**15 commits for 15 deletions (Challenge 4 — REVISED):** Original decision was one commit per
deletion with reason embedded. Revised to group by artifact type (4-6 commits total) so the
cleanup is reviewable as a unit. This was the one decision that changed under stress testing.

**No Phase 141 safety net (Challenge 5):** Concern that integration failures won't be caught.
Resolution: next milestone will do a comprehensive end-to-end validation pass. Unit tests catch
what they catch; the real integration verification comes in the next milestone with better tests.
Decision held.
</stress_tested>

<deferred>
## Deferred Ideas
- Comprehensive end-to-end CLI and workflow validation — explicitly deferred to next milestone
- Test suite quality improvement and better targeted tests — next milestone
- Aggressive simplification of under-used (but not dead) code paths — out of scope for this phase
</deferred>

---
*Phase: 140-infrastructure-pruning*
*Context gathered: 2026-03-17*
