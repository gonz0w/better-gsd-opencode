# Architecture: v9.0 Embedded Plugin Experience

**Domain:** OpenCode plugin architecture for deeply embedded bGSD experience
**Researched:** 2026-03-08
**Overall confidence:** HIGH
**Focus:** How plugin.js should evolve to support 20+ hooks, custom tools, event handlers, and state management

## Current Architecture

### Plugin Today (45 lines)

```
plugin.js (ESM, single file, 45 lines)
├── BgsdPlugin({ directory }) → hook map
├── session.created → console.log greeting
├── shell.env → inject GSD_HOME
└── experimental.session.compacting → read STATE.md, push to context
```

Deployed as: `~/.config/opencode/plugins/bgsd.js` (raw file copy from `plugin.js`)

### CLI Today (1163KB CJS bundle)

```
src/ (34 modules, ESM-authored, CJS output)
├── index.js → router.js → lazy-loaded command modules
├── lib/ (18 modules: helpers, git, cache, config, format, ...)
└── commands/ (18 modules: state, roadmap, phase, verify, ...)
    ↓ esbuild
bin/gsd-tools.cjs (single file, CJS, Node.js built-ins externalized)
```

### Current Interaction Model

```
Agent (LLM)
  ↓ bash tool
  node ~/.config/oc/get-shit-done/bin/gsd-tools.cjs verify:state
  ↓ stdout (JSON)
Agent reads JSON, makes decisions
```

Every CLI call:
1. Spawns a new Node.js process
2. Parses all args, loads router
3. Lazy-loads the specific command module
4. Reads files from disk (with SQLite L2 cache)
5. Outputs JSON to stdout
6. Process exits

Cost: ~50-200ms per invocation, process overhead, no shared state between calls.

### OpenCode Plugin SDK Surface (Verified)

**Source:** Official OpenCode docs (opencode.ai/docs/plugins, /sdk, /custom-tools), Context7 /websites/opencode_ai_plugins, /anomalyco/opencode. **Confidence: HIGH.**

**Plugin init context:**
```javascript
async ({ project, client, $, directory, worktree }) => { ... }
```
- `project` — Current project info
- `client` — OpenCode SDK client (sessions, messages, TUI, files, events)
- `$` — Bun shell API for command execution
- `directory` — Current working directory
- `worktree` — Git worktree path

**Available hooks (flat map, not nested):**

| Category | Hooks | Input/Output Pattern |
|----------|-------|---------------------|
| Session | `session.created`, `session.compacted`, `session.deleted`, `session.diff`, `session.error`, `session.idle`, `session.status`, `session.updated` | Event-style |
| Shell | `shell.env` | `(input, output)` — mutate `output.env` |
| Tool | `tool.execute.before`, `tool.execute.after` | `(input, output)` — intercept/modify |
| File | `file.edited`, `file.watcher.updated` | Event-style |
| Message | `message.part.removed`, `message.part.updated`, `message.removed`, `message.updated` | Event-style |
| Command | `command.executed` | Event-style |
| TUI | `tui.prompt.append`, `tui.command.execute`, `tui.toast.show` | Event-style |
| Permission | `permission.asked`, `permission.replied` | Event-style |
| Compaction | `experimental.session.compacting` | `(input, output)` — push to `output.context` or set `output.prompt` |

**Custom tools:**
```javascript
import { tool } from "@opencode-ai/plugin"
tool({
  description: "...",
  args: { foo: tool.schema.string() },  // Zod schema
  async execute(args, context) {
    const { agent, sessionID, messageID, directory, worktree } = context
    return "result string"
  }
})
```

**Event subscription (via `event` key):**
```javascript
event: async ({ event }) => {
  if (event.type === "session.idle") { ... }
}
```

**SDK client capabilities:**
- `client.tui.showToast({ body: { message, variant } })` — toast notifications
- `client.tui.appendPrompt({ body: { text } })` — inject text to prompt
- `client.session.prompt(...)` — send prompt to session (with noReply for context-only)
- `client.app.log(...)` — structured logging
- `client.file.read/find.*` — file operations

