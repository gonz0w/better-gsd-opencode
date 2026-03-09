# Feature Landscape: Embedded Plugin Experience (v9.0)

**Domain:** OpenCode plugin hooks, custom tools, event-driven state sync, context injection, guardrails, notifications, compaction
**Researched:** 2026-03-08
**Confidence:** HIGH (OpenCode official docs, Context7, 8+ community plugin repos, plugin development guides)

## Sources

| Source | URL | Trust |
|--------|-----|-------|
| OpenCode Plugin Docs (official) | https://opencode.ai/docs/plugins/ | HIGH |
| OpenCode Custom Tools Docs (official) | https://opencode.ai/docs/custom-tools/ | HIGH |
| OpenCode Ecosystem (official) | https://opencode.ai/docs/ecosystem/ | HIGH |
| Context7: OpenCode Plugins | /websites/opencode_ai_plugins | HIGH |
| Context7: OpenCode Core | /anomalyco/opencode | HIGH |
| johnlindquist Plugin Guide (gist) | gist.github.com/johnlindquist/0adf... | HIGH |
| opencode-dynamic-context-pruning (1.2k★) | github.com/Opencode-DCP/opencode-dynamic-context-pruning | HIGH |
| opencode-supermemory (764★) | github.com/supermemoryai/opencode-supermemory | HIGH |
| opencode-type-inject (73★) | github.com/nick-vi/opencode-type-inject | MEDIUM |
| opencode-background-agents (106★) | github.com/kdcokenny/opencode-background-agents | MEDIUM |
| rstacruz Plugin Development Guide (gist) | gist.github.com/rstacruz/946d... | MEDIUM |
| @opencode-ai/plugin SDK issue #15916 | github.com/anomalyco/opencode/issues/15916 | HIGH |

---

## OpenCode Plugin Hook Surface (Complete Reference)

Before categorizing features, here is the verified hook surface available to plugins. All hooks confirmed via official docs and Context7.

### Hooks (Input/Output Pattern)

| Hook | Fires When | Mutates | Confidence |
|------|-----------|---------|------------|
| `event` | Any event fires (30+ event types) | Read-only | HIGH |
| `stop` | Agent attempts to stop | Can re-prompt via `client.session.prompt()` | HIGH |
| `shell.env` | Shell environment constructed | `output.env` (inject env vars) | HIGH |
| `tool.execute.before` | Before any tool runs | `output.args` (modify args), throw to block | HIGH |
| `tool.execute.after` | After any tool runs | Read-only (react to results) | HIGH |
| `experimental.session.compacting` | Before LLM generates compaction summary | `output.context[]` (inject) or `output.prompt` (replace entirely) | HIGH |
| `experimental.chat.system.transform` | System prompt being assembled | `output.system[]` (push additional context) | HIGH |
| `experimental.chat.messages.transform` | Messages being sent to LLM | Transform message array | HIGH |

### Event Types (30+ confirmed)

| Category | Events |
|----------|--------|
| **Session** | `session.created`, `session.idle`, `session.compacted`, `session.deleted`, `session.diff`, `session.error`, `session.status`, `session.updated` |
| **Message** | `message.updated`, `message.removed`, `message.part.updated`, `message.part.removed` |
| **Tool** | `tool.execute.before`, `tool.execute.after` |
| **File** | `file.edited`, `file.watcher.updated` |
| **Permission** | `permission.asked`, `permission.replied` |
| **Command** | `command.executed` |
| **TUI** | `tui.prompt.append`, `tui.command.execute`, `tui.toast.show` |
| **LSP** | `lsp.client.diagnostics`, `lsp.updated` |
| **Other** | `server.connected`, `installation.updated`, `todo.updated` |

### Plugin Context Object

| Property | Type | Description |
|----------|------|-------------|
| `client` | SDK Client | Full OpenCode SDK for API calls (session.prompt, app.log, etc.) |
| `project` | Project | Current project info |
| `directory` | string | Current working directory |
| `worktree` | string | Git worktree root |
| `$` | Shell | Bun's shell API for running commands |

### Custom Tool Registration

```typescript
import { type Plugin, tool } from "@opencode-ai/plugin"
tool({
  description: "...",
  args: { param: tool.schema.string().describe("...") },  // Zod schema
  async execute(args, context) {
    // context: { agent, sessionID, messageID, directory, worktree }
    return "string result"
  }
})
```

