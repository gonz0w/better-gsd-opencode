# Phase 108: Dead Code Removal - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Find and remove unreachable code paths from the bGSD plugin codebase (src/ and bin/).

This phase delivers:
- Static analysis to identify unreachable code paths
- Removal of confirmed dead code
- Verification that removal doesn't break runtime

**Scope:** Code cleanup in src/ directory. Depends on Phase 107 (Unused Exports Cleanup).

</domain>

<decisions>
## Implementation Decisions

### Detection Method
- [TBD - discuss] Use AST-based static analysis vs pattern matching
- [TBD - discuss] Which tools/approaches to identify unreachable code?

### Scope of Analysis
- [TBD - discuss] Include all src/ files or specific directories?
- [TBD - discuss] Include bin/bgsd-tools.cjs in analysis?

### Verification Approach
- [TBD - discuss] How to verify code is truly unreachable before removal?
- [TBD - discuss] What runtime tests to run after removal?

### Handling Conditional Dead Code
- [TBD - discuss] Code unreachable only in certain conditions (environment, flags)?
- [TBD - discuss] Conservative (leave it) vs aggressive (remove if potentially dead)?

### Agent's Discretion
- Detection tool selection: Use your judgment on best approach
- Specific files to analyze first: Use Phase 107 learnings

</decisions>

<specific>
## Specific Ideas

[No specific requirements — open to standard approaches]

Phase 107 analysis showed:
- Inventory files created in .planning/phases/107-unused-exports/
- One unused export found (used in tests, not removed)

</specific>

<deferred>
## Deferred Ideas

[None yet - discussion just starting]

</deferred>

---

*Phase: 108-dead-code-removal*
*Context gathered: 2026-03-12*