---

## Decision 1: Single File vs Multi-Module Plugin

### Recommendation: **Split into src/plugin/ modules, bundle to single ESM file via esbuild**

**Confidence: HIGH**

**Rationale:**

The plugin will grow from 45 lines to 500-800+ lines handling 20+ hooks, 5-10 custom tools, event handlers, state management, and context building. A single `plugin.js` file at that size is unmaintainable.

**Architecture:**

```
src/plugin/                         ← Development source (ESM)
├── index.js                        ← Plugin entry: init, wire hooks, export
├── hooks/
│   ├── session.js                  ← session.created, session.idle, session.compacted
│   ├── shell.js                    ← shell.env
│   ├── compaction.js               ← experimental.session.compacting
│   ├── tools.js                    ← tool.execute.before, tool.execute.after
│   └── files.js                    ← file.edited, file.watcher.updated
├── tools/
│   ├── state.js                    ← gsd_state tool (replaces verify:state CLI)
│   ├── progress.js                 ← gsd_progress tool
│   ├── context.js                  ← gsd_context tool (phase/plan context)
│   └── plan.js                     ← gsd_plan_info tool
├── state/
│   ├── project-state.js            ← In-memory project state cache
│   └── file-watcher.js             ← File change tracking
├── context/
│   ├── builder.js                  ← System prompt context builder
│   └── parser.js                   ← STATE.md / ROADMAP.md parser (extract from CLI)
└── utils.js                        ← Shared helpers (gsd-tools exec, path resolution)
```

**Build pipeline addition to build.cjs:**

```javascript
// Second esbuild target: plugin bundle
await esbuild.build({
  entryPoints: ['src/plugin/index.js'],
  outfile: 'plugin.js',             // Output to project root (deploy copies to plugins/bgsd.js)
  bundle: true,
  platform: 'node',
  format: 'esm',                    // Plugin MUST be ESM (OpenCode loads as ESM)
  target: 'node18',
  external: ['node:*', '@opencode-ai/plugin'],  // Externalize SDK + Node builtins
  banner: { js: '// bGSD Plugin — bundled from src/plugin/' },
});
```

**Key constraints:**
- Output must be ESM (OpenCode loads plugins as ES modules)
- `@opencode-ai/plugin` must be externalized (provided by OpenCode runtime)
- Node.js built-ins externalized as today
- Single output file `plugin.js` — deployment pipeline unchanged
- `deploy.sh` and `install.js` continue copying `plugin.js` → `plugins/bgsd.js`

**What this preserves:**
- Single-file deployment (bundle output is one file)
- No new runtime dependencies
- Existing deploy.sh/install.js logic unchanged
- Build produces both `bin/gsd-tools.cjs` (CJS) and `plugin.js` (ESM) from same source tree

---

## Decision 2: How Custom Tools Call gsd-tools.cjs

### Recommendation: **Hybrid — direct module import for hot paths, execFileSync for long-tail commands**

**Confidence: HIGH**

**Three options evaluated:**

| Approach | Latency | Complexity | Shared State | Type Safety |
|----------|---------|------------|-------------|-------------|
| `execFileSync` (current) | 50-200ms/call | Low | None | None |
| Direct `require()` of src/ modules | <1ms | Medium | Yes (in-memory) | Full |
| SDK client (`client.session.shell()`) | Variable | Low | None | None |

**Analysis:**

1. **execFileSync** (spawn `node gsd-tools.cjs ...`): Current pattern. Works but slow. Each tool call during a conversation means agent waits 50-200ms for process spawn + parse + respond. For hot-path tools that get called multiple times per session (state, progress), this is wasteful.

2. **Direct module import**: The CLI's src/ modules are CJS (`require()`-based), while the plugin is ESM. Direct `require()` from ESM is possible via `createRequire()`. However, the CLI modules use globals (`global._gsdOutputMode`, `process.cwd()`) and synchronous I/O that may not compose well in a long-lived plugin context.