- **Schema:** `tool.schema` is Zod — supports `.string()`, `.number()`, `.boolean()`, `.optional()`, `.describe()`
- **Naming:** Filename becomes tool name. Multiple exports: `<filename>_<exportname>`
- **Override:** Custom tools with same name as built-in take precedence
- **Location:** `.opencode/tools/` (project) or `~/.config/opencode/tools/` (global)

---

## Community Plugin Pattern Analysis

### Pattern 1: Context Management (DCP — 1.2k★)

**What it does:** Removes obsolete tool outputs from conversation history using zero-cost automatic strategies + LLM-driven pruning tools.

**Key patterns:**
- **Automatic zero-cost strategies:** Deduplication, write-supersede, error-purge — run on every request, no LLM cost
- **LLM-callable tools:** `distill`, `compress`, `prune` — AI decides when to use them
- **Nudge frequency:** Configurable "every N tool results, remind AI about pruning" (default: 10)
- **Context limit:** Token threshold that triggers the model to prune (default: 100K, supports % of model window)
- **Protected tools:** Allow-list of tools never pruned (e.g., `task`, `todowrite`)
- **Notification modes:** `"chat"` (in-conversation) vs `"toast"` (system), `"off"`, `"minimal"`, `"detailed"`
- **Subagent awareness:** DCP disables itself for subagents
- **Config cascade:** Defaults → Global → Project (JSON/JSONC with schema)

**Lesson for bGSD:** Our compaction hook should similarly protect sacred context. The "nudge frequency" pattern (periodic system prompt injection) is clever for guiding AI behavior.

### Pattern 2: Persistent Memory (Supermemory — 764★)

**What it does:** Cross-session, cross-project memory via external API. Agent remembers preferences, patterns, solutions.

**Key patterns:**
- **Context injection on first message:** Invisible to user, injects user profile + project memories + semantic matches
- **Keyword detection:** "remember", "save this", "don't forget" → auto-saves to memory
- **Scoped storage:** User scope (cross-project) vs Project scope (this project only)
- **Preemptive compaction:** At 80% context capacity, triggers summarization and saves summary as memory
- **Multi-mode tool:** Single tool with `mode` parameter (`add`, `search`, `profile`, `list`, `forget`) — not 5 separate tools
- **Confidence scores:** Shows similarity percentage in injected context
- **Privacy tags:** `<private>content</private>` prevents storage

**Lesson for bGSD:** Our memory.json dual-store already does local cross-session memory. The "inject on first message" via `experimental.chat.system.transform` pattern is directly applicable. The single-tool-with-modes pattern is worth considering.

### Pattern 3: Type Injection (type-inject — 73★)

**What it does:** Auto-injects TypeScript type signatures into file reads, reports type errors on writes.

**Key patterns:**
- **`tool.execute.after` on read:** Appends type context to file read results
- **`tool.execute.after` on write:** Runs type checker, reports errors
- **Lookup tools:** `lookup_type` and `list_types` for on-demand type information
- **Dual deployment:** Plugin (full auto-injection) or MCP server (tools only)

**Lesson for bGSD:** The "enrich after read" pattern via `tool.execute.after` could apply to our state/plan files — annotating reads with computed context.

### Pattern 4: Background Agents (opencode-background-agents — 106★)

**What it does:** Fire-and-forget research delegation with disk persistence.

**Key patterns:**
- **Three tools:** `delegate(prompt, agent)`, `delegation_read(id)`, `delegation_list()`
- **Persistence to disk:** Results saved as markdown in `~/.local/share/opencode/delegations/`
- **Read-only constraint:** Only read-only agents can delegate (write agents must use native `task`)
- **Auto-tagging:** Each delegation gets title + summary for later discovery
- **15-minute timeout**
- **Compaction-safe:** Results on disk, not in context

**Lesson for bGSD:** Our subagent architecture already handles delegation. The disk persistence pattern for surviving compaction is relevant to our state sync.

### Pattern 5: Notifications (opencode-notificator, opencode-notifier, opencode-notify)

**What it does:** Desktop notifications and sound alerts for various events.

**Key patterns:**
- **Platform-specific:** `osascript` for macOS, `notify-send` for Linux, `powershell` for Windows
- **Event triggers:** `session.idle`, `session.error`, `permission.asked`
- **Debouncing:** Notifications grouped/throttled to prevent fatigue
- **Desktop app note:** OpenCode desktop app handles notifications natively — plugins needed only for TUI

