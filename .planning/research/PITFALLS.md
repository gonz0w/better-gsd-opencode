# Domain Pitfalls: v9.0 Embedded Plugin Experience

**Domain:** Deeply embedded OpenCode plugin hooks for existing planning CLI
**Researched:** 2026-03-08
**Confidence:** HIGH (verified against OpenCode plugin docs, GitHub issues, existing codebase)

## Critical Pitfalls

Mistakes that cause crashes, data corruption, or force architectural rewrites.

### Pitfall 1: Unhandled Exceptions in Hooks Crash the Host Process

**What goes wrong:** A plugin hook that throws an unhandled error can crash OpenCode or prevent session creation. Plugin code runs in OpenCode's process — there is no sandbox or error boundary isolating plugin failures.

**Why it happens:** Developers assume hooks have try/catch wrappers. The current plugin.js already demonstrates defensive coding (the compaction hook wraps in try/catch, the shell.env hook guards `if (!output || !output.env)`), but expanding to 20+ hooks multiplies the surface area. One missing guard in a `tool.execute.before` hook crashes ALL tool execution.

**Evidence:**
- GitHub issue #12763: "OpenCode v1.1.53 randomly crashes during usage" — attributed to plugin initialization race condition
- The `.env` protection example in official docs intentionally throws: `throw new Error("Do not read .env files")` — this is by design for `tool.execute.before` (throwing blocks the tool call), but the same pattern in other hooks is destructive
- The current plugin.js line 35-36 guards `if (output && output.context)` — this guard saved us from TypeError crashes

**Consequences:** All shell execution stops. The user sees OpenCode crash or hang. No error recovery — must restart the session.

**Prevention:**
- **EVERY hook must be wrapped in try/catch.** No exceptions. Even "simple" hooks.
- Create a `safeHook(name, fn)` wrapper that catches, logs to `console.error`, and returns gracefully
- For `tool.execute.before`: throwing is intentional (blocks the tool). Distinguish between intentional throws (advisory guardrails) and bugs
- Test hooks in isolation before deploying

**Code pattern — DO:**
```javascript
function safeHook(hookName, fn) {
  return async (input, output) => {
    try {
      return await fn(input, output)
    } catch (err) {
      console.error(`[bGSD] ${hookName} error:`, err.message)
      // Never re-throw except in tool.execute.before (intentional blocks)
    }
  }
}
```

**Code pattern — DON'T:**
```javascript
// Raw handler with no protection
"session.idle": async (input, output) => {
  const state = readFileSync(statePath, "utf-8")  // Throws if file missing
  output.context.push(state)  // Throws if output.context is undefined
}
```

**Detection:** OpenCode crashes on session start or during tool execution. Log entries stop abruptly.

**Phase relevance:** Every phase. The `safeHook` wrapper must be the FIRST thing built.

**Severity:** CRITICAL — one bug takes down all of OpenCode

---

### Pitfall 2: State File Corruption from Concurrent Read-Modify-Write

**What goes wrong:** Both the CLI (`gsd-tools.cjs` via `execSync` in a bash tool call) and plugin hooks (via async event handlers) can write to STATE.md simultaneously. The CLI reads STATE.md, modifies it, and writes it back. If a plugin hook reads STATE.md between the CLI's read and write, the plugin's write overwrites the CLI's changes (or vice versa).

**Why it happens:** The CLI uses synchronous file I/O (`readFileSync` → modify → `writeFileSync`), which is atomic within a single process. But plugin hooks are async and run in the OpenCode process, while CLI tool calls spawn separate Node.js processes. There is no file locking.

**Evidence:**
- `src/commands/state.js` line 193: `fs.writeFileSync(statePath, content, 'utf-8')` — no lock, no atomic rename
- `plugin.js` line 34: `readFileSync(statePath, "utf-8")` — reading from the same file
- v9.0 plan includes "event-driven state sync (session idle, file changes)" — creating MORE async writes to STATE.md

**Consequences:** Lost updates, stale state, STATE.md corrupted mid-write. The "source of truth" becomes unreliable.

