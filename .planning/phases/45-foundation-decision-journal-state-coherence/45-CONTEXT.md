# Phase 45: Foundation — Decision Journal & State Coherence - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Trajectory data has a persistent, session-portable home and code rewinds never corrupt planning state. This phase delivers: a `trajectories` memory store with structured journal entries that persist across sessions, and selective git rewind that protects planning files. No UI, no higher-level trajectory analysis — just the foundational storage and safety mechanisms.

</domain>

<decisions>
## Implementation Decisions

### Journal entry structure
- Structured entries: timestamp + category + text + metadata
- Four categories: `decision`, `observation`, `correction`, `hypothesis`
- Optional metadata fields: phase number, confidence level (high/medium/low), free-form tags, and references (commits, files, other entry IDs)
- Each entry gets an auto-generated short ID (e.g. `tj-a1b2c3`) for linking and deduplication
- Entries persist in `.planning/memory/trajectory.json`

### Read/query behavior
- JSON output by default, `--pretty` flag for human-readable formatted view
- Filter by category, phase number, date range, and tags
- No full-text search in this phase — filter by structured fields only
- Return all results by default, no built-in limit — let consumer handle
- Default sort: newest first; `--asc` flag to reverse to chronological order

### Rewind safety boundaries
- Protected paths (never rewound): `.planning/` directory and root config files (package.json, tsconfig, etc.)
- Rewindable paths: everything tracked except protected paths (denylist approach, not allowlist)
- Dirty working tree handling: auto-stash uncommitted changes, perform rewind, then restore stash
- Always confirm before rewind — show diff summary of what will change, require explicit yes

### Branch namespace conventions
- Naming pattern: `gsd/trajectory/{phase}-{slug}` (e.g. `gsd/trajectory/45-decision-journal`)
- Lifecycle: branches deleted after merge to main
- Collision prevention: prefix validation on create — error if `gsd/trajectory/` would collide with `worktree-*` namespace
- Remote: local only by default, `--push` flag to explicitly push to remote

### Agent's Discretion
- Internal JSON schema for trajectory.json (exact field names, nesting)
- Short ID generation algorithm (nanoid, crypto random, etc.)
- Stash naming convention during rewind operations
- Exact diff summary format for rewind confirmation
- Config file list for protected paths (which root configs count)

</decisions>

<specifics>
## Specific Ideas

- `memory write --store trajectories` and `memory read --store trajectories` are the CLI interface — follow existing memory command patterns
- Hypothesis entries should track confidence so trajectory analysis can later assess prediction accuracy
- Rewind should feel safe — the confirmation with diff summary is non-negotiable even for agents

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-foundation-decision-journal-state-coherence*
*Context gathered: 2026-02-28*
