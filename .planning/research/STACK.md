# Stack Research: OpenCode Plugin Hooks Integration

> **Research Date:** 2026-03-08
> **Mode:** Ecosystem (Stack-focused)
> **Sources:** GitHub source code (PRIMARY), Official Docs (opencode.ai/docs), npm registry, Context7, community guides
> **Overall Confidence:** HIGH — verified against actual source code in `packages/plugin/src/`

---

## 1. The @opencode-ai/plugin SDK

### Package Identity

| Property | Value | Confidence |
|----------|-------|------------|
| Package name | `@opencode-ai/plugin` | HIGH — npm registry |
| Current version | `1.2.22` | HIGH — npm published 2026-03-08 |
| License | MIT | HIGH — package.json |
| Module type | ESM (`"type": "module"`) | HIGH — source |
| Runtime | Bun (OpenCode runs on Bun) | HIGH — official docs |
| Dependencies | `@opencode-ai/sdk` (workspace), `zod` (catalog) | HIGH — source package.json |
| Weekly downloads | ~2.4M | HIGH — npm registry |

**Source:** https://github.com/anomalyco/opencode/blob/dev/packages/plugin/package.json

### Export Map

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./tool": "./src/tool.ts"
  }
}
```

**IMPORTANT:** The `exports` field points to `.ts` source files, not compiled JS. This works because **OpenCode uses Bun** which natively handles TypeScript. Published `dist/` is for npm consumers — local plugin files are loaded directly by Bun.

### PluginInput Type (Context Object)

```typescript
// Source: packages/plugin/src/index.ts
import type { createOpencodeClient, Project } from "@opencode-ai/sdk"
import type { BunShell } from "./shell"

export type PluginInput = {
  client: ReturnType<typeof createOpencodeClient>  // SDK client for API calls
  project: Project                                   // Current project info
  directory: string                                  // Current working directory
  worktree: string                                   // Git worktree path
  serverUrl: URL                                     // OpenCode server URL
  $: BunShell                                        // Bun's shell API
}
```

**Confidence:** HIGH — extracted directly from source

### Plugin Type Signature

```typescript
export type Plugin = (input: PluginInput) => Promise<Hooks>
```

A plugin is an async function that receives `PluginInput` and returns a `Hooks` object.

---

## 2. Complete Hooks Interface

### Source of Truth

Extracted from `packages/plugin/src/index.ts` (234 lines, 6.13 KB):

```typescript
export interface Hooks {
  // --- EVENT SUBSCRIPTION ---
  event?: (input: { event: Event }) => Promise<void>

  // --- CONFIG HOOK ---
  config?: (input: Config) => Promise<void>

  // --- CUSTOM TOOLS ---
  tool?: { [key: string]: ToolDefinition }

  // --- AUTH PROVIDER ---
  auth?: AuthHook

  // --- CHAT MESSAGE HOOK ---
  "chat.message"?: (
    input: {
      sessionID: string
      agent?: string
      model?: { providerID: string; modelID: string }
      messageID?: string
      variant?: string
    },
    output: { message: UserMessage; parts: Part[] },
  ) => Promise<void>

  // --- LLM PARAMETER MODIFICATION ---
  "chat.params"?: (
    input: {
      sessionID: string
      agent: string
      model: Model
      provider: ProviderContext
      message: UserMessage
    },
    output: { temperature: number; topP: number; topK: number; options: Record<string, any> },
  ) => Promise<void>

  // --- CUSTOM HEADERS ---
  "chat.headers"?: (
    input: {
      sessionID: string
      agent: string
      model: Model
      provider: ProviderContext
      message: UserMessage
    },
    output: { headers: Record<string, string> },
  ) => Promise<void>

  // --- PERMISSION INTERCEPTION ---
  "permission.ask"?: (
    input: Permission,
    output: { status: "ask" | "deny" | "allow" },
  ) => Promise<void>