**Prevention:**
- **Plugin hooks should READ STATE.md but NEVER WRITE it directly.** All state mutations must go through the CLI: `execFile('node', ['gsd-tools.cjs', 'state', 'patch', ...])`.
- If plugin hooks MUST write (e.g., session idle auto-sync), use a debounce pattern: wait 500ms after last change, then read-modify-write with a temp file + atomic rename
- Implement a simple lock: write a `.planning/.state-lock` file before modifying, delete after. Check for lock before writing.
- The CLI's `invalidateFileCache(statePath)` already exists — ensure any plugin write also invalidates this cache

**Code pattern — PREFER:**
```javascript
// Plugin reads state, delegates writes to CLI
import { execFileSync } from "child_process"
const state = readFileSync(statePath, "utf-8")  // Safe to read
// To write: call the CLI
execFileSync("node", [gsdToolsPath, "state", "patch", "current_task", newValue])
```

**Code pattern — IF WRITE IS UNAVOIDABLE:**
```javascript
// Atomic write with temp file
import { writeFileSync, renameSync } from "fs"
const tmpPath = statePath + '.tmp'
writeFileSync(tmpPath, newContent, 'utf-8')
renameSync(tmpPath, statePath)  // Atomic on POSIX
```

**Detection:** STATE.md content doesn't match expected state. `state validate` reports drift.

**Phase relevance:** Event-driven state sync phase. Must be solved before implementing session.idle auto-update.

**Severity:** CRITICAL — data corruption is the worst kind of bug in a planning system

---

### Pitfall 3: Custom Tool Names Override Built-In Tools

**What goes wrong:** If you register a custom tool with the same name as a built-in tool (e.g., `read`, `bash`, `write`, `glob`, `grep`), the custom tool REPLACES the built-in. This is documented behavior, not a bug — but it's a trap.

**Why it happens:** OpenCode's custom tools documentation explicitly states: "A custom tool can take precedence over a built-in opencode tool if they share the same name." The naming collision is silent — no warning is emitted.

**Evidence:**
- OpenCode custom-tools docs: example shows overriding the `bash` tool with a restricted version
- No namespace prefixing enforced for custom tools

**Consequences:** A tool named `read` or `edit` would completely break OpenCode's core functionality. Agents could not read or edit files. Depending on which tools are overridden, the entire session could become unusable.

**Prevention:**
- **ALL custom tools MUST use a `gsd_` prefix.** Examples: `gsd_init`, `gsd_state`, `gsd_plan_status`
- Document the naming convention in AGENTS.md and enforce it in code review
- Create a DENIED_NAMES list in plugin code: `['read', 'write', 'edit', 'bash', 'glob', 'grep', 'webfetch', 'task']` and validate at registration time
- Test that built-in tools still work after plugin loads

**Code pattern — DO:**
```javascript
tool: {
  gsd_project_state: tool({ ... }),
  gsd_plan_status: tool({ ... }),
}
```

**Code pattern — DON'T:**
```javascript
tool: {
  state: tool({ ... }),     // Could shadow MCP server tools
  init: tool({ ... }),      // Ambiguous, could conflict
  read_state: tool({ ... }) // "read" prefix is dangerous
}
```

**Detection:** Built-in tools stop working. Agent says "tool not found" or tool returns unexpected results.

**Phase relevance:** Custom tool registration phase (early). Naming convention must be established before any tools are created.

**Severity:** CRITICAL — silently breaks core functionality

---

### Pitfall 4: System Prompt Token Budget Explosion

**What goes wrong:** Always-on context injection via system prompt hook adds tokens to EVERY LLM call. If the injected context is too large, it eats the context window budget, leaving less room for conversation history, tool results, and agent reasoning. With multiple hooks injecting content, the cumulative impact compounds.

**Why it happens:** Each hook author adds "just a little context" — current phase (200 tokens), plan status (300 tokens), blockers (150 tokens), codebase stats (400 tokens), decisions (500 tokens). Individually reasonable, collectively 1500+ tokens on every single API call.