3. **SDK client**: Uses OpenCode's internal shell execution. Adds unnecessary indirection — the plugin already has Node.js access.

**Recommended hybrid approach:**

```
┌──────────────────────────────────────────────────────────┐
│                     plugin.js (ESM)                       │
│                                                           │
│  Hot-path tools (< 5 tools)          Long-tail commands   │
│  ┌─────────────────────┐            ┌──────────────────┐ │
│  │ Import lightweight   │            │ execFileSync     │ │
│  │ parsers directly:    │            │ gsd-tools.cjs:   │ │
│  │ - STATE.md parser    │            │ - commit         │ │
│  │ - ROADMAP.md parser  │            │ - verify         │ │
│  │ - PLAN.md parser     │            │ - phase ops      │ │
│  │ - config.json reader │            │ - memory         │ │
│  └─────────────────────┘            └──────────────────┘ │
│                                                           │
│  Shared: project-state.js (in-memory cache layer)        │
└──────────────────────────────────────────────────────────┘
```

**Implementation strategy:**

Extract the core parsing functions (STATE.md, ROADMAP.md, PLAN.md) into a shared `src/lib/parsers.js` module with no side effects (no globals, no process.cwd, pure functions taking `filePath` or `content` as arguments). These parsers can then be:
- Bundled into `bin/gsd-tools.cjs` (CJS, as today) for CLI use
- Bundled into `plugin.js` (ESM) for plugin use

This avoids duplicating logic. Both targets consume the same source module.

**For CLI commands that mutate state** (commit, verify, phase operations, memory writes), continue using `execFileSync` via a helper:

```javascript
// src/plugin/utils.js
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

export function gsdExec(gsdHome, command, args = [], options = {}) {
  const cliPath = join(gsdHome, 'bin', 'gsd-tools.cjs')
  const result = execFileSync('node', [cliPath, command, ...args], {
    encoding: 'utf-8',
    timeout: options.timeout || 10000,
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
  })
  return JSON.parse(result)
}
```

---

## Decision 3: Context Injection Data Flow

### Recommendation: **Read → Parse → Cache → Inject on session.created and session.updated**

**Confidence: HIGH**

**Data flow for always-on context:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Context Injection Flow                       │
│                                                                     │
│  1. Plugin init → read .planning/STATE.md, ROADMAP.md, config.json │
│  2. Parse into structured data (ProjectState object)               │
│  3. Cache in memory (ProjectState singleton)                       │
│  4. On session.created:                                            │
│     → Build context string from ProjectState                       │
│     → client.session.prompt({ noReply: true, parts: [context] })   │
│  5. On file.watcher.updated (STATE.md, ROADMAP.md):                │
│     → Re-parse changed file                                        │
│     → Update ProjectState cache                                     │
│     → (Context auto-refreshes on next session interaction)          │
└─────────────────────────────────────────────────────────────────────┘
```

**Context string format (injected as system prompt context):**

```markdown
## bGSD Project Context

**Milestone:** v9.0 Embedded Plugin Experience
**Phase:** 03 — Custom Tools (IN PROGRESS)
**Plan:** 03-02-PLAN.md — Task 3 of 5
**Blockers:** None
**Last session:** 2026-03-08 14:30 — Implemented state parser