---

## Feature Categories

### Category 1: Always-On Context Injection

Features that ensure the LLM always knows the project's current state via `experimental.chat.system.transform`.

| Feature | Category | Complexity | Dependencies | Description |
|---------|----------|------------|--------------|-------------|
| **System prompt state injection** | TABLE STAKES | Medium | `gsd-tools init` output, STATE.md | Inject current phase, plan, blockers, velocity into every system prompt via `experimental.chat.system.transform`. LLM always knows where the project is. |
| **Active plan context** | TABLE STAKES | Medium | `gsd-tools plan:active`, PLAN.md | Inject current task, completed tasks, next steps from active plan. Agent never asks "where was I?" |
| **Blockers & decisions injection** | TABLE STAKES | Low | STATE.md blockers section, memory.json | Surface active blockers and recent decisions so agent doesn't repeat mistakes. |
| **Conditional injection (bGSD projects only)** | TABLE STAKES | Low | `.planning/` directory detection | Only inject context when `.planning/` exists. Non-bGSD projects get zero overhead. |
| **Token-budgeted injection** | DIFFERENTIATOR | Medium | tokenx token counting | Cap injected context at configurable token limit (e.g., 2K). Avoid bloating system prompt for large projects. |
| **Stale state detection** | DIFFERENTIATOR | Medium | Git commit tracking, file mtimes | Detect when injected state is stale (e.g., STATE.md modified since last read) and re-read. |
| **Phase-aware skill suggestions** | DIFFERENTIATOR | High | Phase metadata, skill index | Suggest relevant `/bgsd-*` commands based on current phase status (e.g., "Phase is planned but not executed — try `/bgsd-execute-phase`"). |
| **Full project dashboard injection** | ANTI-FEATURE | — | — | Injecting everything (all phases, all plans, full roadmap) into system prompt. Wastes 5K+ tokens. Context injection must be surgical. |

### Category 2: Custom LLM-Callable Tools

Tools registered via `tool` property that replace CLI shell-out overhead on hot paths.

| Feature | Category | Complexity | Dependencies | Description |
|---------|----------|------------|--------------|-------------|
| **`gsd_status` tool** | TABLE STAKES | Low | `gsd-tools init --compact` | Single tool call returns project status (phase, plan, progress, blockers). Replaces `bash("node gsd-tools init --compact")` with native tool — faster, typed, no shell overhead. |
| **`gsd_state` tool (read/patch)** | TABLE STAKES | Medium | STATE.md read/write/patch | Read or update STATE.md fields. Multi-mode: `read`, `patch` (update position, add blocker, record metric). Replaces 3-4 CLI calls. |
| **`gsd_plan` tool** | TABLE STAKES | Medium | Plan file parsing | Read active plan, get task details, mark task done. Replaces `plan:active`, `plan:read`, `execute:advance-task`. |
| **`gsd_memory` tool** | DIFFERENTIATOR | Medium | memory.json dual-store | Read/write cross-session memory. Modes: `get`, `set`, `search`, `list`. Lets agent explicitly save decisions. |
| **`gsd_velocity` tool** | DIFFERENTIATOR | Low | velocity calculations | Get execution velocity metrics. Quick data access without full CLI format overhead. |
| **`gsd_context` tool** | DIFFERENTIATOR | High | Context builder, manifests | Build context for a specific agent/task. Returns relevant files, state, plan context. Replaces manual context assembly. |
| **Tool naming convention** | TABLE STAKES | Low | — | All tools prefixed `gsd_` for namespace clarity. Matches community convention (e.g., `supermemory`, `distill`). Use snake_case per Zod schema conventions. |
| **Zod schema with `.describe()`** | TABLE STAKES | Low | — | Every tool arg gets `.describe()` for LLM discoverability. Following DCP and type-inject patterns. |
| **50+ tools** | ANTI-FEATURE | — | — | Registering every CLI command as a tool. LLMs perform worse with too many tools. Limit to 5-8 high-frequency tools. |
| **Replacing all CLI commands** | ANTI-FEATURE | — | — | Tools should cover hot paths only. Infrequent operations (milestone init, deploy) stay as CLI commands via bash. |

### Category 3: Event-Driven State Sync

React to events to keep project state synchronized automatically.

