# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**Web Search:**
- Brave Search API - Web search for research pipeline
  - SDK: subprocess via `util:websearch` command
  - Auth: enabled via `brave_search` config flag (default: false)
  - Usage: Multi-source collection pipeline, web research

**MCP Servers (Optional):**
- Context7 MCP - Library/API documentation lookup
  - Access: Agent-accessed directly, no SDK in codebase
  - Config: `mcp_config_path` env var for server config location
- Exa MCP - Alternative search provider (mentioned in capabilities)
  - Status: Listed as available but not actively used

**YouTube Research:**
- yt-dlp - Video search and transcript extraction
  - Binary: External dependency, auto-detected via `ytdlp_path` config
  - Usage: `research yt-search`, `research yt-transcript` commands
  - Quality scoring: Recency (40pts) + Views (30pts) + Duration (30pts)

**NotebookLM RAG:**
- notebooklm-py - RAG synthesis for research sources
  - Binary: External dependency, auto-detected via `nlm_path` config
  - Usage: `research nlm-create`, `research nlm-add-source` commands
  - Auth: Requires separate authentication flow

## Data Storage

**Databases:**
- SQLite - Local state persistence
  - Location: `.opencode/opencode.db` (OpenCode-managed)
  - Client: Native Node.js bindings via OpenCode plugin
  - Purpose: Project state, session data, memory store

**File System:**
- Git repository - Version control integration
  - Operations: commit, diff, blame, branch management
  - Branching strategies: none (default), phase-based, milestone-based templates
  - Workspace isolation: JJ (Jujutsu) workspaces in `/tmp/gsd-workspaces/`

**File Storage:**
- Local filesystem only - No cloud storage integration detected
- Planning documents: `.planning/` directory structure
- Memory store: `.planning/memory/` for structured entries

## Authentication & Identity

**Auth Provider:**
- Custom implementation - No external auth provider detected
- NotebookLM: Separate OAuth flow (handled by notebooklm-py binary)
- Model settings: Configurable per-agent model profiles (gpt-5.4, gpt-5.4-mini, gpt-5.4-nano)

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, LogRocket, or similar integration

**Logs:**
- Console logging only - `console.log` throughout codebase
- Structured output: JSON mode for CLI commands via `--raw` flag
- Session handoff: `execute:session-summary` command for context transfer

## CI/CD & Deployment

**Hosting:**
- OpenCode editor plugin - Primary deployment target
  - Installer: `install.js` mirrors `deploy.sh` functionality
  - Manifest: `bin/manifest.json` (5.7KB) defines commands, agents, workflows

**CI Pipeline:**
- npm test - Full test suite execution (762+ tests)
- Pre-commit hooks: Not detected in repository
- CodeQL check: `scripts/codeql-check.cjs` for security scanning

## Environment Configuration

**Required env vars:**
- None strictly required - All configuration via `.planning/config.json`
- Optional tool paths: `ytdlp_path`, `nlm_path`, `mcp_config_path` (auto-detect if empty)

**Secrets location:**
- Model API keys: Handled by OpenCode editor environment
- NotebookLM auth: External OAuth flow via notebooklm-py binary
- No `.env` files detected in repository

## Webhooks & Callbacks

**Incoming:**
- Not detected - No webhook endpoints or callback handlers

**Outgoing:**
- GitHub API: Via `gh` CLI tool (configurable, default enabled)
  - Usage: PR creation, branch operations via `util:git trajectory-branch --push`
  - Auth: Handled by `gh` CLI authentication

## Research Pipeline Tiers

**Tier 1 — Full RAG:**
- All tools active + NotebookLM synthesis
- Requires: Brave Search API, yt-dlp, notebooklm-py, MCP servers

**Tier 2 — Sources without Synthesis:**
- YouTube + MCP sources, LLM synthesizes
- Requires: Brave Search API or MCP servers

**Tier 3 — Brave/Context7 Only:**
- Web search, no video capability
- Requires: Brave Search API enabled

**Tier 4 — Pure LLM:**
- No external tools available
- Fallback mode when all research tools missing

---

*Integration audit: 2026-04-06*