### Active Plan Tasks
- [x] Task 1: Create tool schema definitions
- [x] Task 2: Implement gsd_state tool
- [ ] Task 3: Implement gsd_progress tool  ← CURRENT
- [ ] Task 4: Wire tools into plugin.js
- [ ] Task 5: Test tool invocations
```

**Why `client.session.prompt({ noReply: true })` for context injection:**
- The OpenCode plugin SDK does not expose a `system.prompt` hook for modifying system prompts directly
- `noReply: true` injects a user message as context without triggering an AI response
- This is the documented pattern for plugin-based context injection
- Alternative: Could use `experimental.session.compacting` for compaction context, but that only fires during compaction — not at session start

**Context size budget:** Target < 500 tokens for the always-on context injection. Larger context (full plan tasks, recent decisions) loaded on-demand via custom tools.

---

## Decision 4: State Management Strategy

### Recommendation: **In-memory cache with file-watcher invalidation, no new persistence layer**

**Confidence: HIGH**

**Options evaluated:**

| Strategy | Pros | Cons |
|----------|------|------|
| Re-read files each time | Always fresh | Slow (disk I/O on every hook) |
| In-memory cache + file watcher | Fast reads, auto-invalidation | Stale if watcher misses changes |
| SQLite persistence | Cross-session state | Overkill — plugin already has files as source of truth |
| Plugin-level `memory.json` | Fast structured access | Another storage layer to maintain |

**Recommended: In-memory ProjectState with file-watcher invalidation**

```javascript
// src/plugin/state/project-state.js

class ProjectState {
  #cache = new Map()    // path → parsed content
  #mtimes = new Map()   // path → last known mtime
  #directory = null

  constructor(directory) {
    this.#directory = directory
  }

  /** Get parsed state, re-reading only if file changed */
  getState() {
    return this.#getCachedOrParse(
      '.planning/STATE.md',
      parseStateMd  // extracted pure parser
    )
  }

  getRoadmap() {
    return this.#getCachedOrParse(
      '.planning/ROADMAP.md',
      parseRoadmapMd
    )
  }

  /** Invalidate on file change (called from file.watcher.updated hook) */
  invalidate(filePath) {
    this.#cache.delete(filePath)
    this.#mtimes.delete(filePath)
  }

  #getCachedOrParse(relativePath, parser) {
    const fullPath = join(this.#directory, relativePath)
    try {
      const stat = statSync(fullPath)
      const cachedMtime = this.#mtimes.get(relativePath)
      if (cachedMtime && stat.mtimeMs <= cachedMtime) {
        return this.#cache.get(relativePath)
      }
      const content = readFileSync(fullPath, 'utf-8')
      const parsed = parser(content)
      this.#cache.set(relativePath, parsed)
      this.#mtimes.set(relativePath, stat.mtimeMs)
      return parsed
    } catch {
      return null  // No .planning/ — project doesn't use bGSD
    }
  }
}
```

**Why no SQLite for the plugin:**
- The CLI already uses SQLite as an L2 cache for file reads — that's a separate concern (CLI process lifecycle)
- The plugin runs as a long-lived module inside OpenCode's process. In-memory Map is appropriate because:
  - Plugin process lifecycle = OpenCode session (minutes to hours)
  - Source of truth is always the filesystem (.planning/*.md files)
  - File-watcher events provide invalidation signals
  - No need for cross-process persistence (plugin is single process)

**Concurrency note:** OpenCode is single-threaded (Node.js). Multiple hooks may fire in sequence but not in parallel within the same event loop tick. The `ProjectState` class does not need locks or thread-safety mechanisms. However, hooks should avoid `await` chains that could cause re-entrancy issues — keep hook handlers fast and non-blocking where possible.

---

## Decision 5: Plugin ↔ CLI Interaction Model

### Recommendation: **Plugin as thin adapter calling CLI for mutations, with shared parsers for reads**

**Confidence: HIGH**

```
┌─────────────────────────────────────────────────────────┐
│                    Module Boundary                       │
│                                                         │
│  plugin.js (ESM bundle)          gsd-tools.cjs (CJS)   │
│  ┌───────────────────┐          ┌──────────────────┐   │
│  │ READS:             │          │ ALL MUTATIONS:    │   │
│  │ · Parse STATE.md   │          │ · State updates   │   │
│  │ · Parse ROADMAP.md │          │ · Commits          │   │
│  │ · Parse PLAN.md    │          │ · Phase ops        │   │
│  │ · Read config.json │          │ · Memory writes    │   │
│  │                    │          │ · Verification     │   │
│  │ PRESENTATION:      │          │ · Git operations   │   │
│  │ · Build context    │          │                    │   │
│  │ · Format toasts    │          │ ALL ANALYSIS:      │   │
│  │ · Build tool output│          │ · Velocity         │   │
│  │                    │          │ · Context budget   │   │
│  │ ORCHESTRATION:     │          │ · Codebase intel   │   │
│  │ · Hook routing     │          │ · Dependencies     │   │
│  │ · Event handling   │          │                    │   │
│  │ · Tool registration│          │                    │   │
│  └───────────────────┘          └──────────────────┘   │
│           │                            ↑                │
│           └── execFileSync ────────────┘                │
│           └── shared parsers (bundled into both) ──┘    │
└─────────────────────────────────────────────────────────┘
```

**The principle: Plugin reads, CLI writes.**

- **Plugin reads** (fast, in-process): Parse markdown files for context injection, tool responses, event decisions. These are pure functions operating on file content — no side effects.
- **CLI writes** (process spawn): Any operation that modifies `.planning/` files, makes git commits, or changes persistent state goes through `gsd-tools.cjs`. This preserves the CLI as the single source of truth for mutations, maintains backward compatibility, and avoids duplicating mutation logic.

**Why not "plugin with its own logic":**
- Duplicating state mutation logic between plugin and CLI creates divergence risk
- The CLI has 766 tests covering its mutation operations — rewriting in the plugin means untested duplicates
- CLI's synchronous I/O model (readFileSync/writeFileSync) works correctly for mutations; the plugin doesn't need async I/O for file writes

**Why not "pure CLI wrapper":**
- Spawning a process for every read operation is too slow for context injection (fires on every session interaction)
- The parsers are pure functions with no side effects — safe to run in-process
- In-memory caching in the plugin avoids redundant file reads

---

## Decision 6: Shared Parser Extraction

### Recommendation: **Extract pure parsers from CLI modules into `src/lib/parsers.js`**

**Confidence: HIGH**

**Current state:** Parsing logic for STATE.md, ROADMAP.md, PLAN.md is embedded in command modules (e.g., `src/commands/state.js` calls helpers from `src/lib/helpers.js`). These functions are entangled with output formatting, globals, and side effects.

**Target state:** Extract pure parsing functions (content in → structured data out) into a dedicated module:

```javascript
// src/lib/parsers.js — Pure functions, no side effects, no globals

