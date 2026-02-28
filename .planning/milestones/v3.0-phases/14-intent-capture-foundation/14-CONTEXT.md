# Phase 14: Intent Capture Foundation - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create, read, and update a structured INTENT.md that captures why a project exists and what success looks like. The file lives at `.planning/INTENT.md` (one per project). Commands: `intent create`, `intent show` (with `read` as alias), `intent update <section>`, `intent validate`. Template exists in `templates/`. Phase 15 adds tracing/validation, Phase 17 adds evolution tracking — this phase is CRUD + structural validation only.

</domain>

<decisions>
## Implementation Decisions

### INTENT.md structure
- **Section ordering (narrative flow):** Objective → Target Users → Desired Outcomes → Success Criteria → Constraints → Health Metrics
- **XML tags wrapping sections:** `<objective>`, `<users>`, `<outcomes>`, `<criteria>`, `<constraints>`, `<health>` — short names matching command aliases
- **Objective format:** Single statement + 2-3 sentences of elaboration underneath. No separate TL;DR — the objective IS the summary
- **Desired outcomes:** Bullet list with explicit IDs — `- DO-01 [P1]: description`. Universal `DO-XX` prefix (not project-prefixed). 3 priority levels: P1 (Critical), P2 (Important), P3 (Nice-to-have)
- **Success criteria:** ID'd with `SC-XX` format — `- SC-01: All tests pass`. These are launch gates, not ongoing goals
- **Constraints:** Separated by type using markdown sub-headers inside `<constraints>` — `### Technical`, `### Business`, `### Timeline`. Each constraint has ID: `C-XX`
- **Health metrics:** Two sub-sections via markdown sub-headers inside `<health>` — `### Quantitative` (with IDs: `HM-XX`, e.g. `HM-01: Test pass rate >95%`) and `### Qualitative` (prose principles, no IDs)
- **Target users:** Simple audience list — brief, one-line descriptions per audience segment
- **Revision tracking:** `**Revision:** N` at top, auto-incremented on every update. Phase 17 builds evolution history on top
- **File location:** `.planning/INTENT.md` — top-level planning doc alongside ROADMAP.md, STATE.md. One per project (evolves over time)
- **ID gaps preserved:** When items are removed, remaining IDs are NOT renumbered — gaps remain to preserve external references

### Command interaction model
- **Dual mode:** Workflow-driven conversation (slash command `/gsd-intent create`) for interactive use + CLI flags (`gsd-tools.cjs intent create --objective '...'`) for programmatic/testing
- **Guided workflow:** Always guided, section by section — walks through each section with questions like discuss-phase does
- **Standalone command now:** `/gsd-intent` as standalone slash command. Phase 16/17 integrates into new-project workflow later
- **Update model:** Both section-level replace AND granular item operations — `intent update outcomes --add 'Users can export data'` (auto-assigns next ID), `intent update outcomes --remove DO-03` (by ID only, silent removal)
- **Priority changes:** Dedicated `--set-priority DO-03 P1` flag — outcomes only, not other sections
- **Overwrite protection:** `intent create` errors if INTENT.md exists. `--force` flag to overwrite — matches GSD CLI patterns
- **Section aliases:** Short aliases for `intent update` — `outcomes`, `constraints`, `health`, `users`, `criteria`, `objective`
- **Auto-commit:** All changes auto-committed like other GSD commands, using `commit_docs` pattern
- **Descriptive commits:** `docs(intent): add DO-05 to outcomes`, `docs(intent): update constraints` — clear git history
- **Revision auto-increment:** Every `intent update` call increments the revision number automatically, no manual control
- **Structural validation:** `intent validate` as a separate command — checks all sections present, IDs sequential (gaps allowed), no broken format. Phase 15 adds semantic validation
- **Validate output:** Human-readable lint-style default (`✓ Outcomes: 4 items`, `✗ Health metrics: missing quantitative section`), JSON with `--raw` flag. Exit code 0 = valid, exit code 1 = issues found
- **All sections required:** Guided workflow won't finish until every section has at least one entry
- **Read with section filter:** `intent read outcomes` returns just that section's JSON

### Output format & readability
- **`intent show` = compact summary** by default — one-screen overview: objective, outcome count with priorities, key constraints. `--full` for complete render, section filter supported (`intent show outcomes`)
- **`intent read` aliased to `intent show --raw`** — one implementation, `read` is syntactic sugar for JSON output
- **JSON structure:** Grouped by section — `{outcomes: [{id, priority, text}], constraints: [{id, type, text}], ...}` with metadata (revision, created, updated)
- **Parsed JSON only:** No raw markdown in JSON output — clean structured data
- **Color in terminal:** P1 in red, P2 in yellow, P3 in dim — auto-detect terminal, plain in pipes
- **Compact show sorts by priority:** P1 outcomes first, then P2, then P3
- **Show = current state only:** No revision history in Phase 14's show output — Phase 17 adds that
- **Validate lint-style:** `✓`/`✗` symbols with section names and issue descriptions

### Template defaults & examples
- **Reference doc + code-generated template:** `templates/intent.md` is a reference document (like `context.md`) explaining format, good/bad examples, guidelines. Code generates the actual INTENT.md from internal template
- **Instructions only in template:** Each section has a 1-line HTML comment explaining what goes there — no pre-filled example content
- **Good/bad examples in reference doc:** Show what good intent looks like AND common mistakes, matching context.md's pattern
- **2 example INTENT.md files:** One for a tool/library, one for an application
- **No preamble:** File jumps straight to `<objective>` — no "how to use this file" header
- **No auto-detection from project files:** Intent comes from the user's head, not existing files
- **No file import:** CLI flags or guided workflow only — no `--from file.json`
- **Sub-sections use markdown headers:** `### Technical`, `### Quantitative` etc. inside XML tags — no nested XML tags

### Agent's Discretion
- Compact `intent show` density (somewhere between 5-25 lines — calibrate for agent usefulness)
- JSON wrapper shape when filtering by section (metadata inclusion vs items-only)

</decisions>

<specifics>
## Specific Ideas

- Outcomes as `DO-XX [PX]:` format is critical for Phase 15 traceability — get the parsing right
- Constraints organized by type (technical/business/timeline) parallels how real projects think about limits
- `intent validate` with exit codes enables future CI/pre-commit hook usage
- `intent read` as alias for `intent show --raw` keeps the API surface small — one command, two modes
- Health metrics split (quantitative with IDs vs qualitative as prose) reflects that some health indicators are measurable and others are judgment calls
- Revision number is a simple integer — Phase 17 builds full evolution tracking on top of this foundation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-intent-capture-foundation*
*Context gathered: 2026-02-24*
