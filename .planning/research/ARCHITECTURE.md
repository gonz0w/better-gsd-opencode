# Architecture Research: v8.1 RAG-Powered Research Pipeline

**Domain:** RAG pipeline integration — external Python tools, CLI binary orchestration, multi-source research synthesis  
**Researched:** 2026-03-02  
**Overall confidence:** HIGH (integration patterns) / MEDIUM (NotebookLM API stability)  
**Mode:** Integration architecture for existing 34-module Node.js CLI codebase

## Executive Summary

v8.1 integrates three external tool categories into the existing gsd-tools research workflow: (1) **yt-dlp** for YouTube transcript/metadata extraction, (2) **notebooklm-py** for RAG-based research synthesis via Google NotebookLM, and (3) enhanced orchestration that feeds Brave Search results, Context7 docs, and YouTube content into NotebookLM for external synthesis. The central integration question: **how do these Python/binary tools integrate with a synchronous Node.js CLI that bundles to a single file via esbuild?**

The answer is clear: **use `execFileSync` for yt-dlp (binary tool, JSON output) and `execFileSync` for notebooklm-py CLI (Python package with CLI interface, JSON output)**. Both tools have CLI interfaces that accept arguments and return JSON — the exact same pattern gsd-tools already uses for `git`, binary version checks in `env.js`, and the `which` command. No Python service, no MCP servers, no async I/O rewrite needed.

The architecture adds **2 new source modules** (`src/lib/yt-dlp.js`, `src/lib/notebooklm.js`), **1 new command module** (`src/commands/research.js`), and **modifications to 3 existing modules** (config.js constants, router.js routing, init.js capability detection). Total new code: ~400-600 lines. Bundle impact: ~3-5KB (trivial wrapper functions, no bundled dependencies).

## Recommended Architecture

### High-Level Data Flow

```
                    ┌──────────────────────────┐
                    │   Research Workflow       │
                    │   (workflows/*.md)        │
                    │                           │
                    │  gsd-project-researcher   │
                    │  gsd-phase-researcher     │
                    └─────────┬────────────────┘
                              │ calls gsd-tools CLI
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  gsd-tools.cjs (router.js → commands/research.js)           │
│                                                              │
│  research:yt-search     → lib/yt-dlp.js → execFileSync     │
│  research:yt-transcript → lib/yt-dlp.js → execFileSync     │
│  research:nlm-create    → lib/notebooklm.js → execFileSync │
│  research:nlm-add       → lib/notebooklm.js → execFileSync │
│  research:nlm-ask       → lib/notebooklm.js → execFileSync │
│  research:nlm-report    → lib/notebooklm.js → execFileSync │
│  research:capabilities  → detect available tools            │
│                                                              │
└──────────┬──────────────────────────────────────┬───────────┘
           │                                      │
           ▼                                      ▼
    ┌──────────────┐                    ┌────────────────────┐
    │  yt-dlp      │                    │  notebooklm CLI    │
    │  (binary)    │                    │  (Python package)  │
    │              │                    │                    │
    │  --dump-json │                    │  notebooklm create │
    │  --write-sub │                    │  notebooklm source │
    │  --flat-play │                    │  notebooklm ask    │
    └──────────────┘                    │  notebooklm report │
                                        └────────────────────┘
```

### Data Flow for Full Research Pipeline

```
Step 1: Source Collection (parallel, via existing MCP tools + new CLI commands)
  ├─ Brave Search API        → JSON results        (existing: websearch command)
  ├─ Context7 MCP            → documentation        (existing: MCP tool)
  ├─ yt-dlp search           → video metadata JSON  (NEW: research:yt-search)
  └─ yt-dlp transcript       → subtitle text        (NEW: research:yt-transcript)

Step 2: Source Aggregation (new orchestration in workflow)
  └─ Collect all sources as text/URLs into temp files or direct arguments

Step 3: NotebookLM Synthesis (new CLI commands, sequential)
  ├─ notebooklm create "Research: {topic}"
  ├─ notebooklm source add {url1} {url2} ...
  ├─ notebooklm source add {transcript.txt} {search_results.md}
  ├─ notebooklm ask "Synthesize key findings about {topic}"
  └─ notebooklm generate report --format briefing-doc --wait

Step 4: Result Integration (workflow writes to .planning/research/)
  └─ Agent reads NotebookLM output → writes STACK.md, FEATURES.md, etc.
```

### Component Boundaries

