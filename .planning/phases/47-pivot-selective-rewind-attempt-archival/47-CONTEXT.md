# Phase 47: Pivot — Selective Rewind & Attempt Archival - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI command `trajectory pivot <checkpoint>` that lets users abandon a failing approach, auto-save current work as an abandoned attempt, capture structured reasoning for why the approach failed, and rewind source code to a prior checkpoint. Integrates with the existing stuck-detector to suggest pivoting after repeated failures. Compare, choose, and agent context integration are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Reason Capture Flow
- Interactive prompts by default — command asks 2-3 questions when run without flags
- Agent designs the specific prompt flow (what questions, in what order) for maximum useful info capture
- `--reason` flag bypasses interactive prompts for scripted/agent use — accepts a single combined reason string
- Reason is stored embedded in the abandoned checkpoint journal entry (not as a separate entry)

### Auto-checkpoint Behavior
- Before rewind, auto-save current work as a minimal snapshot: git ref + timestamp + reason only
- Skip full metrics collection (tests, LOC, complexity) since the approach is being abandoned — speed over data
- Abandoned attempt keeps the same checkpoint name, tagged with `abandoned` — e.g. attempt-3 with tags: [checkpoint, abandoned]
- Git branch for the abandoned attempt is moved to archive namespace: `archived/trajectory/<scope>/<name>/attempt-N`
- Output after pivot is minimal: "Pivoted to <checkpoint>. Abandoned attempt archived as <branch>."

### Stuck-detector Integration
- Advisory message only — no blocking prompts, no auto-pivot
- Suggestion always appears when stuck detection fires (3 failures), even if no checkpoint exists (suggest creating one first)
- Simple hint format: "Consider pivoting to a checkpoint: trajectory pivot <checkpoint-name>"
- Implementation extends the existing `src/lib/recovery/stuck-detector.js` module directly

### Error States & Edge Cases
- Dirty working tree: offer to stash — ask user, don't auto-stash or hard block
- Checkpoint not found: error message + list available checkpoints with their scope
- Multiple attempts: default to most recent attempt, allow `--attempt N` flag to pick a specific one
- No `--confirm` flag required — the interactive reason flow serves as confirmation
- When `--reason` flag is used (non-interactive), the act of providing the reason IS the confirmation

### Agent's Discretion
- Exact interactive prompt questions and flow design
- Archive branch creation mechanics (rename vs create+delete)
- Stash message format
- Error message wording and formatting
- Whether to show a dry-run preview before executing the pivot

</decisions>

<specifics>
## Specific Ideas

- Pivot should reuse the existing `git rewind` infrastructure (selective rewind with protected paths) rather than reimplementing
- The `--reason` flag enables agents to pivot programmatically without interactive prompts
- Archived branches provide a permanent escape hatch — the abandoned work is never truly lost

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 47-pivot-selective-rewind-attempt-archival*
*Context gathered: 2026-02-28*
