# bGSD Directory Structure

This document describes the directory structure, key files, and organization patterns of the bGSD codebase.

---

## Root Directory Overview

```
bgsd-oc/                      # Project root (bGSD plugin workspace)
├── bin/                      # Built CLI artifact and manifest
├── src/                      # Source modules (built into bin/bgsd-tools.cjs)
├── commands/                  # Slash command wrappers (deployed to host editor)
├── workflows/                 # Workflow definitions (invoked by commands)
├── templates/                 # Document templates (PLAN.md, STATE.md, etc.)
├── agents/                    # Agent definitions (deployed to host editor)
├── skills/                    # Reusable skill modules
├── docs/                      # User-facing documentation
├── tests/                     # Test suite (1,500+ tests)
├── scripts/                   # Utility scripts
├── .planning/                 # Plugin's own planning directory
├── build.cjs                  # Build script (esbuild bundler)
├── plugin.js                  # Built ESM plugin (OpenCode integration)
├── install.js                 # End-user installer
├── deploy.sh                  # Deploy to live OpenCode config
├── package.json               # Node.js package manifest
├── AGENTS.md                  # Agent system documentation
├── README.md                  # Project overview
└── VERSION                    # Semantic version file
```

---

## `bin/` Directory

**Purpose:** Built CLI artifact and deployment manifest.

| File | Purpose |
|------|---------|
| `bgsd-tools.cjs` | Single-file CLI bundle (built from `src/` via esbuild) |
| `manifest.json` | List of all deployable files with paths |

**Key characteristics:**
- `bgsd-tools.cjs` is the only runtime artifact needed
- Shebang: `#!/usr/bin/env node`
- Banner sets `global.BGSD_INCLUDE_BENCHMARKS`
- ~1550KB budget enforced at build time

---

## `src/` Directory

**Purpose:** Source modules that are bundled into `bin/bgsd-tools.cjs`.

### Source Tree