  // --- COMMAND ENRICHMENT ---
  "command.execute.before"?: (
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Part[] },
  ) => Promise<void>

  // --- TOOL INTERCEPTION (BEFORE) ---
  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: any },
  ) => Promise<void>

  // --- SHELL ENV INJECTION ---
  "shell.env"?: (
    input: { cwd: string; sessionID?: string; callID?: string },
    output: { env: Record<string, string> },
  ) => Promise<void>

  // --- TOOL INTERCEPTION (AFTER) ---
  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string; args: any },
    output: { title: string; output: string; metadata: any },
  ) => Promise<void>

  // --- TOOL DEFINITION MODIFICATION ---
  "tool.definition"?: (
    input: { toolID: string },
    output: { description: string; parameters: any },
  ) => Promise<void>

  // --- EXPERIMENTAL: MESSAGE TRANSFORM ---
  "experimental.chat.messages.transform"?: (
    input: {},
    output: { messages: { info: Message; parts: Part[] }[] },
  ) => Promise<void>

  // --- EXPERIMENTAL: SYSTEM PROMPT INJECTION ---
  "experimental.chat.system.transform"?: (
    input: { sessionID?: string; model: Model },
    output: { system: string[] },
  ) => Promise<void>

  // --- EXPERIMENTAL: COMPACTION CUSTOMIZATION ---
  "experimental.session.compacting"?: (
    input: { sessionID: string },
    output: { context: string[]; prompt?: string },
  ) => Promise<void>

  // --- EXPERIMENTAL: TEXT COMPLETION ---
  "experimental.text.complete"?: (
    input: { sessionID: string; messageID: string; partID: string },
    output: { text: string },
  ) => Promise<void>
}
```

**Confidence:** HIGH — complete verbatim extraction from source

### Hook Pattern

All hooks follow `(input, output) => Promise<void>`:
- **`input`**: Read-only context about what triggered the hook
- **`output`**: Mutable object — modify properties to affect behavior
- **Exception**: `event` hook has `{ event }` only (no output to mutate)
- **Exception**: `config` hook receives `Config` directly
- Hooks can `throw new Error(...)` to block/reject operations (e.g., `tool.execute.before`)

---

## 3. Event Types and Payloads

### Complete Event Type List

From official docs (opencode.ai/docs/plugins, last updated Mar 7, 2026):

| Category | Event Type | When Fired |
|----------|-----------|------------|
| **Command** | `command.executed` | After a command completes |
| **File** | `file.edited` | File modified by tool |
| **File** | `file.watcher.updated` | External file change detected |
| **Installation** | `installation.updated` | Installation state changed |
| **LSP** | `lsp.client.diagnostics` | New LSP diagnostics |
| **LSP** | `lsp.updated` | LSP server state changed |
| **Message** | `message.part.removed` | Message part removed |
| **Message** | `message.part.updated` | Message part added/changed |
| **Message** | `message.removed` | Message deleted |
| **Message** | `message.updated` | Message added/changed |
| **Permission** | `permission.asked` | Permission request raised |
| **Permission** | `permission.replied` | Permission granted/denied |
| **Server** | `server.connected` | Server connection established |
| **Session** | `session.created` | New session started |
| **Session** | `session.compacted` | Session was compacted |
| **Session** | `session.deleted` | Session removed |
| **Session** | `session.diff` | Session diff computed |
| **Session** | `session.error` | Session error occurred |
| **Session** | `session.idle` | Agent finished responding |
| **Session** | `session.status` | Session status changed |
| **Session** | `session.updated` | Session metadata changed |
| **Todo** | `todo.updated` | Todo item changed |
| **Shell** | `shell.env` | Shell environment requested |
| **Tool** | `tool.execute.after` | Tool execution completed |
| **Tool** | `tool.execute.before` | Tool about to execute |
| **TUI** | `tui.prompt.append` | Text appended to prompt |
| **TUI** | `tui.command.execute` | Command executed in TUI |
| **TUI** | `tui.toast.show` | Toast notification shown |

**Confidence:** HIGH — official docs, verified against source

### Event Payload Access Pattern

```typescript
event: async ({ event }) => {
  // event.type is a string discriminator
  // event.properties contains typed payload (varies by event type)
  if (event.type === "session.idle") {
    // Properties include session info
  }
  if (event.type === "message.updated") {
    const message = (event as any).properties?.message
    // message.role, message.content, etc.
  }
  if (event.type === "file.edited") {
    // Properties include file path info
  }
}
```

**Note:** Event `properties` typing comes from `@opencode-ai/sdk` `Event` type. The exact shape varies per event type. Community plugins frequently use `(event as any).properties` for access, suggesting the discriminated union may not be fully narrowed in the current SDK types.

**Confidence:** MEDIUM — event type list from docs, but payload shapes inferred from community patterns and SDK types

---

## 4. Custom Tool Registration

### tool.ts — Complete Source

```typescript
// Source: packages/plugin/src/tool.ts (38 lines)
import { z } from "zod"