| Feature | Category | Complexity | Dependencies | Description |
|---------|----------|------------|--------------|-------------|
| **Session idle → state sync** | TABLE STAKES | Medium | `session.idle` event, STATE.md | When agent finishes responding, check if state needs updating (e.g., task completed but STATE.md not advanced). Prompt agent or auto-update. |
| **File edit → plan tracking** | TABLE STAKES | Medium | `file.edited` event, active plan | Track which plan files have been modified. Correlate with task file lists. Surface "Task 2 files all modified — ready to verify?" |
| **Session created → greeting** | TABLE STAKES | Low | `session.created` event | Replace current `console.log` greeting with proper context: current phase, active task, blockers. Injected via `experimental.chat.system.transform` instead. |
| **Commit detection → task advance** | DIFFERENTIATOR | Medium | `tool.execute.after` on bash (git commit regex) | Detect when agent commits. Cross-reference with active task's expected commit. Surface "Task N appears complete — advance?" |
| **Session compacted → state preservation** | TABLE STAKES | Medium | `session.compacted` event | Log that compaction occurred. Ensure next interaction re-injects full state context. |
| **File watcher → plan invalidation** | DIFFERENTIATOR | High | `file.watcher.updated` event | Detect external file changes (user edited a plan file outside OpenCode). Invalidate cached state, re-read on next interaction. |
| **Test result tracking** | DIFFERENTIATOR | Medium | `tool.execute.after` on bash (test runner regex) | Parse test output from bash tool results. Track pass/fail counts across session. Surface in context: "Tests: 762/766 passing (4 failing)". |
| **Session-scoped state map** | TABLE STAKES | Low | In-memory Map keyed by sessionID | Track per-session state (files modified, tests run, commits made). Following community pattern from johnlindquist guide. Clean up on `session.deleted`. |
| **Bidirectional git-to-state sync** | ANTI-FEATURE | — | — | Auto-committing or auto-pushing on state changes. Violates human-in-the-loop principle. |
| **Real-time file polling** | ANTI-FEATURE | — | — | Polling filesystem for changes. Use `file.watcher.updated` event instead. |

### Category 4: Smart Command Enrichment

Enhance `/bgsd-*` slash commands with auto-injected context before execution.

| Feature | Category | Complexity | Dependencies | Description |
|---------|----------|------------|--------------|-------------|
| **Command context injection** | TABLE STAKES | Medium | `tui.command.execute` event, state data | When user runs a `/bgsd-*` command, auto-inject current project context into the prompt. Agent doesn't need to re-discover state. |
| **Phase argument auto-resolution** | DIFFERENTIATOR | Medium | `tui.command.execute` event, active phase | If user runs `/bgsd-execute-phase` without args, auto-detect current phase from STATE.md. Reduce friction. |
| **Command validation** | DIFFERENTIATOR | Low | `tui.command.execute` event | Validate command makes sense in current state. Warning if running `/bgsd-execute-phase` when no plans exist yet. |
| **Prompt append for context** | TABLE STAKES | Low | `tui.prompt.append` event | Append project context to user's prompt text before it reaches the LLM. Lighter-weight than full system prompt transform. |
| **Command auto-completion** | ANTI-FEATURE | — | — | OpenCode handles its own command completion. Plugin shouldn't interfere with TUI input. |

### Category 5: Advisory Guardrails

Tool interception patterns that enforce conventions without blocking.

| Feature | Category | Complexity | Dependencies | Description |
|---------|----------|------------|--------------|-------------|
| **Test-after-edit advisory** | TABLE STAKES | Medium | `tool.execute.after` on edit/write, test runner detection | Track file edits. After N edits without running tests, inject advisory: "You've modified 5 files without running tests. Consider running the test suite." |
| **Convention enforcement** | DIFFERENTIATOR | High | Convention extraction, `tool.execute.before` on write | Check written files against project conventions (naming, structure). Advisory warning if conventions violated. |
| **.env protection** | TABLE STAKES | Low | `tool.execute.before` on read | Block reading `.env` files. Following community standard pattern. |
| **Dangerous command warning** | TABLE STAKES | Low | `tool.execute.before` on bash | Warn on `rm -rf`, `git push --force`, `git reset --hard`. Community-established pattern. |
| **Commit message convention** | DIFFERENTIATOR | Medium | `tool.execute.before` on bash (git commit regex) | Validate commit messages follow project's conventional commit format. Advisory warning. |
| **Plan file protection** | DIFFERENTIATOR | Low | `tool.execute.before` on write | Warn when agent attempts to modify ROADMAP.md, completed plans, or archived state. These should be immutable. |
| **Blocking guardrails** | ANTI-FEATURE | — | — | Throwing errors to block tool execution should be rare and limited to security (.env). Advisory > blocking for conventions. |