```
src/
├── index.js                  # Entry point (5 lines)
├── router.js                 # Command dispatch (1672 lines)
├── commands/                 # 30 command modules
│   ├── init.js              # 13 init subcommands (2276 lines)
│   ├── state.js             # STATE.md management
│   ├── roadmap.js            # ROADMAP.md operations
│   ├── phase.js              # Phase lifecycle
│   ├── plan.js               # Plan operations
│   ├── verify.js             # Quality gates
│   ├── memory.js             # Memory store operations
│   ├── trajectory.js         # Trajectory engineering
│   ├── intent.js             # INTENT.md CRUD
│   ├── codebase.js           # Codebase intelligence
│   ├── env.js                # Environment detection
│   ├── mcp.js               # MCP server operations
│   ├── workspace.js         # JJ workspace management
│   ├── skills.js            # Skill discovery & security
│   ├── lessons.js           # Lesson analysis pipeline
│   ├── research.js          # Research infrastructure
│   ├── decisions.js         # Decision engine
│   ├── audit.js             # Codebase audit
│   ├── tools.js             # CLI tool integration
│   ├── measure.js           # Measurement & metrics
│   ├── runtime.js           # Runtime detection
│   ├── cache.js             # Cache management
│   ├── agent.js             # Local agent overrides
│   ├── workflow.js          # Workflow invocation
│   ├── scaffold.js          # Project scaffolding
│   ├── questions.js         # Question handling
│   ├── review.js            # Code review
│   ├── security.js          # Security scanning
│   ├── release.js           # Release operations
│   ├── milestone.js         # Milestone lifecycle
│   ├── features.js          # Feature tracking
│   ├── misc.js              # Miscellaneous utilities
│   └── verify/             # Verification subcommands
│       ├── index.js
│       ├── health.js
│       ├── quality.js
│       ├── references.js
│       └── search.js
├── lib/                      # Shared libraries
│   ├── db.js                # SQLite-first data layer (783 lines)
│   ├── cache.js             # L1/L2 caching
│   ├── config.js            # Config loading & validation
│   ├── constants.js         # COMMAND_HELP, CONFIG_SCHEMA
│   ├── output.js            # JSON output formatting
│   ├── format.js            # TTY formatting (colors, tables)
│   ├── helpers.js          # File I/O, path resolution
│   ├── git.js              # Git operations
│   ├── frontmatter.js      # YAML frontmatter parsing
│   ├── ast.js              # Acorn-based AST parsing
│   ├── orchestration.js    # Task classification (528 lines)
│   ├── lifecycle.js        # Lifecycle awareness
│   ├── regex-cache.js      # Compiled regex cache
│   ├── debug.js            # Debug utilities
│   ├── error.js            # Structured error classes
│   ├── wizard.js            # Interactive prompts
│   ├── codebase-intel.js   # Codebase intelligence storage
│   ├── conventions.js     # Convention extraction
│   ├── deps.js             # Dependency graph (Tarjan's SCC)
│   ├── planning-cache.js   # Planning file cache
│   ├── phase-context.js    # Phase context building
│   ├── plan-metadata.js    # Plan metadata extraction
│   ├── json-store-mutator.js  # JSON file mutations
│   ├── commandDiscovery.js # Command discovery
│   ├── command-help.js     # Help text management
│   ├── router-contract.js  # Router validation
│   ├── runtime-capabilities.js  # Runtime detection
│   ├── abort-handler.js    # Abort signal handling
│   ├── adapters/
│   │   └── discovery.js
│   ├── cli-tools/
│   │   ├── bun-runtime.js  # Bun detection
│   │   ├── jq.js           # jq wrapper
│   │   ├── yq.js           # yq wrapper
│   │   └── detect.js       # Tool detection
│   ├── nl/                 # Natural language parsing
│   │   ├── intent-classifier.js
│   │   ├── parameter-extractor.js
│   │   ├── fuzzy-resolver.js
│   │   ├── conversational-planner.js
│   │   ├── suggestion-engine.js
│   │   ├── command-registry.js
│   │   ├── help-fallback.js
│   │   ├── multi-intent-detector.js
│   │   ├── requirement-extractor.js
│   │   └── nl-parser.js
│   ├── review/             # Code review system
│   │   ├── scan.js
│   │   ├── routing.js
│   │   ├── target.js
│   │   ├── diff.js
│   │   ├── readiness.js
│   │   ├── exclusions.js
│   │   ├── config.js
│   │   ├── severity.js
│   │   ├── fixes.js
│   │   ├── rules/
│   │   │   ├── index.js
│   │   │   ├── debug-leftovers.js
│   │   │   ├── trust-boundary.js
│   │   │   └── js-unused-import.js
│   │   └── recovery/
│   ├── reports/
│   │   ├── milestone-summary.js
│   │   └── velocity-metrics.js
│   └── viz/                # Visualization
│       ├── dashboard.js
│       ├── burndown.js
│       ├── sparkline.js
│       ├── progress.js
│       ├── quality.js
│       ├── milestone.js
│       └── index.js
└── plugin/                  # OpenCode plugin (ESM)
    ├── index.js            # Plugin entry point (447 lines)
    ├── project-state.js    # Project state provider
    ├── context-builder.js  # Context injection
    ├── tool-registry.js   # Tool registration
    ├── safe-hook.js       # Hook wrapper with safety
    ├── command-enricher.js # Command context enrichment
    ├── notification.js    # Notification system
    ├── file-watcher.js    # File watching
    ├── idle-validator.js  # Idle-time validation
    ├── stuck-detector.js  # Stuck/loop detection
    ├── advisory-guardrails.js  # Safety warnings
    ├── token-budget.js    # Token budget enforcement
    ├── cmux-*.js         # Cmux integration (9 modules)
    ├── parsers/
    │   ├── state.js
    │   ├── roadmap.js
    │   ├── plan.js
    │   ├── config.js
    │   ├── project.js
    │   ├── intent.js
    │   └── index.js
    ├── tools/
    │   ├── index.js
    │   ├── bgsd-status.js
    │   ├── bgsd-progress.js
    │   ├── bgsd-context.js
    │   ├── bgsd-plan.js
    │   └── bgsd-validate.js
    └── validation/
        ├── adapter.js
        └── flags.js
```