/**
 * Parse STATE.md content into structured data.
 * @param {string} content - Raw STATE.md file content
 * @returns {object} Parsed state object
 */
function parseStateMd(content) {
  // Extract frontmatter, current phase/plan, blockers, decisions, metrics
  // (Logic extracted from existing helpers.js parseState functions)
  return { milestone, phase, plan, task, blockers, decisions, lastSession }
}

/**
 * Parse ROADMAP.md content into phase list with status.
 * @param {string} content - Raw ROADMAP.md file content
 * @returns {object} Parsed roadmap object
 */
function parseRoadmapMd(content) {
  // Extract phases with status, progress, dependencies
  return { phases, currentPhase, completedCount, totalCount }
}

/**
 * Parse PLAN.md content into task list.
 * @param {string} content - Raw PLAN.md file content
 * @returns {object} Parsed plan object
 */
function parsePlanMd(content) {
  // Extract tasks with status, file lists, verification steps
  return { tasks, completedCount, totalCount, currentTask }
}

module.exports = { parseStateMd, parseRoadmapMd, parsePlanMd }
```

**Both build targets consume this module:**
- `bin/gsd-tools.cjs` — CJS bundle includes parsers (esbuild resolves `require('./lib/parsers')`)
- `plugin.js` — ESM bundle includes parsers (esbuild resolves `import` via createRequire or direct import if parsers are ESM-compatible)

**Implementation note:** Since parsers.js must work in both CJS (for CLI) and ESM (for plugin), write it with `module.exports` (CJS) which esbuild can handle in both output formats. The ESM plugin build can use a shim or esbuild's built-in CJS-to-ESM interop.

---

## Decision 7: Concurrency and Race Conditions

### Recommendation: **Sequential hook execution (no parallelism concerns), mtime-based cache staleness**

**Confidence: HIGH**

**OpenCode's execution model (verified from SDK docs):**
- Hooks run sequentially (in load order) per event
- Plugin is loaded once, lives for the OpenCode process lifetime
- Events are dispatched from OpenCode's event loop (single-threaded Node.js)
- Multiple hooks on the same event fire in sequence, not parallel

**Potential race conditions and mitigations:**

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Hook reads STATE.md while CLI write is in progress | Partial read | mtime check — if file is being written, mtime changes; retry on parse error |
| `file.watcher.updated` fires before write completes | Cache invalidated prematurely | Debounce: delay re-parse by 100ms after invalidation |
| Two hooks modify `output.env` | Last write wins | Not a problem — our plugin only sets `GSD_HOME` |
| `tool.execute.before` blocks expensive operations | Could slow down all tool calls | Guard: only intercept tools we care about (check `input.tool` first) |
| `session.idle` fires while async event handler runs | Re-entrancy | Idempotent handlers — always safe to call twice |

**Debounce pattern for file watcher:**

```javascript
// In file.watcher.updated hook
let invalidateTimer = null