### Category 6: Toast / Notification UX

Desktop and TUI notifications for important state transitions.

| Feature | Category | Complexity | Dependencies | Description |
|---------|----------|------------|--------------|-------------|
| **Phase transition notifications** | TABLE STAKES | Low | State change detection, `$` shell API | Notify when a phase completes or a new phase begins. Platform-specific: `osascript` (macOS), `notify-send` (Linux). |
| **Session idle notification** | TABLE STAKES | Low | `session.idle` event | "Task complete" notification when agent finishes. Following 3+ community plugin pattern. |
| **Error/stuck notification** | DIFFERENTIATOR | Medium | `session.error` event, stuck detection | Notify when session errors or agent appears stuck (3+ failed attempts). |
| **Permission request notification** | TABLE STAKES | Low | `permission.asked` event | Notify when agent is waiting for permission. User may be in another window. |
| **Milestone completion celebration** | DIFFERENTIATOR | Low | Milestone detection | Special notification with summary when a milestone completes. |
| **Notification frequency throttling** | TABLE STAKES | Low | Debounce logic | Max 1 notification per 30 seconds. Prevent notification fatigue. Community plugins all implement debouncing. |
| **Platform detection** | TABLE STAKES | Low | `process.platform` check | Auto-detect macOS vs Linux vs WSL for notification command. |
| **Sound alerts** | DIFFERENTIATOR | Low | Platform audio APIs | Optional sound on completion (following opencode-notificator pattern). Disabled by default. |
| **TUI toast integration** | DIFFERENTIATOR | Medium | `tui.toast.show` event awareness | Surface bGSD status changes as TUI toasts rather than OS notifications when in TUI mode. |
| **Notification spam** | ANTI-FEATURE | — | — | Notifying on every event. Only notify on state transitions and user-attention-needed moments. |

### Category 7: Enhanced Compaction

Preserve critical project context across session compaction.

| Feature | Category | Complexity | Dependencies | Description |
|---------|----------|------------|--------------|-------------|
| **STATE.md preservation** | TABLE STAKES | Low | `experimental.session.compacting` hook | Already implemented. Inject full STATE.md content into compaction context. |
| **Active plan preservation** | TABLE STAKES | Medium | Active plan detection, plan reading | Inject current plan with task status into compaction context. Agent resumes knowing exactly which task to work on. |
| **Decision history preservation** | TABLE STAKES | Medium | memory.json decisions store | Inject recent decisions (last 5-10) into compaction context. Prevents agent from re-deciding settled questions. |
| **Blocker preservation** | TABLE STAKES | Low | STATE.md blockers section | Ensure active blockers survive compaction. Already partially covered by STATE.md preservation. |
| **Session metrics preservation** | DIFFERENTIATOR | Low | Session-scoped state map | Preserve session metrics (files modified, tests run, commits made) across compaction. |
| **Custom compaction prompt** | DIFFERENTIATOR | High | `output.prompt` replacement | Replace default compaction prompt with bGSD-aware version that structures the summary around project phases, tasks, and decisions. Following DCP and swarm session patterns. |
| **Roadmap context in compaction** | DIFFERENTIATOR | Medium | ROADMAP.md, phase summaries | Include abbreviated roadmap (phase names + status) so compacted context maintains big-picture awareness. |
| **Files-in-progress tracking** | TABLE STAKES | Medium | `tool.execute.after` file tracking | Track which files are actively being modified. Include in compaction context so agent doesn't lose track of work-in-progress. |
| **Full conversation replay** | ANTI-FEATURE | — | — | Trying to preserve the entire conversation. Compaction exists to reduce context. Preserve structure, not content. |
| **Compacting all project files** | ANTI-FEATURE | — | — | Including full ROADMAP.md + all plans. Too much context defeats the purpose. Summaries only. |

---

## Feature Priority Matrix

### Must-Have (Table Stakes) — 18 features

These are expected by any serious planning plugin. Without them, the plugin feels disconnected.