---

## `commands/` Directory

**Purpose:** Slash command wrappers deployed to `~/.config/opencode/commands/`.

Each command is a thin markdown wrapper that routes to the appropriate workflow:

| File | Description |
|------|-------------|
| `bgsd-plan.md` | Canonical planning umbrella (routes phase, discuss, research, gaps, todo) |
| `bgsd-execute-phase.md` | Execute all plans in a phase |
| `bgsd-verify-work.md` | Verify phase goals achieved |
| `bgsd-new-project.md` | Create new project |
| `bgsd-new-milestone.md` | Create new milestone |
| `bgsd-quick.md` | Quick task execution |
| `bgsd-github-ci.md` | Autonomous CI quality gate |
| `bgsd-security.md` | Security scanning |
| `bgsd-release.md` | Release operations |
| `bgsd-debug.md` | Debug session management |
| `bgsd-inspect.md` | Inspection tools |
| `bgsd-help.md` | Help system |
| `bgsd-settings.md` | Configuration management |
| `bgsd-resume.md` | Session resumption |
| `bgsd-pause.md` | Session pause |
| `bgsd-complete-milestone.md` | Milestone completion |
| `bgsd-audit-milestone.md` | Milestone auditing |
| `bgsd-cleanup.md` | Cleanup operations |
| `bgsd-test-run.md` | Test execution |
| `bgsd-update.md` | Update check |
| `bgsd-map-codebase.md` | Codebase analysis |

**Command structure:**
```markdown
description: One-line description
---
<objective>
What this command does
</objective>
<execution_context>
How to route and execute
</execution_context>
<process>
Step-by-step routing instructions
</process>
```

---

## `workflows/` Directory

**Purpose:** Step-by-step prompts that AI agents follow.

| Workflow | Purpose |
|----------|---------|
| `plan-phase.md` | Creates PLAN.md from phase context |
| `execute-phase.md` | Wave-based parallel execution |
| `execute-plan.md` | Single plan execution with TDD |
| `verify-work.md` | Verifies phase goals |
| `discuss-phase.md` | Implementation decision gathering |
| `new-project.md` | Project initialization |
| `new-milestone.md` | Milestone initialization |
| `map-codebase.md` | Brownfield analysis |
| `github-ci.md` | CI quality gate |
| `security.md` | Security scanning |
| `release.md` | Release operations |
| `quick.md` | Quick task flow |
| `health.md` | Health checks |
| `cleanup.md` | Cleanup workflow |
| `progress.md` | Progress reporting |
| `debug.md` | Debug session flow |
| `add-phase.md` | Add phase to roadmap |
| `insert-phase.md` | Insert phase into roadmap |
| `remove-phase.md` | Remove phase from roadmap |
| `add-todo.md` | Add todo item |
| `check-todos.md` | Check todo items |
| `list-phase-assumptions.md` | List phase assumptions |
| `plan-milestone-gaps.md` | Plan milestone gaps |
| `complete-milestone.md` | Complete milestone |
| `audit-milestone.md` | Audit milestone |
| `cmd-*.md` | Command-specific workflows |
| `transition.md` | State transitions |

**Workflow structure:**
```markdown
<!-- section: purpose -->
<purpose>
What this workflow accomplishes
</purpose>

<core_principle>
Key design constraint
</core_principle>

<required_reading>
Files to read before starting
</required_reading>

<process>
<!-- section: step_name -->
<step name="step_name" priority="first">
Instructions for this step
</step>
<!-- /section -->
```

---

## `agents/` Directory

**Purpose:** Agent definitions deployed to `~/.config/opencode/agents/`.

