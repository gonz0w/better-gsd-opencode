# bGSD (Get Stuff Done) — AI Project Planning for OpenCode

A structured project planning and execution system for [OpenCode](https://github.com/opencode-ai/opencode). GSD turns AI-assisted coding from ad-hoc prompting into milestone-driven development with planning, execution, verification, and memory that persists across sessions.

**348 tests** | **Zero runtime dependencies** | **32 slash commands** | **100+ CLI operations** | **11 specialized AI agents**

---

## The Problem

AI coding assistants are powerful but chaotic. Without structure, you get:
- Lost context between sessions
- No traceability from requirements to code
- No verification that what was built matches what was asked for
- No way to pause, resume, or hand off work
- No learning from past decisions

## The Solution

GSD provides a complete project lifecycle inside your AI editor:

```
Idea  -->  Requirements  -->  Roadmap  -->  Plans  -->  Execution  -->  Verification
  |                                                                         |
  +--  Intent tracking, session memory, quality gates, progress metrics  ---+
```

Every step produces structured documents in `.planning/` that agents read for context. Decisions persist. Progress is tracked. Quality is measured.

---

## Quick Start

```bash
clone this repo, run deploy.sh (we are in dev mode, no npx plugin yet)
```

Then in OpenCode:

```
/gsd-new-project
```

That's it. GSD walks you through everything: what you want to build, how to break it down, and then executes it phase by phase.

See the **[Getting Started Guide](docs/getting-started.md)** for the full walkthrough, or the **[Expert Guide](docs/expert-guide.md)** if you want full control.

---

## How It Works

### Two Flows

**Easy Flow** — Let GSD drive. Answer questions, approve plans, watch execution:

```
/gsd-new-project           # Answer "what do you want to build?"
                            # GSD creates requirements, roadmap, phases
/gsd-plan-phase 1           # GSD creates executable plans for phase 1
/gsd-execute-phase 1        # GSD builds it, commits per-task, verifies
/gsd-progress               # See where things stand, get routed to next action
```

**Expert Flow** — Control every decision. Research domains, discuss assumptions, tune agents:

```
/gsd-map-codebase                       # Analyze existing code first (brownfield)
/gsd-new-project                        # Full questioning + parallel research
/gsd-discuss-phase 1                    # Lock down implementation decisions
/gsd-list-phase-assumptions 1           # See what the AI assumes before planning
/gsd-research-phase 1                   # Deep domain research
/gsd-plan-phase 1 --research            # Plan with integrated research
/gsd-execute-phase 1                    # Execute with wave parallelism
/gsd-verify-work 1                      # Manual UAT testing
/gsd-audit-milestone                    # Cross-phase integration check
```

### What Gets Created

```
.planning/
  PROJECT.md              # What this project is, core decisions
  INTENT.md               # Why it exists, desired outcomes, success criteria
  REQUIREMENTS.md         # Checkable requirements with IDs (REQ-01, REQ-02...)
  ROADMAP.md              # Phases with goals, dependencies, progress
  STATE.md                # Living memory: position, metrics, decisions, blockers
  config.json             # Workflow settings, model profiles, gates

  phases/
    01-setup/
      01-01-PLAN.md       # Executable plan with tasks, dependencies, waves
      01-01-SUMMARY.md    # What was built, decisions made, files changed
      01-02-PLAN.md       # Next plan in this phase
      01-02-SUMMARY.md
      01-VERIFICATION.md  # Phase goal verification report

  research/               # Domain research (optional)
  codebase/               # Codebase analysis documents (brownfield)
  memory/                 # Persistent stores (decisions, bookmarks, lessons)
  todos/                  # Captured ideas and tasks
  debug/                  # Debug session state files
  quick/                  # Quick task plans and summaries
```

---

## Core Commands

### Project Lifecycle

| Command | What It Does |
|---------|-------------|
| `/gsd-new-project` | Initialize project: questioning, requirements, roadmap |
| `/gsd-map-codebase` | Analyze existing codebase (brownfield projects) |
| `/gsd-plan-phase [N]` | Create executable plans for a phase |
| `/gsd-execute-phase N` | Execute all plans in a phase |
| `/gsd-progress` | View progress, get routed to next action |
| `/gsd-verify-work [N]` | Manual UAT testing with gap tracking |
| `/gsd-new-milestone` | Start next milestone cycle |
| `/gsd-complete-milestone` | Archive completed milestone |

### Session Management

| Command | What It Does |
|---------|-------------|
| `/gsd-resume-work` | Restore context from previous session |
| `/gsd-pause-work` | Create handoff file for later |
| `/gsd-quick` | Execute small tasks with GSD guarantees |
| `/gsd-debug` | Systematic debugging with persistent state |

### Configuration

| Command | What It Does |
|---------|-------------|
| `/gsd-settings` | Interactive workflow configuration |
| `/gsd-set-profile [quality\|balanced\|budget]` | Switch AI model tier |
| `/gsd-health` | Check `.planning/` integrity |
| `/gsd-update` | Update GSD to latest version |

See the **[Full Command Reference](docs/commands.md)** for all 32 commands with options and examples.

---

## Key Features

### 11 Specialized AI Agents

GSD doesn't use one generic agent for everything. Each task gets a purpose-built agent:

| Agent | Role |
|-------|------|
| **gsd-planner** | Creates executable plans with task breakdown, dependencies, waves |
| **gsd-executor** | Implements code, runs tests, commits per-task |
| **gsd-verifier** | Verifies phase goals were actually achieved (not just tasks completed) |
| **gsd-debugger** | Systematic debugging with hypothesis testing |
| **gsd-phase-researcher** | Researches implementation approaches for a phase |
| **gsd-project-researcher** | Parallel domain research (stack, features, architecture, pitfalls) |
| **gsd-roadmapper** | Creates phased roadmaps from requirements |
| **gsd-plan-checker** | Reviews plan quality with revision loop |
| **gsd-codebase-mapper** | Parallel codebase analysis (4 agents, 7 documents) |
| **gsd-integration-checker** | Cross-phase wiring verification |
| **gsd-research-synthesizer** | Merges parallel research outputs |

### Model Profiles

Control cost vs quality with three profiles:

| Profile | Planning | Execution | Verification |
|---------|----------|-----------|-------------|
| **quality** | Opus | Opus | Sonnet |
| **balanced** (default) | Opus | Sonnet | Sonnet |
| **budget** | Sonnet | Sonnet | Haiku |

```
/gsd-set-profile budget    # Switch to budget mode
```

Override individual agents in `.planning/config.json`:
```json
{
  "model_profile": "balanced",
  "model_profiles": {
    "gsd-executor": "opus"
  }
}
```

### Wave-Based Parallel Execution

Plans within a phase are organized into dependency waves. Independent plans execute in parallel:

```
Wave 1: [Plan 01-01] [Plan 01-02]    # No dependencies, run parallel
Wave 2: [Plan 01-03]                   # Depends on 01-01, waits
Wave 3: [Plan 01-04] [Plan 01-05]    # Depend on 01-03, run parallel
```

### Quality Gates

- **Test gating** — Plans fail if tests fail
- **Requirement verification** — Track REQ-01 through plans to files on disk
- **Regression detection** — Compare test results before/after changes
- **Quality scoring** — A-F grades across 4 dimensions with trend tracking
- **Intent drift** — Numeric score (0-100) measuring alignment with project goals

### Session Memory

Decisions, lessons, and bookmarks persist across `/clear` and session restarts:

```
/gsd-search-decisions "database choice"   # Find past decisions
/gsd-search-lessons "auth"                # Find lessons learned
/gsd-velocity                             # Plans/day, completion forecast
```

### Git Integration

- Per-task atomic commits during execution
- Session diffs showing what happened since last activity
- Rollback info with exact revert commands
- Optional branch-per-phase or branch-per-milestone strategies

---

## Configuration

GSD is configured through `.planning/config.json`:

| Setting | Default | Options |
|---------|---------|---------|
| `model_profile` | `"balanced"` | `"quality"`, `"balanced"`, `"budget"` |
| `mode` | `"interactive"` | `"interactive"` (confirms), `"yolo"` (auto-approves) |
| `commit_docs` | `true` | Auto-commit planning documents |
| `research` | `true` | Enable research phase before planning |
| `plan_checker` | `true` | Enable plan quality review |
| `verifier` | `true` | Enable phase verification |
| `parallelization` | `true` | Parallel plan execution within waves |
| `test_gate` | `true` | Block on test failure |
| `branching_strategy` | `"none"` | `"none"`, `"phase"`, `"milestone"` |
| `brave_search` | `false` | Enable web search in research |

Interactive configuration: `/gsd-settings`

---

## Documentation

| Guide | Description |
|-------|-------------|
| **[Getting Started](docs/getting-started.md)** | First project walkthrough, easy flow, minimal decisions |
| **[Expert Guide](docs/expert-guide.md)** | Full control flow, all options, advanced patterns |
| **[Command Reference](docs/commands.md)** | Every command with arguments, options, and examples |
| **[Architecture](docs/architecture.md)** | How GSD works internally, agent system, tool design |

---

## Development

```bash
# Clone
git clone https://github.com/gonz0w/gsd-opencode.git
cd gsd-opencode

# Install & build
npm install
npm run build

# Run tests (node:test, 348 tests)
npm test

# Test a specific command
node bin/gsd-tools.cjs state validate --raw

# Deploy to live OpenCode config
./deploy.sh
```

### Source Architecture

```
src/
  index.js                 # Entry point
  router.js                # Command routing, global flags
  commands/
    init.js                # 13 init subcommands (context injection for workflows)
    intent.js              # Intent CRUD, tracing, drift scoring
    state.js               # State management, validation, snapshots
    phase.js               # Phase lifecycle, plan indexing
    roadmap.js             # Roadmap parsing, requirement tracking
    verify.js              # Quality gates, plan analysis
    memory.js              # Persistent memory stores
    features.js            # Test coverage, token budgets, MCP
    misc.js                # Velocity, search, impact, rollback
    worktree.js            # Git worktree isolation
    codebase.js            # Codebase intelligence
    env.js                 # Environment detection
  lib/
    config.js              # Config loading, migration, schema validation
    constants.js           # Command help, schemas, model profiles
    context.js             # Token estimation (tokenx)
    frontmatter.js         # YAML frontmatter parsing
    git.js                 # Git operations
    helpers.js             # File I/O, caching, paths
    output.js              # JSON formatting, field filtering
```

Built with esbuild into a single `bin/gsd-tools.cjs` file (zero runtime dependencies). Workflows are markdown files that agents follow as step-by-step prompts, calling gsd-tools for structured data.

## Requirements

- Node.js >= 18
- [OpenCode](https://github.com/opencode-ai/opencode) installed and configured

## License

MIT