| Component | Location | Responsibility | Communicates With |
|-----------|----------|---------------|-------------------|
| `src/lib/yt-dlp.js` | NEW lib module | Wrapper for yt-dlp binary: search, metadata, transcript extraction | `execFileSync('yt-dlp', ...)`, consumed by `commands/research.js` |
| `src/lib/notebooklm.js` | NEW lib module | Wrapper for notebooklm CLI: create, add sources, ask, generate, download | `execFileSync('notebooklm', ...)`, consumed by `commands/research.js` |
| `src/commands/research.js` | NEW command module | Route `research:*` subcommands, orchestrate multi-step operations | Calls lib/yt-dlp.js, lib/notebooklm.js, uses output.js, config.js |
| `src/lib/config.js` | EXISTING (constants addition) | New config keys for RAG tool paths and settings | Read by research.js, notebooklm.js, yt-dlp.js |
| `src/router.js` | EXISTING (add lazy loader + routes) | Route `research:*` namespace | Dispatches to commands/research.js |
| `src/commands/init.js` | EXISTING (capability detection) | Detect yt-dlp, python3, notebooklm availability at init time | Uses env.js checkBinary pattern |
| `workflows/new-milestone.md` | EXISTING (enhanced) | Orchestrate RAG pipeline when tools available | Calls research:* commands |
| `workflows/research-phase.md` | EXISTING (enhanced) | Per-phase RAG pipeline when tools available | Calls research:* commands |

## Integration Decisions

### Decision 1: execFileSync for All External Tools

**What:** Call yt-dlp and notebooklm as CLI subprocesses via `execFileSync`, not spawn, not a service, not MCP.

**Why:**
- gsd-tools is a synchronous CLI. Every external call (git, which, binary version checks) uses `execFileSync` already.
- Both yt-dlp and notebooklm-py have mature CLI interfaces that output JSON.
- `execFileSync` is the established pattern in `src/lib/git.js` (execGit) and `src/commands/env.js` (checkBinary).
- No async I/O rewrite needed (explicitly out of scope per PROJECT.md).
- No long-running service to manage — CLI starts, runs, returns.

**When not appropriate:** If NotebookLM generation takes >60 seconds (some operations like deep research or audio generation can take minutes). For those cases, use a two-step pattern: fire-and-forget with `execFileSync('notebooklm', ['generate', 'report', '--no-wait', '--json'])`, then poll with `execFileSync('notebooklm', ['research', 'wait', '--json', '--timeout', '300'])`.

**Code pattern (matching existing git.js):**

```javascript
// src/lib/yt-dlp.js
const { execFileSync } = require('child_process');
const { debugLog } = require('./output');

function execYtDlp(args, opts = {}) {
  const timeout = opts.timeout || 30000;
  try {
    const stdout = execFileSync('yt-dlp', args, {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout,
    });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    debugLog('yt-dlp.exec', 'exec failed', err);
    return {
      exitCode: err.status ?? 1,
      stdout: (err.stdout ?? '').toString().trim(),
      stderr: (err.stderr ?? '').toString().trim(),
    };
  }
}
```

**Confidence:** HIGH — this is the exact pattern used in git.js (verified, 401 lines of established usage).

### Decision 2: yt-dlp as Direct Binary Call (Not Python Import)

**What:** Call yt-dlp as a standalone binary (`execFileSync('yt-dlp', args)`), not via `python3 -m yt_dlp`.

**Why:**
- yt-dlp is typically installed as a standalone binary (`pip install yt-dlp` puts it on PATH, or via brew/apt).
- The CLI has comprehensive JSON output (`--dump-json`, `--print-json`, `-j`).
- YouTube search via `ytsearch5:query` extractor works from CLI.
- Subtitle/transcript extraction via `--write-subs --write-auto-subs --sub-langs en --skip-download`.
- No Python runtime dependency needed for this path — yt-dlp works as a Go/Rust-style static binary in many installs.

**Key yt-dlp CLI patterns (verified via Context7, HIGH confidence):**

```bash
# Search YouTube (returns JSON metadata for top N results)
yt-dlp --dump-json --flat-playlist "ytsearch10:nodejs best practices 2026"

# Get single video metadata without downloading
yt-dlp --dump-json --no-download "https://youtube.com/watch?v=..."

# Extract auto-generated subtitles (transcript) without downloading video
yt-dlp --write-auto-subs --sub-langs en --skip-download \
       --sub-format vtt -o "%(id)s" "https://youtube.com/watch?v=..."

# Get subtitles as stdout (JSON with subtitle data)
yt-dlp --dump-json "https://youtube.com/watch?v=..." | jq '.subtitles, .automatic_captions'
```

