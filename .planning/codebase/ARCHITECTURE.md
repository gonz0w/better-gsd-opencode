# bGSD Architecture

This document describes the overall system architecture of the Better Getting Stuff Done (bGSD) planning plugin for OpenCode.

---

## Design Philosophy

bGSD separates **deterministic operations** from **AI reasoning**:

- **Deterministic layer** (`bin/bgsd-tools.cjs`) — Parsing, validation, git operations, file I/O, state management, AST analysis, task classification. Always produces the same output for the same input.
- **AI layer** (workflow `.md` files) — Agent behavior definitions. LLMs follow these as step-by-step prompts, calling the bGSD CLI for structured data.

This separation means:
- AI agents never parse markdown directly — they receive clean JSON from CLI commands
- State changes are atomic — CLI helpers handle file writes and git commits
- Workflows are portable — any LLM that follows markdown instructions can execute them
- Testing is straightforward — 1,500+ tests cover the deterministic layer

---

## Overall System Architecture

```
User Input
    |
    v
OpenCode Editor Session
    |
    v
Slash Command (commands/bgsd-*.md)       <-- Thin wrapper, routes to workflow
    |
    v
Workflow (.md files)                       <-- AI follows step-by-step prompts
    |
    +-- calls bgsd-tools.cjs              <-- Deterministic data operations
    |     |
    |     +-- reads/writes .planning/    <-- Structured markdown + JSON
    |     +-- git operations              <-- Commits, branches, tags
    |     +-- JSON output                 <-- Structured data for AI
    |
    +-- spawns subagents                  <-- Specialized AI agents
          |
          +-- bgsd-planner               <-- Creates PLAN.md
          +-- bgsd-executor               <-- Implements code
          +-- bgsd-verifier               <-- Verifies results
          +-- (etc.)
```

### Two-Layer Architecture

The architecture follows a strict two-layer model:

**Layer 1: Deterministic CLI** (`bin/bgsd-tools.cjs`)
- Built from `src/` via esbuild (see `build.cjs`)
- Single-file Node.js bundle, zero external runtime dependencies
- Handles all file I/O, git operations, parsing, validation, and state management
- Commands return structured JSON for AI consumption
- Lazy-loading architecture: only required command modules are loaded per invocation

**Layer 2: AI Workflows** (`workflows/*.md`)
- Markdown files containing step-by-step prompts for AI agents
- Call the CLI for data gathering and state mutation
- Spawn specialized subagents for complex tasks
- Human-readable and portable across AI providers

---

## Key Components

### 1. CLI Tool (`bin/bgsd-tools.cjs`)

The CLI is the **brain** of the system. Built from `src/` via esbuild:

**Source structure (`src/`):**
```
src/
  index.js                 # Entry point, argument parsing
  router.js                # Command dispatch, namespace routing (init:, plan:, etc.)
  commands/                 # 30 command modules (lazy-loaded)
  lib/                     # Shared libraries (db, cache, git, ast, etc.)
  plugin/                   # Host editor plugin (ESM, separate build)
```

**Command namespaces:**
- `init:*` — Compound context for workflows (13 subcommands)
- `plan:*` — Plan lifecycle management
- `verify:*` — Quality gates and validation
- `execute:*` — Execution operations including trajectory engineering
- `workspace:*` — JJ workspace management
- `util:*` — Utility operations (config, codebase analysis, etc.)
- `memory:*` — Persistent memory store operations
- `research:*` — Research infrastructure
- `release:*` — Release operations
- `review:*` — Code review scanning

**Lazy loading pattern:**
```javascript
function lazyState() { return _modules.state || (_modules.state = require('./commands/state')); }
```

Each command module is loaded on first use, not at startup. This avoids parsing and initializing all modules when only one command runs.

---

### 2. Workflows (`workflows/*.md`)

Workflows are step-by-step prompts that AI agents follow. They are **not** executable code but instruction sets for LLMs.

**Key workflows:**

| Workflow | Purpose |
|----------|---------|
| `plan-phase.md` | Creates PLAN.md files from phase context |
| `execute-phase.md` | Wave-based parallel plan execution |
| `execute-plan.md` | Single plan execution with TDD support |
| `verify-work.md` | Verifies phase goals achieved |
| `discuss-phase.md` | Implementation decision gathering |
| `new-project.md` | Project initialization with 5 parallel researchers |
| `map-codebase.md` | Brownfield codebase analysis |
| `github-ci.md` | Autonomous CI quality gate |

**Workflow structure:**
- `<purpose>` — What this workflow accomplishes
- `<core_principle>` — Key design constraint
- `<required_reading>` — Files to read before starting
- `<process>` — Sequential steps with named sections
- `<skill:*>` — Skill references for reusable behaviors