**Evidence:**
- GitHub issue #9858: "[FEATURE]: Token Consumption Analysis and Requirement for a Plugin Disable Feature for Agents" — community already flagged token waste from plugins
- The existing init commands already produce "compact" versions (v1.1 achieved 46.7% reduction). Adding always-on injection reverses those gains
- Agent manifests currently budget 60-80K tokens. Adding 1500 tokens to system prompt means 1500 fewer tokens for actual work

**Consequences:** Increased API costs, degraded agent performance (less room to think), slower response times, hitting context limits earlier, triggering more frequent compaction.

**Prevention:**
- **Set a HARD TOKEN BUDGET for system prompt injection: 500 tokens MAX.** Measure with tokenx.
- Build a context priority system: critical (always inject) vs available (inject on request via tools)
  - Critical (always inject): current phase, current task, blockers — ~200 tokens
  - Available via tool: full plan status, decisions history, codebase stats
- Use the same compact serialization patterns from v1.1. No prose — structured data only.
- Create a `measureInjection()` function that warns when budget is exceeded
- Profile actual token usage before and after plugin enhancement

**Code pattern — DO:**
```javascript
// Minimal always-on context
const context = [
  `Phase: ${phase.number} - ${phase.name}`,
  `Task: ${currentTask}`,
  blockers.length ? `Blockers: ${blockers.join(', ')}` : null,
].filter(Boolean).join('\n')
// ~50 tokens
```

**Code pattern — DON'T:**
```javascript
// Dumping entire STATE.md (500-2000 tokens every call)
output.system.push(readFileSync('.planning/STATE.md', 'utf-8'))
```

**Detection:** Monitor total system prompt size. Track API costs per session. Watch for compaction frequency increase.

**Phase relevance:** System prompt hook phase (Phase 1 or early). Budget must be set before building.

**Severity:** CRITICAL — silent cost multiplier that compounds with every conversation turn

---

### Pitfall 5: Synchronous I/O in Async Plugin Hooks Blocks the Event Loop

**What goes wrong:** The existing CLI uses `readFileSync`, `writeFileSync`, `execSync` — all synchronous. Plugin hooks are async (they return Promises). Calling synchronous I/O inside async hooks blocks OpenCode's event loop, freezing the UI during file reads, git operations, or CLI invocations.

**Why it happens:** The natural instinct when expanding plugin.js is to `require('gsd-tools.cjs')` or `readFileSync()` because that's what the CLI does. But the CLI is a short-lived process (completes in <5s), while the plugin lives for the entire session (hours).

**Evidence:**
- Current plugin.js line 34: `readFileSync(statePath, "utf-8")` — already synchronous in an async hook
- PROJECT.md explicitly states "Async I/O rewrite — Synchronous I/O is appropriate for CLI tool" as out-of-scope — but this doesn't apply to plugin hooks
- The CLI takes up to 5 seconds for some commands. Blocking for 5 seconds inside a plugin hook freezes the entire TUI.

**Consequences:** OpenCode UI freezes during hook execution. "Session idle" handler could trigger heavy sync I/O, making the editor unresponsive. User thinks OpenCode crashed.

**Prevention:**
- **Plugin hooks must use async I/O exclusively:** `readFile` (not `readFileSync`), `execFile` (not `execSync`)
- For calling gsd-tools.cjs from hooks, use `execFile` (callback-based, non-blocking) or `child_process.spawn` with Promise wrapper
- Set timeouts on all async operations (5 second max for hook execution)
- For the compaction hook (which already uses `readFileSync`), migrate to async as part of this milestone

**Code pattern — DO:**
```javascript
import { readFile } from "fs/promises"
import { execFile } from "child_process"
import { promisify } from "util"
const execFileAsync = promisify(execFile)

"session.idle": safeHook("session.idle", async (input, output) => {
  const state = await readFile(statePath, "utf-8")
  // Non-blocking
})
```

**Code pattern — DON'T:**
```javascript
"session.idle": async (input, output) => {
  const result = execSync(`node gsd-tools.cjs init progress`, { encoding: "utf-8" })
  // Blocks for 2-5 seconds, freezing OpenCode
}
```