**Confidence:** HIGH — verified via Context7 yt-dlp docs (source reputation: High, benchmark 92.2).

### Decision 3: notebooklm-py CLI (Not Python API Import)

**What:** Call `notebooklm` CLI binary via `execFileSync`, not import the Python library.

**Why:**
- notebooklm-py provides a comprehensive CLI (`notebooklm create`, `notebooklm source add`, `notebooklm ask`, etc.).
- The CLI supports `--json` output on many commands (machine-readable).
- Avoids embedding Python runtime or creating a service layer.
- Matches the yt-dlp pattern — both are "shell out to CLI, parse JSON" tools.
- The CLI handles auth state persistence (`~/.notebooklm/storage_state.json`).

**Key notebooklm CLI patterns (verified via GitHub README, MEDIUM confidence — unofficial API):**

```bash
# Create notebook
notebooklm create "Research: RAG Pipeline Architecture"

# Set active notebook
notebooklm use <notebook_id>

# Add sources (auto-detects type: URL, file, YouTube)
notebooklm source add "https://example.com/article"
notebooklm source add "./research-data.md"
notebooklm source add "https://youtube.com/watch?v=..."

# Ask questions (RAG query against all sources)
notebooklm ask "What are the key architectural patterns?" --json

# Generate report
notebooklm generate report --format briefing-doc --wait

# Download report
notebooklm download report ./synthesis.md
```

**Critical caveat:** notebooklm-py uses **undocumented Google APIs**. The library warns: "APIs may break — Google can change internal endpoints anytime." There is now also an official **NotebookLM Enterprise API** (Google Cloud, released Sept 2025, Pre-GA as of Feb 2026) but it requires Google Cloud project setup, IAM roles, and is enterprise-oriented. The unofficial notebooklm-py remains the pragmatic choice for individual developer tooling.

**Confidence:** MEDIUM — the tool works and is well-maintained (2.4k stars, v0.3.2, active development), but it depends on undocumented APIs that could break.

### Decision 4: Configuration in `.planning/config.json`

**What:** Add RAG tool configuration to the existing config.json schema, not a separate config file.

**Why:**
- All other settings live in `.planning/config.json` (loaded by `src/lib/config.js`).
- The CONFIG_SCHEMA pattern in `src/lib/constants.js` provides defaults, types, descriptions, and aliases.
- API keys should come from environment variables (not config files) — matching the existing `BRAVE_API_KEY` pattern.

**New config keys:**

```javascript
// Add to CONFIG_SCHEMA in src/lib/constants.js
rag_enabled:           { type: 'boolean', default: true,  description: 'Enable RAG research pipeline when tools available', aliases: [], nested: null },
yt_dlp_path:           { type: 'string',  default: 'yt-dlp', description: 'Path to yt-dlp binary', aliases: [], nested: null },
notebooklm_path:       { type: 'string',  default: 'notebooklm', description: 'Path to notebooklm CLI', aliases: [], nested: null },
yt_search_count:       { type: 'number',  default: 5,     description: 'Number of YouTube results per search', aliases: [], nested: null },
nlm_report_format:     { type: 'string',  default: 'briefing-doc', description: 'NotebookLM report format', aliases: [], nested: null },
```

**API keys via environment variables (not config.json):**
- `BRAVE_API_KEY` — already exists
- `NOTEBOOKLM_HOME` — notebooklm-py's own config dir (default: `~/.notebooklm`)
- No additional API keys needed — notebooklm-py uses browser-based auth stored in `~/.notebooklm/storage_state.json`

**Confidence:** HIGH — follows established config pattern exactly.

### Decision 5: Runtime Capability Detection

**What:** Detect tool availability at init time using the existing `checkBinary()` pattern from `env.js`.

**Why:**
- `env.js` already has `checkBinary(binaryName, versionFlag)` that returns `{ available, version, path }`.
- Research workflows need to know what's available to choose fallback strategies.
- Detection happens once per CLI invocation (cached in init output).

**Implementation:**