---

### 3. Commands (`commands/*.md`)

Commands are thin wrappers deployed to the host editor's `commands/` directory. They route to the appropriate workflow:

```markdown
description: Canonical planning-family command for planning roadmap gaps
---
<objective>
Use the canonical planning-family entrypoint...
</objective>
<execution_context>
Route first. Do not preload sibling planning-family workflows...
</execution_context>
<process>
Treat `/bgsd-plan` as the canonical planning umbrella...
</process>
```

**Command routing pattern:**
- Commands use `<process>` sections to determine which workflow to invoke
- Workflows are loaded via the Read tool using `__OPENCODE_CONFIG__` path placeholder
- Path placeholders are substituted during deploy to actual OpenCode config paths

**24 commands deployed:**
- `bgsd-plan.md`, `bgsd-execute-phase.md`, `bgsd-verify-work.md`
- `bgsd-new-project.md`, `bgsd-new-milestone.md`, `bgsd-quick.md`
- `bgsd-github-ci.md`, `bgsd-security.md`, `bgsd-release.md`
- `bgsd-debug.md`, `bgsd-help.md`, `bgsd-settings.md`
- `bgsd-inspect.md`, `bgsd-resume.md`, `bgsd-pause.md`
- And more...

---

### 4. Agents (`agents/*.md`)

bGSD uses **10 specialized AI agents**, each purpose-built for a specific task. Communication happens through files, not conversation history.

**Agent roster:**

| Agent | Role | Spawned By |
|-------|------|------------|
| `bgsd-planner` | Creates PLAN.md from phase context | `/bgsd-plan phase` |
| `bgsd-executor` | Implements a single plan | `/bgsd-execute-phase` |
| `bgsd-verifier` | Verifies phase goals achieved | `/bgsd-execute-phase` |
| `bgsd-plan-checker` | Reviews plan quality, requests revisions | `/bgsd-plan phase` |
| `bgsd-debugger` | Systematic debugging with persistent state | `/bgsd-debug` |
| `bgsd-phase-researcher` | Researches implementation approaches | `/bgsd-plan phase --research` |
| `bgsd-project-researcher` | Domain research (5 parallel) | `/bgsd-new-project` |
| `bgsd-roadmapper` | Creates phased roadmaps | `/bgsd-new-project` |
| `bgsd-github-ci` | Autonomous CI quality gate | `/bgsd-github-ci` |
| `bgsd-codebase-mapper` | Codebase analysis (4 parallel) | `/bgsd-map-codebase` |

**Agent spawning pattern:**
```javascript
Task(
  prompt="<context and instructions>",
  subagent_type="bgsd-executor",
  model="{executor_model}",
  description="Execute Plan 01-01"
)
```

Each agent gets a **fresh context window**. Communication through files:
- Plans go in → Code and summaries come out
- Research documents go in → Synthesis comes out
- Verification criteria go in → Verification reports come out

**Model profiles:**
| Profile | Model | Intended Use |
|---------|-------|--------------|
| `quality` | `gpt-5.4` | Best reasoning and review quality |
| `balanced` | `gpt-5.4-mini` | Recommended day-to-day default |
| `budget` | `gpt-5.4-nano` | Fastest/lowest-cost routine work |

---

### 5. Hooks (Plugin System)

The plugin (`plugin.js`, built from `src/plugin/`) integrates with OpenCode's hook system:

**5 hooks registered:**

1. **`experimental.chat.system.transform`** — Compact system prompt + notification injection
2. **`experimental.session.compacting`** — Structured XML context preservation
3. **`command.execute.before`** — Slash command enrichment
4. **`event`** — Session idle + file watcher dispatch
5. **`tool.execute.after`** — Stuck/loop detection

**Hook wrapper (`safe-hook.js`):**
All hooks are wrapped in `safeHook` for universal error boundary protection:
- Retry logic
- Timeout handling
- Circuit breaker pattern
- Correlation-ID logging

**Event subsystems:**
- `createNotifier` — Notification system with dual-channel routing (OS + context injection)
- `createFileWatcher` — File watching for `.planning/` changes
- `createIdleValidator` — Idle-time validation runner
- `createStuckDetector` — Agent stuck/loop detection
- `createAdvisoryGuardrails` — Convention and planning file warnings

---

## Data Flow Between Components

### Example: Plan and Execute Flow

