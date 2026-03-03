# Phase 56: Foundation & Config - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can configure RAG settings, discover available research tools, and the system detects what's installed. This phase extends CONFIG_SCHEMA with RAG-related keys, adds a `research:capabilities` command, auto-detects MCP servers and CLI tools, and includes `rag_capabilities` in init output. No research pipeline execution — just configuration and detection infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Config key design
- Flat keys matching existing CONFIG_SCHEMA pattern (not nested `rag` object)
- New keys: `rag_enabled`, `rag_timeout` (per-tool timeout in seconds), tool path overrides (`ytdlp_path`, `nlm_path`)
- Tool paths default to auto-detect via `which`/`checkBinary`; explicit path in config overrides auto-detection
- Tier is auto-calculated from detected tools — no `rag_tier` or `rag_max_tier` config key; users control tier by installing/removing tools
- Existing `brave_search` key stays as canonical name; `mcp_brave_enabled` is added as an alias pointing to it (backward compatible)
- New MCP server toggles: `mcp_context7_enabled` (default: false), `mcp_exa_enabled` (default: false) — per-server booleans following the `brave_search` pattern
- Users can enable/disable individual MCP servers for research independently via these toggles

### Capabilities output format
- `research:capabilities` outputs structured JSON always (consistent with `init phase-op`, `env detect` pattern)
- Agents parse JSON; workflows render for humans as needed
- Missing tool recommendations include name + install command + benefit description (e.g., "yt-dlp: not found — enables YouTube transcript extraction (`pip install yt-dlp`)")
- Init output includes compact `rag_capabilities` summary: just tier, tool count, and list of available tool names — keeps init lean
- Full `research:capabilities` command shows all 4 tiers with the current tier highlighted, so users understand the complete degradation spectrum
- Tier definitions: Tier 1 = Full RAG (all tools), Tier 2 = Sources without synthesis, Tier 3 = Brave/Context7 only, Tier 4 = Pure LLM

### MCP server detection
- Detection reads the host editor's MCP config file to check which servers are registered — no runtime probing
- MCP config file location: new `mcp_config_path` config key with smart default pointing to known editor config location; user can override
- "Available" means configured in editor config — not probed at runtime; actual failures handled when tools are invoked
- Name matching is keyword-based (case-insensitive): server name contains "brave", "context7", or "exa" to handle naming variations across setups
- When MCP config file is unreadable (missing, permissions): reports 0 MCP servers detected + warning note explaining why ("MCP config not found at [path]") — graceful fallback, not error
- Disabled MCP servers (e.g., `"disabled": true` in editor config) are reported as "configured but disabled" in capabilities output — user sees they exist but aren't active
- Exa is first-class alongside Brave Search and Context7 — detected, reported, and recommended at the same level
- CLI tools (yt-dlp, notebooklm-py) detected via existing `checkBinary` pattern with `execFileSync`/`which` — separate from MCP detection

### Agent's Discretion
- Exact JSON shape of `research:capabilities` output (field names, nesting)
- Exact JSON shape of `rag_capabilities` in init output
- Default value for `rag_timeout` (researcher should investigate reasonable per-tool timeouts)
- Smart default path for `mcp_config_path` (depends on host editor config structure)
- How tier highlighting is represented in JSON (e.g., `current_tier` field vs marker)
- Order of tools in capabilities output

</decisions>

<specifics>
## Specific Ideas

- Detection patterns should follow `checkBinary` in env.js — `execFileSync` with `which`, version parsing, 3s timeout
- CONFIG_SCHEMA supports `aliases` array — use this for `mcp_brave_enabled` → `brave_search` mapping
- The 4-tier degradation model is a milestone-level decision (from v8.1 research): Full RAG → Sources without synthesis → Brave/Context7 only → Pure LLM
- All external tools invoked via `execFileSync` subprocess pattern (matching git.js), zero bundled dependencies

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 56-foundation-and-config*
*Context gathered: 2026-03-02*