**Detection:** OpenCode UI becomes unresponsive during plugin operations. Long pauses after tool execution completes.

**Phase relevance:** All phases. Establish async-only pattern from day one.

**Severity:** CRITICAL — visible UX degradation that makes the tool feel broken

---

## Moderate Pitfalls

Mistakes that cause incorrect behavior, wasted effort, or degraded experience.

### Pitfall 6: tool.execute.before Throws Break Subagent Tool Calls Too

**What goes wrong:** Advisory guardrails implemented via `tool.execute.before` hooks that throw errors block tool calls from ALL agents, including subagents spawned via the `task` tool. A guardrail meant for the main agent ("you should run tests after editing") blocks subagent operations.

**Why it happens:** GitHub issue #5894 documents that `tool.execute.before` hooks DO fire for subagent tool calls (this was fixed — they didn't initially, now they do). But guardrail logic doesn't distinguish between main agent and subagent contexts.

**Evidence:**
- GitHub issue #5894: "Plugin hooks (tool.execute.before) don't intercept subagent tool calls - security policy bypass" — now fixed, meaning hooks fire for ALL tool calls
- No `input.agentType` or `input.isSubagent` field available in hook payload (only `tool`, `sessionID`, `callID`)

**Consequences:** Subagent (e.g., gsd-executor running a plan) gets blocked by advisory guardrails meant for interactive use. Plans fail mid-execution. Silent failure mode — the guardrail blocks the call but there's no way to know it was a subagent.

**Prevention:**
- **Advisory guardrails should WARN, not THROW.** Use `tool.execute.after` to inject suggestions rather than `tool.execute.before` to block
- If blocking is necessary, implement an allowlist of tool+context combinations rather than broad blocks
- Use `input.sessionID` to track whether the current session was spawned as a subagent (requires maintaining session hierarchy)
- Start with advisory-only guardrails. Graduate to blocking only after extensive testing

**Detection:** Subagent tasks fail with "Error: [guardrail message]" in tool execution logs.

**Phase relevance:** Advisory guardrails phase. Design the guardrail system as advisory-first.

**Severity:** MODERATE — breaks automated workflows silently

---

### Pitfall 7: Compaction Hook Replaces vs Appends Context Incorrectly

**What goes wrong:** The `experimental.session.compacting` hook has two modes: `output.context.push()` (append to default context) and `output.prompt = "..."` (replace entire compaction prompt). Using the wrong one destroys either the default context or the plugin's custom context.

**Why it happens:** The API surface is confusing. Push appends to what OpenCode already collects. Setting `output.prompt` replaces EVERYTHING. Most developers want to add project context while keeping the default — but if they set `output.prompt`, the default is gone.

**Evidence:**
- OpenCode docs show both patterns without clearly explaining the consequences of choosing one over the other
- The current plugin.js uses `output.context.push()` correctly — but v9.0's "Enhanced compaction" feature could easily switch to `output.prompt` to "customize" the compaction, destroying the default behavior

**Consequences:** With `output.prompt`: compaction loses conversation summary, tool call history, and other context that OpenCode would normally preserve. With overly aggressive `output.context.push()`: compaction prompt becomes too large, producing poor summaries.

**Prevention:**
- **ALWAYS use `output.context.push()`, NEVER `output.prompt =`.** The default compaction prompt is battle-tested. We want to ADD context, not replace the prompt.
- Keep compaction context to ~500 tokens. It's a summary, not a dump.
- Include: current phase, current task, blockers, key decisions made in this session
- Exclude: full STATE.md dump (too large), full plan text, conversation replay