| File | Agent | Lines |
|------|-------|-------|
| `bgsd-planner.md` | Creates PLAN.md files | 27,397 |
| `bgsd-executor.md` | Implements plans | 9,941 |
| `bgsd-verifier.md` | Verifies phase goals | 11,823 |
| `bgsd-plan-checker.md` | Reviews plan quality | 15,499 |
| `bgsd-executor.md` | Executes code | 9,941 |
| `bgsd-roadmapper.md` | Creates roadmaps | 13,638 |
| `bgsd-phase-researcher.md` | Phase research | 9,881 |
| `bgsd-project-researcher.md` | Project research | 8,091 |
| `bgsd-debugger.md` | Debug sessions | 16,932 |
| `bgsd-codebase-mapper.md` | Codebase analysis | 17,539 |
| `bgsd-github-ci.md` | CI integration | 7,559 |
| `bgsd-model-diagnostic.md` | Model diagnostics | 555 |

---

## `templates/` Directory

**Purpose:** Document templates for planning files.

### Core Planning Templates
| File | Output | Description |
|------|--------|-------------|
| `project.md` | PROJECT.md | Project definition |
| `intent.md` | INTENT.md | Project north star |
| `requirements.md` | REQUIREMENTS.md | Requirements with IDs |
| `roadmap.md` | ROADMAP.md | Phased development plan |
| `state.md` | STATE.md | Living state tracking |
| `milestone.md` | MILESTONE-*.md | Milestone template |
| `assertions.md` | ASSERTIONS.md | Acceptance criteria |

### Phase Execution Templates
| File | Output | Description |
|------|--------|-------------|
| `summary.md` | SUMMARY.md | Full execution summary |
| `summary-standard.md` | SUMMARY.md | Standard variant |
| `summary-minimal.md` | SUMMARY.md | Minimal variant |
| `summary-complex.md` | SUMMARY.md | Complex variant |
| `verification-report.md` | VERIFICATION.md | Phase verification |
| `plans/execute.md` | PLAN.md | Standard plan |
| `plans/tdd.md` | PLAN.md | TDD plan |
| `plans/discovery.md` | PLAN.md | Discovery plan |

### Research Templates
| File | Output | Description |
|------|--------|-------------|
| `research.md` | RESEARCH.md | Phase research |
| `context.md` | CONTEXT.md | Discussion context |
| `discovery.md` | DISCOVERY.md | Discovery output |

### Codebase Analysis Templates
| File | Output | Description |
|------|--------|-------------|
| `codebase/stack.md` | STACK.md | Technology stack |
| `codebase/architecture.md` | ARCHITECTURE.md | Module structure |
| `codebase/structure.md` | STRUCTURE.md | Directory organization |
| `codebase/conventions.md` | CONVENTIONS.md | Coding standards |
| `codebase/testing.md` | TESTING.md | Test strategy |
| `codebase/integrations.md` | INTEGRATIONS.md | External services |

### Project Research Templates
| File | Output | Description |
|------|--------|-------------|
| `research-project/STACK.md` | STACK.md | Stack research |
| `research-project/ARCHITECTURE.md` | ARCHITECTURE.md | Architecture research |
| `research-project/FEATURES.md` | FEATURES.md | Feature analysis |
| `research-project/PITFALLS.md` | PITFALLS.md | Risk areas |
| `research-project/SUMMARY.md` | SUMMARY.md | Research summary |

### Other Templates
| File | Output | Description |
|------|--------|-------------|
| `config.json` | config.json | Default config |
| `config-full.json` | config.json | Full config |
| `DEBUG.md` | DEBUG.md | Debug template |
| `continue-here.md` | continue-here.md | Continuation prompt |
| `UAT.md` | UAT.md | User acceptance testing |
| `milestone-archive.md` | Archive | Milestone archive format |
| `MILESTONE-INTENT.md` | MILESTONE-INTENT.md | Milestone intent |

---

## `skills/` Directory

**Purpose:** Reusable skill modules referenced by workflows and agents.

**Structure:** Each skill is a directory containing a `SKILL.md` file.

