# Phase 124: Tool Detection & Infrastructure - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a unified tool capability detection infrastructure exposed as a CLI command (`detect:tools`) and internal reusable function. Detects external tool availability (ripgrep, fd, jq, yq, bat, gh), caches results, and provides install guidance across platforms.

</domain>

<decisions>
## Implementation Decisions

### Output Format
- JSON only — no human-readable table mode
- Minimal per-tool fields: `name` (display name) + `available` (boolean)
- Top-level structure is a flat JSON array — no wrapper metadata
- Example: `[{"name": "ripgrep", "cmd": "rg", "available": true}, ...]`

### Detection Scope & Extensibility
- Hardcoded core tool list (ripgrep, fd, jq, yq, bat, gh) plus optional user-defined tools in config
- Tool definitions include command name + human display name (e.g., `{cmd: "rg", name: "ripgrep"}`)
- No categories or priority levels — flat list, all tools treated equally

### Cache Strategy
- Cache stored in project `.planning/` directory (e.g., `.planning/.cache/tools.json`)
- Cache is gitignored — each machine detects its own tools
- 5-minute TTL as specified in success criteria — no force-refresh flag needed
- Silent caching — same JSON output regardless of cache hit/miss

### Install Guidance
- Keep it simple: just name the tool — "Install ripgrep" — user knows their system
- No version-specific warnings — just available/missing in this phase
- Must expose a reusable internal function (e.g., `detectTool('rg')`) so other bgsd-tools commands can check availability without spawning a subprocess

### Agent's Discretion
- Whether version detection and install guidance are separate sub-commands vs optional flags — agent picks cleanest approach
- Config extras schema for user-defined tools — agent determines appropriate fields
- How install guidance is surfaced (separate command vs inline field) — agent picks based on the minimal output preference

</decisions>

<specifics>
## Specific Ideas

- Internal API is important: other commands should call `detectTool('rg')` directly, not shell out
- Output should be as minimal as possible — callers parse JSON programmatically
- Cache should be invisible to the user — no stderr hints, no metadata in output

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0124-tool-detection-infrastructure*
*Context gathered: 2026-03-14*