**Code pattern — DO:**
```javascript
"experimental.session.compacting": safeHook("compacting", async (input, output) => {
  const summary = buildCompactSummary()  // ~500 tokens
  if (output?.context) {
    output.context.push(`## bGSD Context\n${summary}`)
  }
})
```

**Code pattern — DON'T:**
```javascript
"experimental.session.compacting": async (input, output) => {
  output.prompt = `Summarize with this custom prompt...`  // Replaces EVERYTHING
}
```

**Detection:** After compaction, agent loses conversation context. Agent doesn't know what it was working on. Agent forgets tool call results.

**Phase relevance:** Enhanced compaction phase. Document the distinction clearly.

**Severity:** MODERATE — degraded but not crashed experience

---

### Pitfall 8: session.idle Fires Frequently, Triggering Expensive Operations

**What goes wrong:** The `session.idle` event fires every time the LLM finishes processing and is waiting for user input. If the hook handler runs expensive operations (file reads, git operations, CLI invocations), each idle event causes noticeable lag.

**Why it happens:** Developers treat `session.idle` like "session complete" (fires once), but it fires after EVERY assistant response. A 20-turn conversation triggers 20 idle events. If each one reads STATE.md, runs `gsd-tools.cjs state validate`, and checks git status — that's 60+ file operations per conversation.

**Evidence:**
- GitHub issue #15267: "opencode run teardown race after session.idle" — demonstrates that session.idle fires during teardown, causing race conditions
- The notification plugin example in docs hooks into session.idle with `osascript` — fine for notifications, problematic for heavy I/O

**Consequences:** OpenCode becomes sluggish. Each response is followed by a visible pause while hooks execute. Battery drain from constant file system activity.

**Prevention:**
- **Debounce session.idle handlers.** Only execute if idle for >2 seconds (the user has actually stopped).
- Cache results between idle events. Don't re-read STATE.md if it hasn't changed (check mtime).
- Use `file.watcher.updated` for reactive state sync instead of polling on idle
- Track last-run timestamp per handler and skip if called within a cooldown period

**Code pattern — DO:**
```javascript
let lastIdleRun = 0
const IDLE_COOLDOWN_MS = 5000

event: safeHook("event", async ({ event }) => {
  if (event.type !== "session.idle") return
  if (Date.now() - lastIdleRun < IDLE_COOLDOWN_MS) return
  lastIdleRun = Date.now()
  // Now do lightweight work
})
```

**Code pattern — DON'T:**
```javascript
event: async ({ event }) => {
  if (event.type === "session.idle") {
    // Runs after EVERY response
    const result = execSync("node gsd-tools.cjs init progress")  // 2-5 second block
    await updateDesktopNotification(result)
  }
}
```

**Detection:** Noticeable pause after each LLM response. OpenCode logs show repeated hook execution.

**Phase relevance:** Event-driven state sync phase. Debounce must be implemented before any idle handlers.

**Severity:** MODERATE — degrades UX but doesn't crash

---

### Pitfall 9: ESM Plugin Importing CJS gsd-tools.cjs Creates Module Boundary Issues

**What goes wrong:** `plugin.js` is ESM (`"type": "module"` in package.json, uses `import` statements). `gsd-tools.cjs` is CJS (built by esbuild with `format: 'cjs'`). Importing CJS from ESM works in Node.js but has gotchas: named exports may not be available, `require` is not defined in ESM, and dynamic `import()` of CJS returns a default-export wrapper.

**Why it happens:** The CLI must stay CJS (for `__dirname`, `require`, and single-file deploy simplicity — PROJECT.md explicitly rules out ESM output). The plugin must be ESM (OpenCode expects ESM plugins). The two worlds must interoperate.

**Evidence:**
- `package.json` line 6: `"type": "module"` — all `.js` files are ESM
- `build.cjs` line 33: `format: 'cjs'` — output is CJS
- The current plugin.js does NOT import from gsd-tools.cjs — it uses `readFileSync` directly. But v9.0 custom tools will need to call CLI functions.
- GitHub issue #10574: "Plugin loader fails to resolve npm dependencies from .opencode/plugin/ subdirectory" — module resolution is fragile

**Consequences:** `import { someFunction } from './gsd-tools.cjs'` fails or returns `{ default: { ... } }` instead of named exports. Tool handlers crash at runtime with "is not a function" errors.

**Prevention:**
- **Don't import gsd-tools.cjs as a module.** Call it as a subprocess: `execFile('node', ['bin/gsd-tools.cjs', 'command', ...])` and parse JSON stdout.
- If direct import is needed, use `createRequire`:
  ```javascript
  import { createRequire } from "module"
  const require = createRequire(import.meta.url)
  const gsdTools = require("./bin/gsd-tools.cjs")
  ```
- Alternatively, build a thin ESM wrapper that re-exports needed functions
- Test the import boundary explicitly in the test suite

**Code pattern — PREFER:**
```javascript
// Subprocess call — cleanest boundary
import { execFile } from "child_process"
import { promisify } from "util"
const exec = promisify(execFile)