export type ToolContext = {
  sessionID: string
  messageID: string
  agent: string
  /** Current project directory for this session. */
  directory: string
  /** Project worktree root for this session. */
  worktree: string
  abort: AbortSignal
  metadata(input: { title?: string; metadata?: { [key: string]: any } }): void
  ask(input: AskInput): Promise<void>
}

type AskInput = {
  permission: string
  patterns: string[]
  always: string[]
  metadata: { [key: string]: any }
}

export function tool<Args extends z.ZodRawShape>(input: {
  description: string
  args: Args
  execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<string>
}) {
  return input
}

tool.schema = z

export type ToolDefinition = ReturnType<typeof tool>
```

**Confidence:** HIGH — verbatim from source

### Key Details

1. **`tool.schema` IS Zod** — literally `tool.schema = z`. This means `tool.schema.string()` = `z.string()`, `tool.schema.number()` = `z.number()`, etc. Full Zod API available.

2. **Zod is bundled with the plugin package** — it's a dependency of `@opencode-ai/plugin`. You do NOT need to install Zod separately. Import via `tool.schema` or directly from `zod` if you want.

3. **`execute` must return `Promise<string>`** — the tool output to the LLM is always a string.

4. **`ToolContext` provides:**
   - `sessionID`, `messageID`, `agent` — identity
   - `directory`, `worktree` — file paths
   - `abort: AbortSignal` — for cancellation
   - `metadata()` — set title/metadata displayed in UI
   - `ask()` — request permission from user

5. **Tool name collision**: Plugin tools with the same name as built-in tools take precedence (official docs confirm this).

### Usage Pattern

```typescript
import { type Plugin, tool } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      "gsd-status": tool({
        description: "Get current bGSD project status",
        args: {
          format: tool.schema.enum(["brief", "full"]).optional(),
        },
        async execute(args, context) {
          // context.directory, context.sessionID available
          // Must return a string
          return JSON.stringify({ phase: "01", status: "in_progress" })
        },
      }),
    },
  }
}
```

---

## 5. SDK Client API (client.*)

The `client` property on `PluginInput` is `ReturnType<typeof createOpencodeClient>` from `@opencode-ai/sdk`.

### TUI Methods (Most Relevant for v9.0)

| Method | Signature | Returns | Purpose |
|--------|-----------|---------|---------|
| `client.tui.showToast()` | `{ body: { message: string; variant: "success" \| "error" \| "info" \| "warning" } }` | `boolean` | Toast notification |
| `client.tui.appendPrompt()` | `{ body: { text: string } }` | `boolean` | Inject text into prompt |
| `client.tui.submitPrompt()` | `{}` | `boolean` | Submit current prompt |
| `client.tui.clearPrompt()` | `{}` | `boolean` | Clear prompt text |
| `client.tui.executeCommand()` | `{ body: { command: string } }` | `boolean` | Execute a command |
| `client.tui.openHelp()` | `{}` | `boolean` | Open help dialog |
| `client.tui.openSessions()` | `{}` | `boolean` | Open session picker |
| `client.tui.openModels()` | `{}` | `boolean` | Open model selector |
| `client.tui.openThemes()` | `{}` | `boolean` | Open theme selector |

### Session Methods (For Event-Driven Actions)

| Method | Key Params | Returns |
|--------|-----------|---------|
| `client.session.prompt()` | `{ path: { id }, body: { parts: Part[], noReply?: boolean } }` | AssistantMessage or UserMessage |
| `client.session.create()` | `{ body: { title } }` | Session |
| `client.session.list()` | — | Session[] |
| `client.session.get()` | `{ path: { id } }` | Session |
| `client.session.abort()` | `{ path: { id } }` | boolean |
| `client.session.messages()` | `{ path: { id } }` | `{ info: Message, parts: Part[] }[]` |
| `client.session.command()` | `{ path: { id }, body: { command } }` | AssistantMessage |

**Key pattern for plugins injecting context without triggering AI response:**
```typescript
await client.session.prompt({
  path: { id: sessionId },
  body: {
    noReply: true,  // Context injection, no AI response
    parts: [{ type: "text", text: "Context here" }],
  },
})
```

### App Methods

| Method | Signature | Returns |
|--------|-----------|---------|
| `client.app.log()` | `{ body: { service, level, message, extra? } }` | boolean |
| `client.app.agents()` | — | Agent[] |

**Logging levels:** `debug`, `info`, `warn`, `error`

### File/Find Methods

| Method | Purpose |
|--------|---------|
| `client.find.text()` | Search file contents |
| `client.find.files()` | Find files by name |
| `client.find.symbols()` | Workspace symbol search |
| `client.file.read()` | Read file content |
| `client.file.status()` | Git file status |

**Confidence:** HIGH — official SDK docs page (opencode.ai/docs/sdk), cross-verified with source types

---

## 6. ESM vs CJS Considerations

### Critical: plugin.js Is ESM, gsd-tools.cjs Is CJS

| File | Format | Loaded By | Runtime |
|------|--------|-----------|---------|
| `plugin.js` | **ESM** (uses `import`/`export`) | **Bun** (OpenCode runtime) | Bun |
| `bin/gsd-tools.cjs` | **CJS** (esbuild output) | **Node.js** (via `execFileSync`) | Node.js |

**Current plugin.js** already uses ESM syntax (`import { readFileSync }`, `export const BgsdPlugin`). This works because Bun natively handles ESM.

### Import Considerations

1. **`@opencode-ai/plugin` types**: Import as `import type { Plugin } from "@opencode-ai/plugin"`. Type-only imports are erased at runtime — zero cost.

2. **`tool` function**: Import as value: `import { tool } from "@opencode-ai/plugin"`. This requires the package to be available at runtime. Since OpenCode installs plugin dependencies via `bun install`, this is handled automatically.

3. **`gsd-tools.cjs` from plugin.js**: Cannot `import` a CJS file easily in ESM. The current pattern uses `execFileSync('node', ['bin/gsd-tools.cjs', ...])` which is correct and should continue.

4. **No esbuild bundling needed for plugin.js**: The plugin file is loaded directly by Bun. It should NOT be bundled into gsd-tools.cjs. Keep plugin.js as a standalone ESM file.

### Package Configuration Required

For local plugin dependencies, add to `.opencode/package.json` or the config directory:

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "latest"
  }
}
```

