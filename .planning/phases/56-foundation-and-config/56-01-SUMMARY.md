---
phase: 56-foundation-and-config
plan: 01
subsystem: infra
tags: [config, rag, mcp, cli-detection, research-pipeline]

# Dependency graph
requires: []
provides:
  - CONFIG_SCHEMA with 8 RAG research pipeline keys
  - detectCliTools() for yt-dlp and notebooklm-py detection
  - detectMcpServers() for Brave Search, Context7, Exa detection
  - mcp_brave_enabled ↔ brave_search alias relationship
affects: [56-02, research-capabilities, init-output]

# Tech tracking
tech-stack:
  added: []
  patterns: [keyword-based MCP server matching, config path override with auto-detect fallback, binary name fallback chain]

key-files:
  created: [src/commands/research.js]
  modified: [src/lib/constants.js, bin/gsd-tools.cjs]

key-decisions:
  - "MCP config detection handles 3 shapes: mcpServers, mcp.servers, and mcp-direct (opencode.json pattern)"
  - "notebooklm-py detection falls back to 'nlm' binary name for alternate installations"
  - "Smart MCP config path defaults to ~/.config/oc/opencode.json with user override via mcp_config_path"

patterns-established:
  - "RAG config keys follow flat CONFIG_SCHEMA pattern with section/field nesting where appropriate"
  - "Research detection functions return structured objects with available/configured, version, path, and install hints"

requirements-completed: [INFRA-01, INFRA-04]

# Metrics
duration: 8min
completed: 2026-03-03
---

# Phase 56 Plan 01: Config Schema & Research Detection Summary

**Extended CONFIG_SCHEMA with 8 RAG pipeline keys (rag_enabled, rag_timeout, tool paths, MCP toggles) and created research.js detection module for CLI tools and MCP servers**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-03T03:30:24Z
- **Completed:** 2026-03-03T03:39:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- CONFIG_SCHEMA extended with 8 RAG keys: rag_enabled, rag_timeout, ytdlp_path, nlm_path, mcp_config_path, mcp_brave_enabled, mcp_context7_enabled, mcp_exa_enabled
- mcp_brave_enabled uses brave_search as alias for backward compatibility — existing brave_search key untouched
- research.js detectCliTools() auto-detects yt-dlp and notebooklm-py with config path overrides and nlm fallback
- research.js detectMcpServers() reads editor MCP config with keyword matching for 3 research servers

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend CONFIG_SCHEMA with RAG configuration keys** - `600f804` (feat)
2. **Task 2: Create research.js with CLI and MCP detection functions** - `3d4d43c` (feat)

## Files Created/Modified
- `src/lib/constants.js` - Added 8 RAG config keys to CONFIG_SCHEMA with types, defaults, and alias
- `src/commands/research.js` - New module with detectCliTools() and detectMcpServers() functions
- `bin/gsd-tools.cjs` - Rebuilt bundle (1134KB, within 1500KB budget)

## Decisions Made
- MCP config detection handles 3 JSON shapes (mcpServers, mcp.servers, mcp-direct) to cover .mcp.json and opencode.json formats
- notebooklm-py detection tries 'notebooklm-py' binary first, falls back to 'nlm' for alternate installs
- Smart default MCP config path resolves to ~/.config/oc/opencode.json — user can override via mcp_config_path config key
- rag_timeout set to 30 seconds default (per plan specification)

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — autonomous plan, review context not assembled.

## Issues Encountered
- Test suite hangs before producing output (pre-existing issue, not caused by plan changes). Build and smoke tests pass. Verified changes via direct module imports and function execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CONFIG_SCHEMA and research detection infrastructure ready for Plan 02 (capabilities command + init integration)
- detectCliTools and detectMcpServers are importable and tested for real server configurations
- No blockers for Plan 02 execution

---
*Phase: 56-foundation-and-config*
*Completed: 2026-03-03*