```javascript
// In src/commands/init.js or src/commands/research.js
function detectResearchCapabilities(config) {
  const checkBinary = require('./env').checkBinary;  // reuse existing
  
  return {
    yt_dlp: checkBinary(config.yt_dlp_path || 'yt-dlp', '--version'),
    notebooklm: checkBinary(config.notebooklm_path || 'notebooklm', '--version'),
    python3: checkBinary('python3', '--version'),
    brave_search: !!process.env.BRAVE_API_KEY,
    // Context7 detected via MCP server discovery (already exists)
  };
}
```

**Exposed in init output:**

```json
{
  "rag_capabilities": {
    "yt_dlp": { "available": true, "version": "2025.01.15", "path": "/usr/local/bin/yt-dlp" },
    "notebooklm": { "available": true, "version": "0.3.2", "path": "/usr/local/bin/notebooklm" },
    "brave_search": true,
    "pipeline_ready": true
  }
}
```

**`pipeline_ready`** is `true` when at least notebooklm is available (the core synthesis engine). yt-dlp and Brave Search are supplementary sources.

**Confidence:** HIGH — reuses existing `checkBinary` function verbatim.

### Decision 6: gsd-tools Commands (Not MCP Servers, Not External Scripts)

**What:** Implement RAG features as `research:*` namespace commands in gsd-tools, not as MCP servers or standalone scripts.

**Why:**
- **Not MCP servers** because: gsd-tools doesn't connect to MCP at runtime (static analysis only, per PROJECT.md). MCP servers are for the host editor's agent framework, not for gsd-tools internals. The research agents already have access to Context7 and Brave Search MCP tools directly — gsd-tools just needs to provide the yt-dlp and NotebookLM wrappers that MCP doesn't cover.
- **Not external scripts** because: gsd-tools is a single-file CLI. External scripts would break the deploy model (`deploy.sh` copies one file). All logic should be in `src/` modules bundled by esbuild.
- **gsd-tools commands** because: follows the established pattern. Agents call `node gsd-tools.cjs research:yt-search "query"` just like they call `node gsd-tools.cjs util:websearch "query"`. Same JSON-over-stdout interface, same error handling, same profiler instrumentation.

**New commands in `research:` namespace:**

| Command | Purpose | Output |
|---------|---------|--------|
| `research:capabilities` | Detect available RAG tools | JSON: `{ yt_dlp, notebooklm, brave_search, pipeline_ready }` |
| `research:yt-search <query>` | Search YouTube for developer content | JSON: `{ videos: [{ id, title, duration, channel, views, url }] }` |
| `research:yt-transcript <url>` | Extract transcript from YouTube video | JSON: `{ video_id, title, transcript_text, language }` |
| `research:yt-metadata <url>` | Get full video metadata | JSON: full yt-dlp info dict |
| `research:nlm-create <title>` | Create NotebookLM notebook | JSON: `{ notebook_id, title }` |
| `research:nlm-add-source <content>` | Add source to active notebook | JSON: `{ source_id, type }` |
| `research:nlm-ask <question>` | Query NotebookLM | JSON: `{ answer, sources }` |
| `research:nlm-report [desc]` | Generate synthesis report | JSON: `{ report_text }` or `{ task_id }` |
| `research:nlm-status` | Check NotebookLM auth and notebook status | JSON: `{ authenticated, active_notebook }` |

**Confidence:** HIGH — follows established namespace routing pattern from v8.0.

## Module Impact Analysis

### New Modules (3)

| Module | Lines (est.) | Dependencies | Purpose |
|--------|-------------|-------------|---------|
| `src/lib/yt-dlp.js` | ~120 | output.js, profiler.js, config.js | yt-dlp binary wrapper: search, metadata, transcript |
| `src/lib/notebooklm.js` | ~180 | output.js, profiler.js, config.js | notebooklm CLI wrapper: CRUD notebooks, sources, ask, generate |
| `src/commands/research.js` | ~250 | lib/yt-dlp.js, lib/notebooklm.js, output.js, config.js | Command handlers for research:* namespace |

Total: ~550 lines, 3 new modules (34 → 37 modules).

### Modified Modules (4)

| Module | Change | Impact |
|--------|--------|--------|
| `src/lib/constants.js` | Add 5 CONFIG_SCHEMA entries, add COMMAND_HELP entries | ~30 lines, low risk |
| `src/router.js` | Add `lazyResearch()` loader, add `research:` case block | ~25 lines, follows existing pattern |
| `src/commands/init.js` | Add `rag_capabilities` to init:new-project and init:new-milestone output | ~20 lines, additive only |
| `src/commands/env.js` | Export `checkBinary` (currently local function) | 1 line change, adding to module.exports |