OpenCode runs `bun install` at startup to install these. **However**, for type-only imports, no package installation is needed at runtime — Bun just skips them.

### Known Issue: ESM Extension Resolution (#8006)

GitHub issue #8006 reported that `@opencode-ai/plugin` published `dist/index.js` with `export * from "./tool"` (missing `.js` extension), breaking ESM resolution. This affects npm consumers but NOT local plugins (Bun resolves extensionless imports). For our use case (local plugin loaded by Bun), this is a non-issue.

**Confidence:** HIGH — verified from official docs, source package.json, and current plugin.js

---

## 7. Experimental Hooks — Stability Contract

### Identified Experimental Hooks

| Hook | Status | Purpose |
|------|--------|---------|
| `experimental.chat.messages.transform` | Experimental | Modify message history before LLM call |
| `experimental.chat.system.transform` | Experimental | Inject into system prompt |
| `experimental.session.compacting` | Experimental | Customize compaction behavior |
| `experimental.text.complete` | Experimental | Modify text completion output |

### Stability Assessment

**No formal stability contract exists.** Analysis:

1. **Naming convention**: The `experimental.` prefix is the only indicator. No versioning scheme (e.g., Stability 0/1/2) is documented.

2. **Breakage risk**: Community plugins (opencode-rules, oh-my-opencode) widely use `experimental.chat.system.transform` and `experimental.session.compacting`. This creates implicit stability — breaking these would break hundreds of plugins.

