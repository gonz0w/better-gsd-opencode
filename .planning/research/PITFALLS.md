# Milestone Research Pitfalls: v19.1 Execution Simplicity, Speculative Decoding & JJ-First UX

**Created:** 2026-04-02

## Pitfall 1: Behavior-changing simplification

- **What goes wrong:** Refactor work changes semantics or weakens test coverage while claiming to only simplify.
- **How to avoid:** Ship analysis/reporting first, keep simplification executor passes refactor-only, and require focused tests after each simplification change.

## Pitfall 2: Claiming speculative-decoding wins without measurement

- **What goes wrong:** Prompt/schema tightening is treated as proven latency improvement without repo-local benchmarks.
- **How to avoid:** Pair structural changes with benchmark or before/after measurement tasks and keep claims proportional to evidence.

## Pitfall 3: Replacing Git vocabulary too broadly without preserving interop clarity

- **What goes wrong:** User-facing copy becomes confusing when remote Git branch semantics are still relevant.
- **How to avoid:** Use bookmark for local ownership, branch only for remote Git interop, and make that distinction explicit.

## Pitfall 4: Using detached HEAD as a universal health failure

- **What goes wrong:** JJ-backed repos are flagged unhealthy even though colocated detached HEAD is expected.
- **How to avoid:** Gate health on JJ root/status/bookmark state first; only use checked-out-branch requirements for explicit Git-only operations.

## Pitfall 5: Over-constraining output contracts before artifact shapes stabilize

- **What goes wrong:** Agents and templates are forced into schemas that churn again when roadmap/verification/summary shapes change.
- **How to avoid:** Tighten schemas after the milestone settles the intended canonical artifact shape and shared enum vocabulary.