| # | Feature | Hook/Mechanism | Complexity | Existing Foundation |
|---|---------|---------------|------------|---------------------|
| 1 | System prompt state injection | `experimental.chat.system.transform` | Medium | `gsd-tools init --compact` output exists |
| 2 | Active plan context injection | `experimental.chat.system.transform` | Medium | `gsd-tools plan:active` exists |
| 3 | Blocker/decision injection | `experimental.chat.system.transform` | Low | STATE.md parsing exists |
| 4 | Conditional injection (bGSD only) | `.planning/` check | Low | Directory detection exists |
| 5 | `gsd_status` tool | `tool` registration | Low | `init --compact` CLI exists |
| 6 | `gsd_state` tool | `tool` registration | Medium | STATE.md CRUD exists |
| 7 | `gsd_plan` tool | `tool` registration | Medium | Plan parsing exists |
| 8 | Tool naming convention (`gsd_*`) | Plugin architecture | Low | New |
| 9 | Zod schema with `.describe()` | Plugin architecture | Low | New |
| 10 | Session idle state sync | `event` handler | Medium | State validation exists |
| 11 | File edit plan tracking | `event` handler | Medium | Plan file lists exist |
| 12 | Session greeting with context | `experimental.chat.system.transform` | Low | Current `console.log` exists |
| 13 | Session-scoped state map | In-memory Map | Low | Pattern from community |
| 14 | Test-after-edit advisory | `tool.execute.after` | Medium | Anti-pattern detection exists |
| 15 | .env protection | `tool.execute.before` | Low | Community standard |
| 16 | Dangerous command warning | `tool.execute.before` | Low | Community standard |
| 17 | STATE.md compaction preservation | `experimental.session.compacting` | Low | Already implemented |
| 18 | Active plan compaction | `experimental.session.compacting` | Medium | Plan reading exists |

### Should-Have (Differentiators) — 17 features

These set bGSD apart from generic plugins. They demonstrate deep domain integration.

| # | Feature | Hook/Mechanism | Complexity |
|---|---------|---------------|------------|
| 1 | Token-budgeted injection | `experimental.chat.system.transform` | Medium |
| 2 | Stale state detection | File mtime tracking | Medium |
| 3 | Phase-aware skill suggestions | `experimental.chat.system.transform` | High |
| 4 | `gsd_memory` tool | `tool` registration | Medium |
| 5 | `gsd_velocity` tool | `tool` registration | Low |
| 6 | `gsd_context` tool | `tool` registration | High |
| 7 | Commit detection → task advance | `tool.execute.after` | Medium |
| 8 | File watcher plan invalidation | `event` handler | High |
| 9 | Test result tracking | `tool.execute.after` | Medium |
| 10 | Phase argument auto-resolution | `tui.command.execute` | Medium |
| 11 | Command validation | `tui.command.execute` | Low |
| 12 | Convention enforcement | `tool.execute.before` | High |
| 13 | Commit message convention | `tool.execute.before` | Medium |
| 14 | Plan file protection | `tool.execute.before` | Low |
| 15 | Custom compaction prompt | `experimental.session.compacting` | High |
| 16 | Error/stuck notification | `event` handler | Medium |
| 17 | Session metrics preservation | `experimental.session.compacting` | Low |

### Won't-Build (Anti-Features) — 9 items

| # | Anti-Feature | Why Not |
|---|-------------|---------|
| 1 | Full project dashboard in system prompt | Wastes 5K+ tokens. Injection must be surgical — current phase/plan/blockers only. |
| 2 | 50+ registered tools | LLMs degrade with too many tools. Community consensus: 5-8 tools max. DCP uses 3, Supermemory uses 1 (multi-mode). |
| 3 | Replacing all CLI commands with tools | Only hot paths. Infrequent ops (milestone init, deploy) stay as bash CLI calls. |
| 4 | Bidirectional git-to-state sync | Auto-committing violates human-in-the-loop. Agent should advise, not act autonomously on git. |
| 5 | Real-time file polling | Events exist (`file.watcher.updated`). Polling wastes resources. |
| 6 | Blocking guardrails (except security) | Advisory > blocking. Throwing errors disrupts agent flow. Only block for security (.env, rm -rf). |
| 7 | Notification spam | Throttle to max 1 per 30s. Only notify on state transitions and attention-needed moments. |
| 8 | Full conversation replay in compaction | Defeats the purpose of compaction. Preserve structure (phase, task, decisions), not raw conversation. |
| 9 | Command auto-completion override | TUI handles its own completion. Don't fight the platform. |

---

## Dependency Analysis