async function gsdCommand(cmd, args) {
  const { stdout } = await exec("node", [gsdToolsPath, cmd, ...args, "--raw"])
  return JSON.parse(stdout)
}
```

**Detection:** `TypeError: X is not a function` at plugin load time. Module resolution errors in OpenCode logs.

**Phase relevance:** Custom tools phase. The interop pattern must be decided before building any tools.

**Severity:** MODERATE — prevents tool registration, caught early in development

---

### Pitfall 10: experimental.* Hooks Change Without Notice

**What goes wrong:** Hooks prefixed with `experimental.` (like `experimental.session.compacting`) can change their API signature, rename, or be removed in any OpenCode release. The current plugin already depends on one experimental hook.

**Why it happens:** "Experimental" means exactly what it says — the OpenCode team is iterating on the API. The current bGSD plugin is already coupled to this instability.

**Evidence:**
- Current plugin.js line 30: `"experimental.session.compacting"` — already using an experimental hook
- OpenCode changelog shows frequent additions and modifications to hook APIs
- Hook payload fields are being added (issue #15933 requesting `messageID` in tool hooks)

**Consequences:** An OpenCode update breaks the plugin. Users update OpenCode and bGSD stops working. The error is silent — the hook name no longer matches, so it simply never fires. State preservation across compaction stops, and nobody notices until context is lost.

**Prevention:**
- **Version-pin OpenCode in documentation.** Tell users which OpenCode version is tested.
- **Wrap experimental hooks with detection:** check if the hook fired, log when it doesn't
- **Implement fallback behavior:** if compaction hook doesn't fire, inject state context via system prompt hook instead
- **Track OpenCode releases** in a COMPATIBILITY.md or the plugin's README
- **Feature-detect, don't version-check:** Test if `output.context` exists before using it, test if `output.prompt` is settable before setting it

**Code pattern — DO:**
```javascript
// Feature detection with fallback
"experimental.session.compacting": safeHook("compacting", async (input, output) => {
  if (!output || typeof output.context?.push !== 'function') {
    console.warn("[bGSD] Compaction hook API changed — context.push not available")
    return  // Graceful degradation
  }
  output.context.push(compactionContext)
})
```

**Detection:** After OpenCode update, check if compaction still preserves bGSD state. Add a `[bGSD] compaction hook fired` log message.

**Phase relevance:** All phases that use experimental hooks. Track in COMPATIBILITY section.

**Severity:** MODERATE — breakage on update, but recoverable

---

## Minor Pitfalls

Mistakes that waste time or cause confusion but don't break functionality.

### Pitfall 11: Anthropic Auth Plugin Rewrites Plugin-Injected System Prompt Text

**What goes wrong:** The Anthropic auth plugin performs a global text replacement: `"OpenCode"` → `"Claude Code"` and `"opencode"` → `"Claude"` on ALL system prompt text, including content injected by other plugins. If the bGSD plugin injects system prompt context containing the editor name, paths, or references, they get mangled.

**Why it happens:** The auth plugin intercepts the API request body and rewrites `parsed.system` array entries. It runs AFTER plugin hooks inject their content.

**Evidence:**
- `lessons.md`: "Severity: Critical — caused days of debugging, directory confusion, broken path references"
- `AGENTS.md` line 105: "The Anthropic auth plugin rewrites ALL system prompt text"
- Already cost days of debugging when project directory contained "opencode"

**Consequences:** System prompt context injected by the plugin gets mangled. `~/.config/opencode/` becomes `~/.config/Claude/`. File paths, tool names, and references become incorrect. The LLM operates on mangled context.

**Prevention:**
- **NEVER inject text containing the literal editor name into system prompt.** Use `OC`, `host editor`, or `$PWD`.
- Store paths with `$HOME` variables, not resolved absolute paths
- Test: After injection, verify the text does NOT contain the trigger strings
- Add a lint check to the plugin: `if (text.includes('opencode')) warn(...)`

**Detection:** LLM references non-existent paths. Tool calls use mangled file paths.

**Phase relevance:** System prompt injection phase. Apply from the first line of injected text.

**Severity:** MINOR (already well-understood and documented, but must not be forgotten)

---

### Pitfall 12: Hook Load Order Causes Unexpected Interaction Between Plugins

**What goes wrong:** Multiple plugins implementing the same hook run in load order. If the bGSD plugin's `tool.execute.before` runs after another plugin's hook that already modified `output.args`, the bGSD plugin sees modified args, not original ones.

**Why it happens:** OpenCode loads plugins in order: global config → project config → global plugins dir → project plugins dir. All hooks for the same event run sequentially. There's no isolation between plugins' mutations to the shared `output` object.

**Evidence:**
- OpenCode docs: "Plugins are loaded from all sources and all hooks run in sequence"
- The Anthropic auth plugin runs as an npm plugin (loaded from config), likely before local plugins (loaded from plugins dir)
- Multiple community plugins exist (opencode-antigravity-auth, opencode-sync-plugin, @mohak34/opencode-notifier)

**Consequences:** Unexpected behavior when multiple plugins modify the same hook output. A previous plugin's modification is treated as original input by the bGSD plugin.

**Prevention:**
- **Don't assume `input` or `output` are pristine.** Always check the current state of output before modifying.
- Avoid mutating `output.args` in `tool.execute.before` unless absolutely necessary
- Document which hooks the bGSD plugin registers, so users can understand interaction with other plugins
- Test with common community plugins (anthropic-auth, at minimum) to verify compatibility

**Detection:** Unexpected tool arguments. Tools receiving modified paths or commands they didn't expect.

**Phase relevance:** All phases with hooks. Test with auth plugin installed.

**Severity:** MINOR — edge case, but confusing to debug

---

### Pitfall 13: File Watcher Events Create Feedback Loops

**What goes wrong:** A `file.watcher.updated` hook reacts to file changes by writing to a file (e.g., updating STATE.md on config change). The write triggers another `file.watcher.updated` event, creating an infinite loop.

**Why it happens:** File watchers don't distinguish between "user edit" and "plugin write." Any file modification triggers the event.

**Consequences:** Infinite loop of file reads and writes. CPU spike. File constantly being rewritten. Potential file corruption from rapid read-write cycles.

**Prevention:**
- **Maintain a `writtenByPlugin` Set of file paths.** After writing, add the path. On watcher event, check if the path is in the set and skip if so. Remove after one skip cycle.
- Alternatively, use a `lastWriteTimestamp` map and ignore watcher events within 100ms of a plugin write
- Only watch specific files (STATE.md, PLAN.md), not entire directories
- Never write to a watched file from within a watcher handler without loop protection

**Code pattern — DO:**
```javascript
const recentWrites = new Set()