3. **Current usage in bGSD**: `plugin.js` already uses `experimental.session.compacting` (shipped since v1.0). This confirms it's functional and stable-in-practice.

4. **`experimental.chat.system.transform` is critical for v9.0**: This is the primary hook for always-on context injection. It's widely used in the ecosystem.

5. **Source code shows no deprecation markers**: No `@deprecated` annotations, no alternative hooks offered.

### Recommendation

**Use experimental hooks confidently** for v9.0. Rationale:
- They've been stable through 1000+ plugin package versions
- Breaking them would affect 2.4M weekly downloads worth of ecosystem
- The `experimental.chat.system.transform` hook is the ONLY way to inject system prompt context — there's no non-experimental alternative
- Add defensive guards (null checks, try/catch) as the current plugin.js already does

**Confidence:** MEDIUM — no formal contract, but strong ecosystem evidence of stability

---

## 8. `stop` Hook — NOT in Official Types

The `stop` hook appears in community guides (johnlindquist's gist) but is **NOT present in the official `Hooks` interface** in `packages/plugin/src/index.ts`.

```typescript
// NOT in the official type:
stop: async (input) => { ... }
```

**Assessment:** This was likely a community convention or an earlier API that was removed. Do NOT rely on it for v9.0. Use `event` hook with `session.idle` instead for detecting when the agent stops.

**Confidence:** HIGH — verified by source code analysis; the `Hooks` interface is complete at 234 lines and does not include `stop`

---

## 9. Integration Strategy with Existing Architecture

### What Changes for plugin.js

| Current (v8.3) | New (v9.0) | Rationale |
|----------------|------------|-----------|
| 3 hooks | 8-10 hooks | Full embedded experience |
| No type imports | `import type { Plugin } from "@opencode-ai/plugin"` | Type safety (erased at runtime) |
| No `tool` import | `import { tool } from "@opencode-ai/plugin"` | Custom LLM-callable tools |
| No SDK client usage | `client.tui.showToast()`, `client.session.prompt()` | Toast notifications, context injection |
| `console.log` for logging | `client.app.log()` for structured logging | Proper log levels, plugin identity |
| `readFileSync` direct | Same + `execFileSync` for gsd-tools | CLI provides structured JSON |

### What Does NOT Change

| Aspect | Status | Why |
|--------|--------|-----|
| `bin/gsd-tools.cjs` | Unchanged | Still CJS, still the main CLI engine |
| esbuild pipeline | Unchanged | plugin.js is not bundled |
| `src/` modules | Unchanged | Plugin calls CLI via subprocess |
| `deploy.sh` | Minor update | Copy plugin.js to config directory |
| Node.js requirement | Unchanged | gsd-tools.cjs still needs Node.js >=22.5 |

### Plugin-to-CLI Communication Pattern

```
plugin.js (ESM, Bun)
  -> execFileSync('node', ['bin/gsd-tools.cjs', 'command', '--json'])
  -> parse JSON output
  -> use in hook logic
```

This is the **correct** pattern. Do not try to `import` gsd-tools modules directly into plugin.js — they're CJS and designed for Node.js, not Bun.

### New Dependencies for plugin.js

| Dependency | How Provided | Need to Install? |
|------------|-------------|-----------------|
| `@opencode-ai/plugin` | Type imports only in JS version | No (types erased) |
| `zod` | Via `tool.schema` (bundled in `@opencode-ai/plugin`) | No |
| `@opencode-ai/sdk` types | Transitive via plugin package | No |

**For TypeScript type-checking only** (if plugin.js becomes plugin.ts):
```json
// .opencode/package.json or config directory
{
  "dependencies": {
    "@opencode-ai/plugin": "latest"
  }
}
```

---

## 10. Hooks Mapping to v9.0 Features

| v9.0 Feature | Primary Hook(s) | SDK Client Methods |
|--------------|-----------------|-------------------|
| Always-on context injection | `experimental.chat.system.transform` | — |
| Custom LLM-callable tools | `tool` (on Hooks return) | — |
| Event-driven state sync | `event` (session.idle, file.edited) | `client.session.prompt()` |
| Smart command enrichment | `command.execute.before` | — |
| Advisory guardrails | `tool.execute.before`, `tool.execute.after` | `client.tui.showToast()` |
| Toast notifications | `event` (various) | `client.tui.showToast()` |
| Enhanced compaction | `experimental.session.compacting` | — |
| System prompt transform | `experimental.chat.system.transform` | — |
| Tool definition modification | `tool.definition` | — |

---

## 11. What NOT to Use

| API/Pattern | Why Avoid |
|-------------|-----------|
| `stop` hook | Not in official types; community-only pattern |
| `client.auth.set()` | Not relevant to bGSD; auth is user's concern |
| `chat.params` | Modifying LLM parameters is outside bGSD scope |
| `chat.headers` | Custom headers not needed |
| `auth` hook | Authentication provider not applicable |
| Direct `require()` in plugin.js | Bun runs ESM; use `import` |
| Bundling plugin.js with esbuild | Plugin loaded directly by Bun; no bundling needed |
| `(event as any).session_id` | Prefer `event.properties` typed access where possible |
| Global mutable state without session keys | Use `Map<sessionID, state>` pattern for session isolation |

---

## 12. Version Pinning Recommendation

```json
{
  "@opencode-ai/plugin": "^1.2.0"
}
```

**Rationale:** The package is at v1.2.22 with 4,404 versions published. The high churn suggests frequent releases tracking OpenCode core. Pin to `^1.2.0` minor range to get bug fixes but avoid potential breaking changes in a hypothetical 2.0.

For type-only imports in plain JS, version doesn't matter at runtime. Only relevant if doing TypeScript type-checking.

---

## Sources

| Source | URL | Trust | Date |
|--------|-----|-------|------|
| Plugin source (index.ts) | https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts | PRIMARY | 2026-03-08 |
| Tool source (tool.ts) | https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/tool.ts | PRIMARY | 2026-03-08 |
| Plugin package.json | https://github.com/anomalyco/opencode/blob/dev/packages/plugin/package.json | PRIMARY | 2026-03-08 |
| Official docs — Plugins | https://opencode.ai/docs/plugins/ | HIGH | 2026-03-07 |
| Official docs — SDK | https://opencode.ai/docs/sdk/ | HIGH | 2026-03-07 |
| npm registry | https://www.npmjs.com/package/@opencode-ai/plugin | HIGH | 2026-03-08 |
| Community guide (johnlindquist) | https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a | MEDIUM | 2026-01-11 |
| ESM issue #8006 | https://github.com/anomalyco/opencode/issues/8006 | MEDIUM | 2026-01-12 |
| Context7 plugin docs | /websites/opencode_ai_plugins | HIGH | 2026-03-08 |

---

## Confidence Summary

| Area | Confidence | Basis |
|------|-----------|-------|
| Hook interface & types | HIGH | Direct source code extraction |
| Event type list | HIGH | Official docs (Mar 7, 2026) |
| Event payload shapes | MEDIUM | SDK types + community patterns |
| Tool registration pattern | HIGH | Source + official docs + examples |
| `tool.schema = z` (Zod) | HIGH | Direct source code |
| SDK client methods | HIGH | Official SDK docs page |
| `client.tui.showToast()` signature | HIGH | Official SDK docs |
| ESM/CJS compatibility | HIGH | Current plugin.js + official docs |
| Experimental hook stability | MEDIUM | Ecosystem evidence, no formal contract |
| `stop` hook (ABSENT) | HIGH | Source code confirms non-existence |
| Plugin-to-CLI integration | HIGH | Current working pattern in plugin.js |