| Skill Directory | Purpose |
|----------------|---------|
| `bgsd-context-init` | Context initialization |
| `checkpoint-protocol` | Checkpoint handling |
| `commit-protocol` | Commit conventions |
| `continuation-format` | Continuation prompts |
| `tdd-execution` | TDD methodology |
| `git-integration` | Git operations |
| `planner-task-breakdown` | Task decomposition |
| `planner-dependency-graph` | Dependency handling |
| `planner-scope-estimation` | Scope estimation |
| `planner-gap-closure` | Gap closure |
| `planner-checkpoints` | Checkpoint types |
| `verification-reference` | Verification patterns |
| `research-pipeline` | Research workflow |
| `research-patterns` | Research techniques |
| `model-profiles` | Model selection |
| `decision-conflict-questioning` | Decision handling |
| `deviation-rules` | Deviation detection |
| `executor-continuation` | Execution continuation |
| `debugger-investigation` | Debug investigation |
| `debugger-hypothesis-testing` | Hypothesis testing |
| `debugger-research-reasoning` | Debug reasoning |
| `debugger-verification` | Debug verification |
| `goal-backward` | Backward goal planning |
| `questioning` | Question techniques |
| `raci` | Responsibility matrix |
| `state-update-protocol` | State updates |
| `structured-returns` | Return value patterns |
| `ci-quality-gate` | CI quality gate |
| `automation-reference` | Automation reference |
| `phase-argument-parsing` | Phase argument parsing |
| `project-context` | Project context |
| `skill-index` | Auto-generated skill index |

---

## `docs/` Directory

**Purpose:** User-facing documentation.

| File | Description |
|------|-------------|
| `architecture.md` | System architecture |
| `agents.md` | Agent system |
| `planning-system.md` | .planning/ structure |
| `configuration.md` | Configuration reference |
| `commands.md` | Command reference |
| `getting-started.md` | First project walkthrough |
| `expert-guide.md` | Advanced patterns |
| `tdd.md` | TDD guide |
| `milestones.md` | Milestone management |
| `research.md` | Research system |
| `troubleshooting.md` | Common issues |

---

## `tests/` Directory

**Purpose:** Test suite (1,500+ tests).

| Test File | Coverage |
|-----------|----------|
| `state.test.cjs` | STATE.md operations |
| `plan.test.cjs` | PLAN.md operations |
| `verify.test.cjs` | Verification system |
| `init.test.cjs` | Init commands |
| `codebase.test.cjs` | Codebase analysis |
| `memory.test.cjs` | Memory stores |
| `intent.test.cjs` | INTENT.md operations |
| `worktree.test.cjs` | Git worktree |
| `trajectory.test.cjs` | Trajectory engineering |
| `security.test.cjs` | Security scanning |
| `release.test.cjs` | Release operations |
| `plugin.test.cjs` | Plugin system |
| `orchestration.test.cjs` | Task orchestration |
| `integration.test.cjs` | Full workflows |
| `guidance-*.test.cjs` | Guidance validation (40+ files) |

**Test runner:**
```bash
npm test                    # Full suite (8 concurrency)
npm run test:fast           # Core tests only
npm run test:slow           # Slower integration tests
npm run test:file <file>    # Single file
```

---

## `.planning/` Directory

**Purpose:** Plugin's own planning directory (self-hosting).

```
.planning/
├── ROADMAP.md              # Development roadmap
├── STATE.md                # Current development state
├── PROJECT.md              # Plugin project definition
├── INTENT.md               # Plugin intent
├── REQUIREMENTS.md         # Plugin requirements
├── MILESTONES.md           # Milestone tracking
├── config.json             # Plugin config
├── phases/                 # Development phases
├── milestones/             # Archived milestones
├── memory/                 # Plugin memory stores
├── research/               # Plugin research
├── codebase/               # Plugin codebase analysis
├── baselines/              # Performance baselines
├── phase-handoffs/         # Phase handoff artifacts
├── .cache.db               # SQLite cache
└── archive/                # Archive directory
```

---

## Key File Purposes