function writeWithBypass(filePath, content) {
  recentWrites.add(filePath)
  writeFileSync(filePath, content)
  setTimeout(() => recentWrites.delete(filePath), 200)
}

event: safeHook("event", async ({ event }) => {
  if (event.type !== "file.watcher.updated") return
  if (recentWrites.has(event.path)) return  // Skip our own writes
  // React to external changes
})
```

**Detection:** CPU spike after file edit. File modification timestamp updating continuously.

**Phase relevance:** Event-driven state sync phase, if using file watchers.

**Severity:** MINOR — caught immediately in testing, but annoying to debug

---

### Pitfall 14: Custom Tool execute() Returns Wrong Type

**What goes wrong:** Custom tool `execute()` functions must return a string. Returning an object, undefined, or throwing without a message causes unhelpful error displays to the LLM. The LLM receives "[object Object]" or empty results and gets confused.

**Why it happens:** The tool registration API uses Zod for input validation but doesn't enforce output type. Developers return JSON objects (natural for CLI tools that produce JSON) instead of serialized strings.

**Evidence:**
- OpenCode tool docs: execute function returns a string
- gsd-tools.cjs outputs JSON to stdout, which is a string — but developers might parse it and return the parsed object

**Consequences:** LLM receives garbled tool output. Agent makes incorrect decisions based on "[object Object]". Silent failure — no error thrown, just bad data.

**Prevention:**
- **ALWAYS return `JSON.stringify(result)` from custom tool execute functions.** Never return raw objects.
- Add a wrapper that serializes return values automatically
- Test tool output by calling the tool and verifying the return type

**Code pattern — DO:**
```javascript
async execute(args, context) {
  const result = await gsdCommand("state", ["read", args.field])
  return JSON.stringify(result)  // Always string
}
```

**Detection:** LLM says "the tool returned [object Object]" or makes decisions based on empty results.

**Phase relevance:** Custom tools phase. Add to tool wrapper from day one.

**Severity:** MINOR — easy to fix but confusing to diagnose

---

## Phase-Specific Warning Matrix

| Phase/Feature | Likely Pitfalls | Critical? | Mitigation |
|---|---|---|---|
| safeHook wrapper | #1 (unhandled exceptions) | YES | Build first, wrap every hook |
| System prompt injection | #4 (token budget), #11 (text mangling) | YES | 500-token budget, no editor name strings |
| Custom tool registration | #3 (name conflicts), #14 (return type), #9 (ESM/CJS) | YES | `gsd_` prefix, string returns, subprocess calls |
| Event-driven state sync | #2 (state corruption), #8 (idle frequency), #13 (feedback loops) | YES | Read-only from plugin, debounce, loop guards |
| Advisory guardrails | #6 (subagent blocking) | MODERATE | Advisory-first, never throw |
| Enhanced compaction | #7 (replace vs append), #10 (experimental API) | MODERATE | Always push, never replace. Feature-detect. |
| Tool interception | #6 (subagent), #12 (hook ordering) | MODERATE | Test with auth plugin, don't assume pristine input |
| Toast/notifications | #8 (idle frequency) | LOW | Debounce, rate-limit notifications |

## Implementation Priority

Build these defensive patterns BEFORE building features:

1. **`safeHook()` wrapper** — Every hook, no exceptions (Pitfall #1)
2. **Token budget measurement** — Know the cost before injecting (Pitfall #4)
3. **Tool naming convention** — `gsd_` prefix enforced (Pitfall #3)
4. **Async-only I/O** — No sync calls in hooks (Pitfall #5)
5. **Debounce infrastructure** — For session.idle and file watchers (Pitfall #8, #13)
6. **State write delegation** — Plugin reads, CLI writes (Pitfall #2)

## Sources

- OpenCode plugin documentation: https://opencode.ai/docs/plugins/
- OpenCode custom tools documentation: https://opencode.ai/docs/custom-tools/
- GitHub issue #12763: OpenCode crashes during plugin initialization
- GitHub issue #4137: Race condition with installDependencies()
- GitHub issue #5894: tool.execute.before doesn't intercept subagent tool calls
- GitHub issue #15267: session.idle teardown race condition
- GitHub issue #10027: Request for tool.execute.error hook
- GitHub issue #15933: Request for messageID in hook payloads
- GitHub issue #9858: Token consumption analysis and plugin disable feature request
- GitHub issue #10574: Plugin loader module resolution failures
- bGSD lessons.md: Anthropic auth plugin system prompt mangling
- bGSD plugin.js: Current 45-line implementation with 3 hooks
- bGSD src/commands/state.js: State file write patterns (no locking)
- OpenCode changelog (v1.2.16): Recent hook and plugin changes

---
*Last updated: 2026-03-08*
