# Phase 125: Core Tools Integration - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate ripgrep, fd, and jq into bgsd-tools core workflows, enabling fast search, file discovery, and JSON transformation. Each tool has a graceful Node.js fallback when unavailable. Builds on Phase 124's tool detection and caching infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Fallback Messaging
- Silent fallback — no user-visible messages when falling back to Node.js
- Log fallback events to debug output only
- No performance hints or timing info in normal output — keep output clean
- Tool availability info surfaced via `/bgsd-health` command (not a separate command)
- Health check shows tool name + link to project page for missing tools (generic install help, not platform-specific)

### Search Integration Scope
- ripgrep replaces all file content search throughout bgsd-tools when available — unified approach, not selective
- fd used only for large-scale codebase file discovery — keep simple glob/readdir for .planning/ and known small directories
- Both ripgrep and fd respect .gitignore by default using their built-in support
- Node.js fallback produces identical output format to external tools — callers don't need to know which backend ran

### Tool Preference & Overrides
- Per-tool config toggles (e.g., `tools.ripgrep: false`, `tools.fd: true`, `tools.jq: false`) for fine-grained control
- Tools must be on PATH — no custom path configuration
- Config overrides Phase 124 detection cache — if disabled in config, skip detection entirely, treat as unavailable
- No environment variable overrides — config only

### jq Transformation Boundaries
- jq used for all JSON file processing when available — internal config files AND external/user data
- JavaScript fallback mirrors jq logic with full feature parity for every filter used
- No degraded mode — if jq isn't available, JavaScript must produce identical results

### Agent's Discretion
- Whether jq filters are stored inline in source code or as separate .jq files — agent determines best maintainability approach

</decisions>

<specifics>
## Specific Ideas

- All 3 tools integrated with `execFileSync` array args (zero shell injection vulnerabilities) — from phase requirements
- Success criteria targets: <100ms search on 10K+ file codebase with ripgrep, 20x+ speedup for fd vs Node.js traversal

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0125-core-tools-integration*
*Context gathered: 2026-03-14*