### Build & Deploy
| File | Purpose |
|------|---------|
| `build.cjs` | esbuild bundler, validates output, generates manifest |
| `deploy.sh` | Deploys to OpenCode config, validates skill references |
| `install.js` | End-user installer |
| `package.json` | Node.js package manifest with scripts |

### Configuration
| File | Purpose |
|------|---------|
| `AGENTS.md` | Agent system documentation (source for docs) |
| `README.md` | Project overview |
| `VERSION` | Semantic version |
| `.gitignore` | Git exclusions |
| `eslint.config.cjs` | Linting rules |

### Utilities
| File | Purpose |
|------|---------|
| `audit-exports.cjs` | Export auditing |
| `audit-commands.cjs` | Command auditing |
| `baseline.cjs` | Performance baseline generation |
| `test-commands.cjs` | Command testing |
| `benchmark-compile-cache.cjs` | Compile cache benchmarking |

---

## File Organization Patterns

### 1. Commands Pattern
- **Location:** `commands/*.md`
- **Format:** Markdown with `<objective>`, `<execution_context>`, `<process>` sections
- **Deployment:** Copied to `~/.config/opencode/commands/`

### 2. Workflow Pattern
- **Location:** `workflows/*.md`
- **Format:** Markdown with `<purpose>`, `<core_principle>`, `<required_reading>`, `<process>` sections
- **Invocation:** Loaded via Read tool from `__OPENCODE_CONFIG__` path

### 3. Agent Pattern
- **Location:** `agents/*.md`
- **Format:** Markdown with YAML frontmatter (name, description, type, agents)
- **Deployment:** Copied to `~/.config/opencode/agents/`

### 4. Skill Pattern
- **Location:** `skills/<skill-name>/SKILL.md`
- **Format:** Markdown with YAML frontmatter (name, description, type, sections)
- **Reference:** `<skill:skill-name />` markup

### 5. Template Pattern
- **Location:** `templates/*.md` or `templates/codebase/*.md`
- **Format:** Markdown document templates
- **Usage:** Copied and filled by workflows

### 6. Test Pattern
- **Location:** `tests/*.test.cjs`
- **Format:** Node.js test files using `node:test`
- **Naming:** `*.test.cjs` suffix

---

## Important Configuration Files

### `.planning/config.json`
```json
{
  "model_settings": {
    "default_profile": "balanced",
    "profiles": {
      "quality": { "model": "gpt-5.4" },
      "balanced": { "model": "gpt-5.4-mini" },
      "budget": { "model": "gpt-5.4-nano" }
    },
    "agent_overrides": {}
  },
  "commit_docs": true,
  "parallelization": true,
  "research": true,
  "verifier": true,
  "plan_checker": true,
  "branching_strategy": "none",
  "test_gate": true
}
```

### `bin/manifest.json`
Auto-generated list of all deployable files:
```json
{
  "generated": "2026-04-06T...",
  "files": [
    "bin/bgsd-tools.cjs",
    "commands/bgsd-*.md",
    "workflows/*.md",
    "templates/**/*.md",
    "agents/bgsd-*.md",
    "skills/*/SKILL.md",
    "plugin.js",
    "VERSION"
  ]
}
```

---

## Deployment Structure

When deployed to OpenCode, files go to:

| Source | Destination |
|--------|-------------|
| `bin/bgsd-tools.cjs` | `~/.config/opencode/bgsd-oc/bin/` |
| `commands/*.md` | `~/.config/opencode/commands/` |
| `workflows/*.md` | `~/.config/opencode/bgsd-oc/workflows/` |
| `templates/**/*` | `~/.config/opencode/bgsd-oc/templates/` |
| `agents/*.md` | `~/.config/opencode/agents/` |
| `skills/*/` | `~/.config/opencode/skills/` |
| `plugin.js` | `~/.config/opencode/plugin/bgsd.js` |
| `VERSION` | `~/.config/opencode/bgsd-oc/VERSION` |

Path placeholders (`__OPENCODE_CONFIG__`) in workflows and commands are substituted with the actual OpenCode config path during deploy.