### What Already Exists (Build On Top Of)

| Existing Feature | Used By | How |
|-----------------|---------|-----|
| `gsd-tools init --compact` | System prompt injection, `gsd_status` tool | Parse JSON output for current state |
| `gsd-tools plan:active` | Active plan injection, `gsd_plan` tool | Get active plan/task data |
| `gsd-tools state:read/patch` | `gsd_state` tool, state sync | Read/update STATE.md |
| STATE.md parsing | Blocker injection, compaction | Extract sections from STATE.md |
| memory.json dual-store | Decision preservation, `gsd_memory` tool | Cross-session memory |
| Convention extraction | Convention enforcement guardrail | Extracted conventions from codebase-intel |
| Token estimation (tokenx) | Token-budgeted injection | Count tokens before injecting |
| File cache (cachedReadFile) | All file-reading operations | Avoid redundant reads within a session |
| Stuck/loop detection | Error/stuck notification | 3-failure detection already exists |
| Anti-pattern detection | Test-after-edit advisory | Pattern already exists in v7.0 |

### New Infrastructure Needed

| Component | Required By | Description |
|-----------|-------------|-------------|
| Plugin architecture (TypeScript) | All features | Current plugin.js is minimal JS. Need to expand with proper hook registration. |
| Bun shell (`$`) integration | Notifications, shell commands | Current plugin uses `readFileSync`. Need `$` from context for platform commands. |
| Session state manager | Event-driven features | In-memory Map<sessionID, SessionState> for tracking files modified, tests run, commits. |
| CLI-to-tool bridge | All custom tools | Function that calls `gsd-tools` CLI internally and returns parsed JSON. Avoids duplicating logic. |
| Platform detection | Notifications | `process.platform` check for notification commands. |

---

## Tool Design Recommendations

Based on community analysis, here are the patterns that work:

### Naming
- **Prefix:** `gsd_` (not `bgsd_` — too long, not `gsd-` — tool names are identifiers)
- **Convention:** `gsd_status`, `gsd_state`, `gsd_plan`, `gsd_memory`, `gsd_velocity`
- **Count:** 5-6 core tools. DCP has 3. Supermemory has 1 (multi-mode). More is worse.

### Schema Pattern
```typescript
// Single-mode tool (simple)
tool({
  description: "Get bGSD project status",
  args: {},
  async execute(args, context) { ... }
})

// Multi-mode tool (complex operations)
tool({
  description: "Manage bGSD project state",
  args: {
    mode: tool.schema.enum(["read", "patch"]).describe("Operation mode"),
    field: tool.schema.string().optional().describe("Field to read/update"),
    value: tool.schema.string().optional().describe("Value to set (patch mode)"),
  },
  async execute(args, context) { ... }
})
```

### Supermemory's Single-Tool-Multi-Mode Pattern

Supermemory (764★) uses ONE tool with a `mode` parameter for all operations. This works because:
1. Fewer tools = better LLM tool selection
2. Related operations grouped logically
3. LLM learns "supermemory = memory ops" rather than 5 different tool names

**Recommendation for bGSD:** Use 3-5 tools, not 1. Our operations span different domains (state, plan, memory) which are semantically distinct enough to warrant separate tools. But within a domain, use multi-mode (e.g., `gsd_state` with `read`/`patch` modes).

### Context Available in Tool Execute

```typescript
context = {
  agent: string,      // Which agent is calling
  sessionID: string,   // Current session
  messageID: string,   // Current message
  directory: string,   // Working directory
  worktree: string,    // Git worktree root
  abort: AbortSignal,  // Cancellation signal
}
```

---

## Compaction Strategy Recommendations

Based on DCP (1.2k★), Supermemory (764★), and official docs:

### Current State (v8.3)
Only preserves STATE.md content. Loses: active plan, decisions, blockers detail, files-in-progress.

### Recommended Strategy (v9.0)
```typescript
"experimental.session.compacting": async (input, output) => {
  // Layer 1: Project state (current)
  output.context.push(stateContent)
  
  // Layer 2: Active plan with task status (NEW)
  output.context.push(activePlanSummary)
  
  // Layer 3: Recent decisions from memory.json (NEW)
  output.context.push(recentDecisions)
  
  // Layer 4: Files being actively modified (NEW)
  output.context.push(filesInProgress)
  
  // Layer 5: Session metrics summary (NEW)
  output.context.push(sessionMetrics)
}
```