"file.watcher.updated": async ({ event }) => {
  const path = event.properties?.path
  if (!path?.includes('.planning/')) return

  clearTimeout(invalidateTimer)
  invalidateTimer = setTimeout(() => {
    projectState.invalidate(path)
  }, 100)  // 100ms debounce
}
```

---

## Component Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          OpenCode Runtime                               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   bgsd.js (plugin.js bundle)                    │    │
│  │                                                                 │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │    │
│  │  │ Hook Handlers │  │ Custom Tools │  │  Context Builder  │    │    │
│  │  │              │  │              │  │                   │    │    │
│  │  │ session.*    │  │ gsd_state    │  │ buildContext()    │    │    │
│  │  │ shell.env    │  │ gsd_progress │  │ buildCompaction() │    │    │
│  │  │ compaction   │  │ gsd_context  │  │                   │    │    │
│  │  │ tool.*       │  │ gsd_plan     │  └────────┬──────────┘    │    │
│  │  │ file.*       │  │              │           │               │    │
│  │  │ event        │  └──────┬───────┘           │               │    │
│  │  └──────┬───────┘         │                   │               │    │
│  │         │                 │                   │               │    │
│  │         └─────────┬───────┴───────────────────┘               │    │
│  │                   │                                           │    │
│  │         ┌─────────▼──────────┐                                │    │
│  │         │   ProjectState     │  ← In-memory cache             │    │
│  │         │   (singleton)      │  ← mtime-based invalidation    │    │
│  │         │                    │  ← file-watcher driven         │    │
│  │         └────────┬───────────┘                                │    │
│  │                  │                                            │    │
│  │    ┌─────────────┼───────────────┐                            │    │
│  │    │ Pure Parsers (shared code)  │                            │    │
│  │    │ parseStateMd()              │                            │    │
│  │    │ parseRoadmapMd()            │                            │    │
│  │    │ parsePlanMd()               │                            │    │
│  │    └─────────────────────────────┘                            │    │
│  │                                                               │    │
│  │    ┌─────────────────────────────┐                            │    │
│  │    │ CLI Bridge (execFileSync)   │  ← Mutations only          │    │
│  │    │ gsdExec('verify:state', ..) │                            │    │
│  │    └─────────────┬───────────────┘                            │    │
│  │                  │                                            │    │
│  └──────────────────┼────────────────────────────────────────────┘    │
│                     │                                                 │
│  ┌──────────────────▼────────────────────────────────────────────┐    │
│  │              gsd-tools.cjs (CJS, existing CLI)                │    │
│  │              State mutations, git ops, analysis               │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │              Filesystem (.planning/)                          │    │
│  │              STATE.md, ROADMAP.md, PLAN.md, config.json       │    │
│  └───────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points (New and Modified Components)

### New Components

| Component | Location | Purpose | Depends On |
|-----------|----------|---------|------------|
| `src/plugin/index.js` | New | Plugin entry point, hook wiring, tool registration | All plugin modules |
| `src/plugin/hooks/session.js` | New | session.created, session.idle, session.compacted handlers | ProjectState, ContextBuilder |
| `src/plugin/hooks/shell.js` | New | shell.env handler (GSD_HOME injection) | — |
| `src/plugin/hooks/compaction.js` | New | Enhanced compaction with decisions, blockers, task context | ProjectState, ContextBuilder |
| `src/plugin/hooks/tools.js` | New | tool.execute.before/after for advisory guardrails | ProjectState |
| `src/plugin/hooks/files.js` | New | file.watcher.updated for cache invalidation | ProjectState |
| `src/plugin/tools/*.js` | New | Custom LLM-callable tools (gsd_state, gsd_progress, etc.) | ProjectState, CLI bridge |
| `src/plugin/state/project-state.js` | New | In-memory state cache with mtime invalidation | Parsers |
| `src/plugin/context/builder.js` | New | Build context strings for injection/compaction | ProjectState |
| `src/lib/parsers.js` | New | Pure parsing functions extracted from helpers.js | — |

### Modified Components

| Component | Change | Why |
|-----------|--------|-----|
| `build.cjs` | Add second esbuild target for ESM plugin bundle | Plugin needs to be built from src/plugin/ |
| `plugin.js` | Becomes build output (was handwritten source) | Now generated from src/plugin/ |
| `deploy.sh` | No change needed | Already copies plugin.js → plugins/bgsd.js |
| `install.js` | No change needed | Already copies plugin.js → plugins/bgsd.js |
| `src/lib/helpers.js` | Extract pure parser functions to parsers.js, call parsers from helpers | Share logic between CLI and plugin |
| `package.json` | Add `@opencode-ai/plugin` as devDependency (for types/tool helper) | Plugin uses tool() helper from SDK |

### Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| `bin/gsd-tools.cjs` | CLI continues to work as today — no changes to command interface |
| `src/commands/*.js` | Command handlers unchanged — parsers.js extraction is internal refactor |
| `src/router.js` | CLI routing unchanged |
| `workflows/*.md` | Workflow definitions unchanged |
| `agents/*.md` | Agent definitions unchanged (they call custom tools like any other tool) |
| `commands/*.md` | Slash command wrappers unchanged |

---

## Build Order (Dependency-Aware)

### Wave 1: Foundation (No Dependencies)

1. **Extract pure parsers** — `src/lib/parsers.js`
   - Extract `parseStateMd()`, `parseRoadmapMd()`, `parsePlanMd()` from helpers.js
   - Pure functions, no side effects
   - Wire helpers.js to call parsers.js (internal refactor, tests still pass)
   - **Verify:** `npm test` — all 766 tests pass

2. **Add esbuild plugin target** — `build.cjs`
   - Add second `esbuild.build()` call for `src/plugin/index.js` → `plugin.js`
   - ESM format, externalize `@opencode-ai/plugin` and `node:*`
   - **Verify:** `npm run build` produces both `bin/gsd-tools.cjs` and `plugin.js`

### Wave 2: Core Plugin (Depends on Wave 1)

3. **ProjectState cache** — `src/plugin/state/project-state.js`
   - In-memory cache with mtime invalidation
   - Uses extracted parsers
   - **Verify:** Unit test — parse, cache, invalidate cycle

4. **Context builder** — `src/plugin/context/builder.js`
   - Build context string from ProjectState
   - Build compaction context (enhanced version of current)
   - **Verify:** Unit test — context output matches expected format

5. **Plugin entry + basic hooks** — `src/plugin/index.js`, `hooks/session.js`, `hooks/shell.js`, `hooks/compaction.js`
   - Wire session.created (context injection), shell.env (GSD_HOME), compaction (enhanced)
   - **Verify:** `npm run build` → deploy → restart OpenCode → verify greeting + context

### Wave 3: Custom Tools (Depends on Wave 2)

6. **CLI bridge utility** — `src/plugin/utils.js`
   - `gsdExec()` helper for calling gsd-tools.cjs
   - **Verify:** Unit test — exec and JSON parse

7. **Custom tools** — `src/plugin/tools/*.js`
   - `gsd_state` — returns current state (phase, plan, task, blockers)
   - `gsd_progress` — returns milestone progress metrics
   - `gsd_context` — returns detailed context for current task
   - `gsd_plan` — returns active plan with task list
   - **Verify:** Deploy → invoke tool via LLM → correct output

### Wave 4: Event Handlers & Guardrails (Depends on Wave 2-3)

8. **File watcher hook** — `src/plugin/hooks/files.js`
   - Invalidate ProjectState on .planning/ file changes
   - **Verify:** Edit STATE.md → state cache refreshes

9. **Tool interception** — `src/plugin/hooks/tools.js`
   - `tool.execute.before`: advisory guardrails (convention suggestions)
   - `tool.execute.after`: auto-detect test needs after file edits
   - **Verify:** Deploy → edit a file → see advisory suggestion

10. **Event handler (notifications)** — via `event` key
    - session.idle → toast notification for phase completion
    - **Verify:** Complete a plan → see toast

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Plugin Duplicating CLI Mutation Logic
**What:** Implementing state updates, git operations, or file writes directly in the plugin
**Why bad:** Creates two sources of truth; CLI's 766 tests don't cover plugin's copy
**Instead:** Plugin calls `gsdExec()` for all mutations

### Anti-Pattern 2: Eager-Loading All Context
**What:** Plugin reads every .planning/ file on session.created and injects everything
**Why bad:** Context bloat; most sessions don't need full plan history
**Instead:** Inject minimal context (< 500 tokens) at session start; detailed context available via custom tools on-demand

### Anti-Pattern 3: Blocking Hooks
**What:** Hook handlers that do expensive I/O (git log, full directory scan) synchronously
**Why bad:** Blocks OpenCode's event loop, freezes TUI
**Instead:** Keep hook handlers fast (< 50ms); defer expensive work to custom tools

### Anti-Pattern 4: Monolithic Plugin File
**What:** Adding all hooks, tools, and state management to a single plugin.js
**Why bad:** Unmaintainable at 500+ lines; hard to test individual components
**Instead:** Split into src/plugin/ modules, bundle to single file

### Anti-Pattern 5: Creating a Plugin-Level Database
**What:** Adding SQLite, LevelDB, or custom persistence to the plugin
**Why bad:** .planning/ markdown files are the source of truth; another store creates sync issues
**Instead:** In-memory cache with file-watcher invalidation; filesystem is the database

---

## Sources

| Source | What It Provided | Confidence |
|--------|-----------------|------------|
| OpenCode official docs (opencode.ai/docs/plugins) | Plugin API, hooks, tool registration, examples | HIGH |
| OpenCode official docs (opencode.ai/docs/custom-tools) | Custom tool definition, args schema, context object | HIGH |
| OpenCode official docs (opencode.ai/docs/sdk) | SDK client API — sessions, TUI, files, events | HIGH |
| Context7 /websites/opencode_ai_plugins | Plugin hook inventory (27 event types), tool helper | HIGH |
| Context7 /anomalyco/opencode | Plugin structure, Bun shell API, project context | HIGH |
| Current plugin.js source (45 lines) | Existing patterns, constraints, deployment model | HIGH |
| build.cjs source (402 lines) | esbuild pipeline, manifest system, bundle targets | HIGH |
| deploy.sh + install.js source | Deployment model — file copy, no npm install for plugin | HIGH |
| src/router.js (930 lines) | CLI command surface, namespace routing, module boundaries | HIGH |
| src/lib/helpers.js | Existing parser patterns, cache engine, file I/O patterns | HIGH |

---
*Last updated: 2026-03-08*