```
/bgsd-plan phase 1
    |
    v
plan-phase.md workflow
    |
    +-- node bin/bgsd-tools.cjs init:plan-phase 1 --raw
    |     --> JSON: roadmap, state, config, codebase context
    +-- node bin/bgsd-tools.cjs plan:roadmap get-phase 1
    |     --> JSON: phase goal, success criteria
    +-- node bin/bgsd-tools.cjs lessons:list --query 1
    |     --> JSON: relevant past lessons
    +-- node bin/bgsd-tools.cjs verify:assertions list --req REQ-01
    |     --> JSON: acceptance criteria
    |
    +-- spawn bgsd-planner agent
    |     --> Writes PLAN.md files
    +-- spawn bgsd-plan-checker agent
          --> Reviews, requests revisions (max 3)

/bgsd-execute-phase 1
    |
    v
execute-phase.md workflow
    |
    +-- node bin/bgsd-tools.cjs init:execute-phase 1 --raw
    |     --> JSON: all context
    +-- node bin/bgsd-tools.cjs verify:validate-dependencies 1
    |     --> JSON: dependency validation
    +-- node bin/bgsd-tools.cjs util:phase-plan-index 1
    |     --> JSON: plan waves and ordering
    |
    +-- For each wave:
    |     +-- spawn bgsd-executor agents
    |     |     --> Implement code, commit per-task
    |     +-- node bin/bgsd-tools.cjs verify:state advance-plan
    |     +-- node bin/bgsd-tools.cjs verify:state record-metric
    |
    +-- spawn bgsd-verifier agent
    |     --> Creates VERIFICATION.md
    +-- node bin/bgsd-tools.cjs plan:phase complete 1
```

### Init System (Context Injection)

The `init:*` command family is bGSD's context injection system. Each workflow calls its corresponding `init` subcommand to get all necessary context in one JSON payload:

```bash
node bin/bgsd-tools.cjs init:execute-phase 1 --raw
```

Returns compound JSON with:
- Current state (from STATE.md)
- Roadmap data (from ROADMAP.md)
- Phase plans (from disk)
- Configuration (from config.json)
- Codebase intelligence (from codebase-intel.json)
- Memory (from memory stores)
- Session continuity

---

## Design Patterns Used

### 1. Two-Layer Architecture
Separation of deterministic CLI operations from AI-driven workflow execution. The CLI never calls AI models; workflows never directly manipulate files.

### 2. Lazy Loading
Command modules are loaded on first use via factory functions:
```javascript
function lazyState() { return _modules.state || (_modules.state = require('./commands/state')); }
```

### 3. File-Based Communication
Agents communicate exclusively through files (PLAN.md in, SUMMARY.md out), not shared memory or conversation history. This enables session resumption and parallel execution.

### 4. Context Injection
Instead of agents reading files, the CLI pre-loads all context and passes it as JSON. This reduces token usage and ensures deterministic data.

### 5. Wave-Based Parallel Execution
Plans are grouped into dependency waves. Independent plans within a wave execute concurrently via parallel agent spawning.

### 6. Trajectory Engineering
Git-branch-per-attempt pattern with checkpoint journals for tracking alternative approaches:
- `trajectory checkpoint` — Create named checkpoint
- `trajectory pivot` — Abandon and rewind
- `trajectory compare` — Compare metrics across attempts
- `trajectory choose` — Select winner, archive rest

### 7. SQLite-First Data Layer
Primary data store at `.planning/.cache.db` with:
- Write-through consistency
- WAL mode for concurrent access
- Map fallback for older Node versions
- L1/L2 caching (in-memory + SQLite)

### 8. Safe Hook Pattern
All plugin hooks wrapped with retry, timeout, circuit breaker:
```javascript
export function safeHook(name, fn) {
  return async (input, output) => {
    try {
      // Timeout, retry, circuit breaker logic
    } catch (error) {
      // Correlation-ID logging
    }
  };
}
```

### 9. Model Profile Resolution
Deterministic model selection without LLM involvement:
```javascript
config.model_settings.default_profile
  --> config.model_settings.profiles[profile]
  --> config.model_settings.agent_overrides[agent] (optional)
```

### 10. Skill Reference Pattern
Reusable behavior referenced via `<skill:skill-name />` markup in workflows and agents. Skills are validated at build time and checked for broken references at deploy time.

---

## Build System

**esbuild** bundles all `src/` into a single `bin/bgsd-tools.cjs`:
- Tree-shaking enabled
- Minification enabled
- Zero runtime dependencies in bundle
- Separate ESM build for `plugin.js`

**Build validation:**
- ESM output has zero `require()` calls
- All critical exports verified present
- Tool registration validated
- Bundle size budget enforced (1550KB)
- Artifact validation checks planning files

**Deploy process (`deploy.sh`):**
1. Build from source
2. Backup current installation
3. Manifest-based file sync
4. Copy plugin to OpenCode plugin directory
5. Substitute path placeholders
6. Smoke test deployed artifact
7. Validate skill references