### Advanced: Custom Compaction Prompt (Differentiator)
Replace the default compaction prompt entirely with a bGSD-aware version:
```typescript
output.prompt = `
You are generating a continuation prompt for a bGSD planning session.

Summarize:
1. Current phase and active plan/task
2. What was accomplished in this session
3. Active blockers and recent decisions
4. Files being modified and their status
5. Next steps to continue the current task

Format as a structured prompt that preserves project context.
`
```

**Trade-off:** Setting `output.prompt` ignores `output.context[]`. Use one approach, not both. Recommend starting with `output.context[]` (additive) and graduating to `output.prompt` (replacement) after validating the approach.

---

## Notification Pattern Recommendations

Based on 3 community notification plugins + DCP's notification system:

### Event → Notification Mapping

| Event | Notification | Priority | Platform |
|-------|-------------|----------|----------|
| `session.idle` (task complete) | "bGSD: Task complete" | Normal | OS notification |
| `session.error` | "bGSD: Session error" | High | OS notification |
| `permission.asked` | "bGSD: Permission needed" | High | OS notification |
| Phase complete | "bGSD: Phase X complete!" | Normal | OS notification |
| Stuck detection (3+ failures) | "bGSD: Agent may be stuck" | High | OS notification |

### Throttling
- **Minimum interval:** 30 seconds between notifications
- **Batch notifications:** Group multiple events into one notification
- **Quiet mode:** Configurable per-user. Some users prefer no notifications.

### Platform Commands
```javascript
// macOS
await $`osascript -e 'display notification "${message}" with title "bGSD"'`
// Linux
await $`notify-send "bGSD" "${message}"`
// WSL  
await $`powershell.exe -Command "New-BurntToastNotification -Text 'bGSD','${message}'" 2>/dev/null`
```

---

## Guardrail Pattern Recommendations

Based on community .env protection, DCP protected tools, and type-inject patterns:

### Advisory vs Blocking

| Pattern | Type | Action |
|---------|------|--------|
| .env file read | **BLOCKING** | `throw new Error("Do not read .env files")` |
| `rm -rf /`, `git push --force` | **BLOCKING** | `throw new Error("Dangerous command blocked")` |
| N edits without tests | **ADVISORY** | Inject reminder into next system prompt |
| Non-conventional commit message | **ADVISORY** | Log warning, don't block |
| Modifying completed plan files | **ADVISORY** | Log warning about immutable files |

### Implementation Pattern
```typescript
"tool.execute.before": async (input, output) => {
  // BLOCKING: Security
  if (input.tool === "read" && output.args.filePath?.includes(".env")) {
    throw new Error("Do not read .env files")
  }
  // ADVISORY: Track for later nudging
  if (input.tool === "edit" || input.tool === "write") {
    sessionState.editsSinceTest++
  }
}
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| System prompt injection too large | Medium | High (token waste) | Token budget cap, measure before/after |
| Tool count degrading LLM performance | Low | High | Start with 3 tools, add incrementally with A/B testing |
| Event handler performance impact | Low | Medium | All handlers must be async, non-blocking, with try/catch |
| Compaction losing critical state | Medium | High | Structured `output.context[]`, not prose |
| Notification fatigue | Medium | Low | 30s throttle, configurable quiet mode |
| `experimental.*` hooks changing API | Medium | Medium | Prefix indicates instability. Abstract behind internal API. |
| Plugin TypeScript vs current JS | Low | Low | Current plugin.js is already ESM. TypeScript supported natively by Bun. |

---

## Implementation Sequence Recommendation

Based on dependencies and value:

1. **Foundation:** Plugin architecture, session state manager, CLI-to-tool bridge
2. **Context injection:** `experimental.chat.system.transform` with state + plan + blockers
3. **Core tools:** `gsd_status`, `gsd_state`, `gsd_plan` (3 tools)
4. **Event handlers:** `session.idle` sync, file edit tracking, commit detection
5. **Compaction enhancement:** Active plan + decisions + files-in-progress
6. **Guardrails:** .env protection, dangerous command warning, test-after-edit advisory
7. **Notifications:** Platform detection, phase transition, session idle, error
8. **Differentiators:** Token budgeting, custom compaction prompt, convention enforcement, `gsd_memory` tool

---

*Research complete. 35 features categorized (18 table stakes, 17 differentiators, 9 anti-features). All based on verified OpenCode plugin API surface and community plugin patterns.*