### Unmodified Modules (30)

All other modules remain untouched. No changes to: cache.js, git.js, helpers.js, format.js, output.js, profiler.js, frontmatter.js, ast.js, context.js, regex-cache.js, orchestration.js, conventions.js, deps.js, lifecycle.js, codebase-intel.js, recovery/stuck-detector.js, review/*.js, or any existing command module.

### Bundle Impact

- New code: ~550 lines × ~50 bytes/line = ~27KB raw
- After esbuild (minify:false): ~25KB
- Current bundle: ~1133KB, budget: 1500KB
- Post-change: ~1158KB — **well within budget**

## Patterns to Follow

### Pattern 1: Graceful Degradation (Tiered Fallback)

**What:** Every RAG feature degrades gracefully when tools are missing. Research never fails — it just uses fewer sources.

**When:** Always. Tools are explicitly optional per PROJECT.md requirements.

**Implementation:**

```javascript
// In workflow (pseudo-code showing fallback tiers)

// Tier 1: Full RAG pipeline (notebooklm + yt-dlp + brave + context7)
//   → NotebookLM synthesizes all sources externally
//   → Minimal LLM token spend for final integration

// Tier 2: Partial pipeline (yt-dlp + brave + context7, no notebooklm)
//   → Sources collected but synthesis done by LLM in-context
//   → More token spend but still better source diversity

// Tier 3: Enhanced search (brave + context7, no yt-dlp, no notebooklm)
//   → Current v8.0 behavior with Brave Search
//   → Standard researcher agent workflow

// Tier 4: Baseline (context7 only or no tools)
//   → Pure LLM research from training data + Context7 MCP
//   → Works with zero configuration
```

**Detection in workflow:**

```bash
# Agent checks at start of research
CAPS=$(node $GSD_HOME/bin/gsd-tools.cjs research:capabilities)
# Returns: { "pipeline_ready": true/false, "tier": 1-4, "available": [...], "missing": [...] }
```

### Pattern 2: JSON Subprocess Protocol

**What:** All external tool calls follow the same pattern: `execFileSync` → parse JSON stdout → return structured result.

**When:** Every yt-dlp and notebooklm call.

**Example:**

```javascript
function searchYouTube(query, count = 5) {
  const result = execYtDlp([
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    `ytsearch${count}:${query}`
  ], { timeout: 30000 });
  
  if (result.exitCode !== 0) {
    return { error: result.stderr, videos: [] };
  }
  
  // yt-dlp outputs one JSON object per line for flat-playlist
  const videos = result.stdout.split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean)
    .map(info => ({
      id: info.id,
      title: info.title,
      duration: info.duration,
      channel: info.channel || info.uploader,
      view_count: info.view_count,
      url: info.url || `https://youtube.com/watch?v=${info.id}`,
      upload_date: info.upload_date,
    }));
  
  return { query, count: videos.length, videos };
}
```

### Pattern 3: Timeout-Aware Execution

**What:** Different timeouts for different operations. yt-dlp search is fast (5-15s), NotebookLM operations vary widely.

**When:** All external calls.

```javascript
const TIMEOUTS = {
  YT_SEARCH: 30000,       // 30s — network search
  YT_METADATA: 15000,     // 15s — single video info
  YT_TRANSCRIPT: 45000,   // 45s — subtitle download + processing
  NLM_CREATE: 10000,      // 10s — create notebook
  NLM_ADD_SOURCE: 30000,  // 30s — upload/import source
  NLM_ASK: 60000,         // 60s — RAG query
  NLM_GENERATE: 15000,    // 15s — start generation (returns task_id)
  NLM_WAIT: 300000,       // 5 min — wait for async generation
};
```

### Pattern 4: Temporary File Management for Large Content

**What:** Use temp files for passing large content (transcripts, search results) to NotebookLM, rather than command-line arguments.

**When:** Content exceeds ~4KB (shell argument length limits).

```javascript
const os = require('os');
const path = require('path');
const fs = require('fs');

function writeTemp(content, prefix = 'gsd-research') {
  const tmpFile = path.join(os.tmpdir(), `${prefix}-${Date.now()}.md`);
  fs.writeFileSync(tmpFile, content, 'utf-8');
  return tmpFile;
}

// Usage: pass transcript as file source to NotebookLM
const tmpPath = writeTemp(transcriptText, 'yt-transcript');
execNotebookLM(['source', 'add', tmpPath]);
fs.unlinkSync(tmpPath);  // cleanup
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Python Service / Long-Running Process

**What:** Running a Python HTTP server or daemon that gsd-tools connects to.

**Why bad:** 
- Violates the CLI tool model (start → run → exit in <5s).
- Adds process lifecycle management (start/stop/health check).
- No existing pattern for this in gsd-tools.
- Deployment complexity (deploy.sh can't handle multi-process).

**Instead:** Use `execFileSync` to call CLI binaries. Each command invocation is stateless and isolated.

### Anti-Pattern 2: MCP Server for Internal Tools

**What:** Creating MCP servers for yt-dlp or notebooklm so the agent calls them via MCP.

**Why bad:**
- gsd-tools doesn't connect to MCP at runtime — it only does static MCP analysis.
- The host editor agent already has MCP access to Context7 and Brave Search. For tools not available as MCP servers (yt-dlp, notebooklm), the agent calls gsd-tools CLI instead.
- Adding MCP servers would be a parallel channel that bypasses gsd-tools' JSON-over-stdout protocol, profiler instrumentation, and debug logging.

**Instead:** Wrap tools as `research:*` gsd-tools commands. Agent calls `node gsd-tools.cjs research:yt-search "query"` — same interface as everything else.

**Exception:** If someone publishes a well-maintained yt-dlp or notebooklm MCP server in the future, that could be **recommended in `mcp-profile`** output (like brave-search is today), but gsd-tools still needs its own wrappers for when MCP isn't available.

### Anti-Pattern 3: Bundling Python Dependencies

**What:** Including notebooklm-py or yt-dlp Python code in the esbuild bundle.

**Why bad:**
- esbuild bundles JavaScript. Python can't be bundled.
- These are system-installed tools, not project dependencies.
- Including binary paths or wrappers in the bundle is fine; including the tools themselves is not.

**Instead:** Detect at runtime, degrade gracefully if missing.

### Anti-Pattern 4: Async/Await Throughout the Pipeline

**What:** Rewriting the pipeline to use async I/O for external tool calls.

**Why bad:**
- PROJECT.md explicitly lists "Async I/O rewrite" as out of scope.
- `execFileSync` is correct for CLI tools — the process blocks waiting for results, which is fine for a tool that runs in <5s.
- The only async exception is `cmdWebsearch` (uses `fetch`), which is already isolated.

**Instead:** Use `execFileSync` for subprocess calls. For long-running NotebookLM operations, use the fire-and-poll pattern (start → return task_id → poll in workflow loop).

### Anti-Pattern 5: Storing NotebookLM Auth in config.json

**What:** Putting Google auth tokens or session cookies in `.planning/config.json`.

**Why bad:**
- config.json is committed to git. Auth tokens must never be committed.
- notebooklm-py manages its own auth in `~/.notebooklm/storage_state.json`.
- There's no reason for gsd-tools to manage notebooklm auth.

**Instead:** Let notebooklm-py handle its own auth. Detection only: `notebooklm auth check --json` returns `{ "authenticated": true/false }`.

## Build Order

Given the dependency structure, build in this order:

### Phase 1: Foundation (no external dependencies)

1. **Add CONFIG_SCHEMA entries** in `src/lib/constants.js`
   - 5 new config keys: `rag_enabled`, `yt_dlp_path`, `notebooklm_path`, `yt_search_count`, `nlm_report_format`
   - COMMAND_HELP entries for all `research:*` commands
   - Zero risk, additive only

2. **Export `checkBinary`** from `src/commands/env.js`
   - Currently a local function, needs to be in `module.exports`
   - 1-line change

### Phase 2: Tool Wrappers (independent, can parallelize)

3. **Create `src/lib/yt-dlp.js`**
   - `execYtDlp(args, opts)` — base execution wrapper
   - `searchYouTube(query, count)` — search via `ytsearch`
   - `getVideoMetadata(url)` — `--dump-json` single video
   - `extractTranscript(url, lang)` — subtitle extraction
   - Tests: mock execFileSync, verify JSON parsing, verify error handling

4. **Create `src/lib/notebooklm.js`**
   - `execNotebookLM(args, opts)` — base execution wrapper
   - `createNotebook(title)` — create + return id
   - `addSource(content)` — add URL/file/text
   - `askQuestion(question)` — RAG query
   - `generateReport(description, format)` — start report generation
   - `checkAuth()` — verify auth status
   - `waitForGeneration(taskId, timeout)` — poll until complete
   - Tests: mock execFileSync, verify JSON parsing, verify timeout handling

### Phase 3: Command Integration

5. **Create `src/commands/research.js`**
   - Command handlers for all `research:*` subcommands
   - `cmdResearchCapabilities(cwd, raw)` — aggregate detection
   - `cmdYtSearch(query, opts, raw)`, `cmdYtTranscript(url, opts, raw)`, etc.
   - `cmdNlmCreate(title, raw)`, `cmdNlmAddSource(content, raw)`, etc.
   - Uses output.js for JSON/formatted output
   - Uses profiler.js for timing instrumentation

6. **Add routing in `src/router.js`**
   - `lazyResearch()` loader
   - `case 'research':` in namespace switch
   - Subcommand dispatch (yt-search, yt-transcript, nlm-create, etc.)

### Phase 4: Integration

7. **Add capability detection in `src/commands/init.js`**
   - `rag_capabilities` field in init:new-project and init:new-milestone output
   - Calls `detectResearchCapabilities()` from research.js

8. **Update workflows**
   - `workflows/new-milestone.md` — check capabilities, use RAG when available
   - `workflows/research-phase.md` — check capabilities, use RAG when available
   - `agents/gsd-project-researcher.md` — document research:* commands
   - `agents/gsd-phase-researcher.md` — document research:* commands

### Phase 5: Testing & Polish

9. **Integration tests**
   - Contract tests for research:capabilities output shape
   - Mock-based tests for yt-dlp and notebooklm wrappers
   - Graceful degradation tests (tool not found → returns appropriate error JSON)
   - Build smoke test (esbuild bundles without errors)

## Scalability Considerations

| Concern | At single-user CLI | At team usage | Notes |
|---------|-------------------|---------------|-------|
| yt-dlp rate limiting | Negligible (5 searches/research session) | YouTube may throttle | Add retry with backoff |
| NotebookLM rate limiting | "Heavy usage may be throttled" (per docs) | Likely problematic | Monitor, add rate limit detection |
| Auth management | `notebooklm login` once, persists | Per-user auth, not shared | Each user manages their own |
| API stability | Unofficial APIs may break | Same risk at any scale | Pin notebooklm-py version, test regularly |
| Bundle size | +25KB (~2% of budget) | Same | Well within 1500KB budget |
| Transcript size | ~100KB per hour of video | Same per video | Use temp files, clean up after |

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| NotebookLM API breaks (unofficial) | HIGH | MEDIUM | Graceful fallback to Tier 2-4; pin version; monitor GitHub issues |
| Official NotebookLM Enterprise API replaces unofficial | LOW | MEDIUM | notebooklm-py may add official backend; architecture is CLI-agnostic |
| yt-dlp YouTube changes | MEDIUM | LOW | yt-dlp actively maintained, updates quickly; version pin |
| Auth complexity for notebooklm-py | MEDIUM | MEDIUM | Browser-based auth is interactive; document clearly; detect with `auth check` |
| execFileSync timeout on slow operations | MEDIUM | MEDIUM | Generous timeouts; fire-and-poll pattern for long ops |
| Bundle size regression | LOW | LOW | +25KB is negligible against 1500KB budget |

## Sources

- **Context7 yt-dlp docs** — `/yt-dlp/yt-dlp` (source reputation: High, benchmark: 92.2). Verified: metadata extraction, subtitle writing, search, JSON output. HIGH confidence.
- **notebooklm-py GitHub** — `github.com/teng-lin/notebooklm-py` (2.4k stars, v0.3.2, MIT). Verified: CLI reference, Python API, installation. MEDIUM confidence (unofficial API).
- **notebooklm-py CLI Reference** — Raw docs from `docs/cli-reference.md`. Verified: all command signatures, --json support, --wait patterns. MEDIUM confidence.
- **Google NotebookLM Enterprise API** — `docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks` (Pre-GA, last updated 2026-02-26). Verified: REST API exists, requires GCP project. HIGH confidence for official API existence, but not recommended for this use case.
- **Existing codebase** — Verified: git.js execGit pattern (401 lines), env.js checkBinary (39 lines), misc.js cmdWebsearch (62 lines), config.js loadConfig (76 lines), router.js namespace routing (1585 lines), init.js capability detection. HIGH confidence.
