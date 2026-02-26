# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
gsd-opencode/
├── bin/                    # Built artifact (gitignored bundle)
│   ├── gsd-tools.cjs      # Single-file CJS bundle (~16,400 lines, built by esbuild)
│   └── gsd-tools.test.cjs # Test suite for CLI commands
├── src/                    # Source code (modular, pre-bundle)
│   ├── index.js            # Entry point (5 lines — requires router, calls main)
│   ├── router.js           # CLI argument parsing + command dispatch (776 lines)
│   ├── commands/           # Command handler modules (13 files)
│   └── lib/                # Shared library modules (11 files)
├── workflows/              # Markdown workflow definitions for agents (44 files)
├── templates/              # Document scaffolds and subagent prompts (28 entries)
│   ├── codebase/           # Codebase analysis document templates (7 files)
│   ├── plans/              # Plan type templates: discovery, execute, tdd (3 files)
│   └── research-project/   # Research output templates (5 files)
├── references/             # Domain knowledge docs loaded on-demand (13 files)
├── .planning/              # GSD's own planning artifacts (self-managed)
│   ├── config.json         # Project configuration
│   ├── STATE.md            # Current project state
│   ├── ROADMAP.md          # Phase roadmap with milestones
│   ├── REQUIREMENTS.md     # Structured requirements
│   ├── INTENT.md           # Project intent document
│   ├── MILESTONES.md       # Milestone archive summary
│   ├── PROJECT.md          # Project description
│   ├── baselines/          # Performance baselines (bundle size, context budgets)
│   ├── codebase/           # Codebase analysis outputs (this directory)
│   ├── memory/             # Persistent memory stores (JSON)
│   ├── milestones/         # Archived milestone data (v1.0, v4.0 phase dirs + roadmaps)
│   ├── phases/             # Active phase directories (06 through 29)
│   ├── quick/              # Quick task plans
│   └── research/           # Research output documents
├── AGENTS.md               # Developer workspace instructions (for AI agents)
├── README.md               # Project README
├── VERSION                 # Semantic version (1.20.5)
├── build.js                # esbuild bundler script with smoke test + size tracking
├── deploy.sh               # Build + deploy to ~/.config/opencode/get-shit-done/
├── package.json            # NPM manifest (private, node>=18)
└── .gitignore              # Ignores node_modules/ and bin/gsd-tools.cjs
```

## Directory Purposes

**`src/`:**
- Purpose: All JavaScript source code, organized into modular files
- Contains: Entry point, router, 13 command modules, 11 library modules
- Key files: `src/index.js` (entry), `src/router.js` (dispatch), `src/commands/init.js` (compound context commands)
- Total: ~20,150 lines of source code

**`src/commands/`:**
- Purpose: CLI command handler implementations — each module groups related subcommands
- Contains: 13 `.js` files, each exporting named command handler functions
- Key files: `src/commands/init.js` (workflow context aggregation), `src/commands/verify.js` (quality gates), `src/commands/features.js` (utility commands)
- Naming: lowercase singular nouns matching the command domain (e.g., `state.js` → `gsd-tools state ...`)

**`src/lib/`:**
- Purpose: Shared utilities, parsers, and core abstractions used by command modules
- Contains: 11 `.js` files providing pure-function utilities and cached operations
- Key files: `src/lib/helpers.js` (phase tree, file caching, milestone detection), `src/lib/constants.js` (schemas, help text), `src/lib/frontmatter.js` (YAML parsing)
- Naming: lowercase descriptive nouns (e.g., `config.js`, `git.js`, `output.js`)

**`bin/`:**
- Purpose: Built artifacts — the single-file CLI bundle
- Contains: `gsd-tools.cjs` (esbuild output, gitignored), `gsd-tools.test.cjs` (test suite, committed)
- Generated: Yes — by `build.js`
- Committed: Test file only; the bundle is gitignored

**`workflows/`:**
- Purpose: Markdown workflow definitions that LLM agents follow as step-by-step instructions
- Contains: 44 `.md` files (~8,500 lines total) defining agent behavior
- Key files: `workflows/execute-phase.md` (main execution orchestrator), `workflows/execute-plan.md` (plan execution subagent), `workflows/plan-phase.md` (planning workflow), `workflows/new-project.md` (project init), `workflows/map-codebase.md` (codebase analysis)
- Naming: `kebab-case.md` — action-oriented names matching slash commands (e.g., `execute-phase.md` → `/gsd-execute-phase`); `cmd-*.md` for utility command wrappers

**`templates/`:**
- Purpose: Document scaffolds for all planning artifacts created during workflows
- Contains: 28 entries — markdown templates for plans, summaries, state, requirements, roadmaps, subagent prompts
- Key files: `templates/phase-prompt.md` (569 lines — main PLAN.md template), `templates/research.md` (602 lines), `templates/state.md`, `templates/roadmap.md`
- Subdirectories:
  - `templates/codebase/` — 7 codebase analysis templates (architecture, stack, conventions, testing, etc.)
  - `templates/plans/` — Plan type variants (discovery, execute, tdd)
  - `templates/research-project/` — Research phase output templates (5 files)

**`references/`:**
- Purpose: Detailed domain knowledge documents loaded by agents on-demand via `gsd-tools extract-sections`
- Contains: 13 `.md` files covering checkpoints, git integration, model profiles, verification patterns, TDD
- Key files: `references/checkpoints.md` (782 lines — checkpoint types and behaviors), `references/git-integration.md`, `references/verification-patterns.md`
- Naming: `kebab-case.md` describing the domain topic

**`.planning/`:**
- Purpose: GSD's own project planning artifacts — dogfooding the system
- Contains: Config, state, roadmap, requirements, intent, milestones, phases, memory, baselines, codebase analysis
- Committed: Most files committed; `.planning/.gitignore` excludes `env-manifest.json` and `.cache/`
- Key files: `.planning/config.json`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/INTENT.md`

**`.planning/phases/`:**
- Purpose: Active phase directories containing PLAN.md and SUMMARY.md files
- Contains: Directories named `{NN}-{slug}/` (e.g., `06-token-measurement-output-infrastructure/`)
- Each phase contains: `{NN}-{MM}-PLAN.md`, `{NN}-{MM}-SUMMARY.md`, optional `{NN}-CONTEXT.md`, `{NN}-VERIFICATION.md`, `{NN}-RESEARCH.md`

**`.planning/milestones/`:**
- Purpose: Archived milestone data (completed phases + per-milestone roadmaps/requirements)
- Contains: `v{X.Y}-ROADMAP.md`, `v{X.Y}-REQUIREMENTS.md`, `v{X.Y}-phases/` directories with archived phase dirs
- Example: `.planning/milestones/v1.0-phases/01-foundation-safety-nets/`

**`.planning/memory/`:**
- Purpose: Persistent JSON-based memory stores for session continuity
- Contains: `bookmarks.json` (and potentially `decisions.json`, `lessons.json`, `todos.json`)

**`.planning/baselines/`:**
- Purpose: Performance tracking — bundle sizes and context budget baselines
- Contains: `bundle-size.json`, `baseline-*.json` files with timestamps

## Key File Locations

**Entry Points:**
- `src/index.js`: CLI entry point — requires router, calls `main()`
- `src/router.js`: Command dispatch — parses args, routes to lazy-loaded command modules
- `build.js`: Build entry — esbuild config, smoke test, size tracking
- `deploy.sh`: Deploy entry — build → backup → copy → smoke test

**Configuration:**
- `package.json`: NPM manifest (node>=18, private, scripts: test/build)
- `.planning/config.json`: Runtime config (mode, depth, parallelization, model_profile, workflow toggles)
- `src/lib/constants.js`: CONFIG_SCHEMA (single source of truth for all config keys)
- `src/lib/constants.js`: MODEL_PROFILES (agent-to-model mapping by profile tier)
- `src/lib/constants.js`: COMMAND_HELP (help text for every CLI command)

**Core Logic:**
- `src/lib/helpers.js`: Phase tree scanning, file caching, milestone detection, intent parsing
- `src/lib/frontmatter.js`: YAML frontmatter parser (extract, reconstruct, splice)
- `src/lib/output.js`: JSON output, field filtering, tmpfile fallback, error/debug logging
- `src/lib/config.js`: Config loading with schema defaults and nested key resolution
- `src/lib/git.js`: Shell-free git execution
- `src/lib/context.js`: Token estimation and budget checking
- `src/lib/regex-cache.js`: LRU regex cache + pre-compiled patterns
- `src/lib/codebase-intel.js`: Source directory detection, file traversal, language mapping
- `src/lib/conventions.js`: Naming pattern classification, file organization analysis
- `src/lib/deps.js`: Multi-language import parsing and dependency graph building
- `src/lib/lifecycle.js`: Migration/seed/boot lifecycle detection

**Testing:**
- `bin/gsd-tools.test.cjs`: CLI integration tests (Node.js built-in test runner)

## Naming Conventions

**Files:**
- Source modules: `kebab-case.js` (e.g., `codebase-intel.js`, `regex-cache.js`)
- Command modules: `singular-noun.js` matching command name (e.g., `state.js`, `verify.js`, `phase.js`)
- Workflows: `kebab-case.md` with action prefix (e.g., `execute-phase.md`, `plan-phase.md`)
- Utility workflows: `cmd-kebab-case.md` prefix for simple command wrappers (e.g., `cmd-velocity.md`)
- Templates: `kebab-case.md` (e.g., `phase-prompt.md`, `summary-standard.md`)
- References: `kebab-case.md` (e.g., `git-integration.md`, `verification-patterns.md`)

**Directories:**
- Phase directories: `{NN}-{slug}/` (e.g., `06-token-measurement-output-infrastructure/`)
- Milestone archives: `v{X.Y}-phases/` (e.g., `v1.0-phases/`)
- Template groups: `singular-noun/` (e.g., `codebase/`, `plans/`)

**Functions:**
- Command handlers: `cmd{PascalCase}` (e.g., `cmdInitExecutePhase`, `cmdStateUpdate`, `cmdVerifyPlanStructure`)
- Internal helpers: `camelCase` (e.g., `findPhaseInternal`, `resolveModelInternal`, `getMilestoneInfo`)
- Lazy loaders: `lazy{PascalCase}` (e.g., `lazyState`, `lazyInit`, `lazyVerify`)

**Planning Documents:**
- Plans: `{NN}-{MM}-PLAN.md` (e.g., `12-03-PLAN.md`)
- Summaries: `{NN}-{MM}-SUMMARY.md` (e.g., `12-03-SUMMARY.md`)
- Context: `{NN}-CONTEXT.md` (e.g., `12-CONTEXT.md`)
- Research: `{NN}-RESEARCH.md` (e.g., `01-RESEARCH.md`)
- Verification: `{NN}-VERIFICATION.md` (e.g., `12-VERIFICATION.md`)

## Where to Add New Code

**New CLI Command:**
1. Add command handler function to appropriate `src/commands/*.js` module (or create new module)
2. If new module: add lazy-loader function in `src/router.js` (line ~12-24)
3. Add switch case in `src/router.js` `main()` function
4. Add COMMAND_HELP entry in `src/lib/constants.js`
5. Add test case in `bin/gsd-tools.test.cjs`
6. Run `npm run build` to bundle

**New Library Module:**
1. Create `src/lib/{name}.js`
2. Export functions via `module.exports`
3. Import from command modules as needed
4. Library modules should be pure utilities — no direct output/exit calls

**New Workflow:**
1. Create `workflows/{name}.md` with XML-structured steps
2. Use `<purpose>`, `<process>`, `<step name="...">` structure
3. Reference gsd-tools commands via `node /path/to/gsd-tools.cjs <command>`
4. If workflow needs init context: add `cmdInit{Name}()` in `src/commands/init.js`

**New Template:**
1. Create `templates/{name}.md` for single templates
2. Create `templates/{category}/{name}.md` for grouped templates
3. Register in `cmdTemplateSelect()` or `cmdTemplateFill()` in `src/commands/misc.js` if needed

**New Reference Doc:**
1. Create `references/{topic}.md`
2. Use `<!-- section: name -->` markers for extractable sections
3. Workflows can load via `gsd-tools extract-sections references/{topic}.md "section-name"`

**New Config Key:**
1. Add entry to `CONFIG_SCHEMA` in `src/lib/constants.js` with type, default, description, aliases, nested path
2. `loadConfig()` automatically picks it up
3. Add `cmdConfigMigrate()` support (automatic — migrates missing keys)

## Special Directories

**`bin/`:**
- Purpose: Built CLI bundle output
- Generated: Yes — by `build.js` via esbuild
- Committed: Only `gsd-tools.test.cjs`; `gsd-tools.cjs` is gitignored (regenerated on build)

**`.planning/`:**
- Purpose: GSD planning artifacts (dogfooding)
- Generated: Mix — some created by gsd-tools commands, some manually
- Committed: Yes, except `env-manifest.json` and `.cache/`

**`.planning/baselines/`:**
- Purpose: Performance tracking data (bundle sizes, context budget baselines)
- Generated: Yes — by `build.js` (bundle-size.json) and `context-budget baseline` command
- Committed: Yes

**`.planning/.cache/`:**
- Purpose: Temporary analysis artifacts
- Generated: Yes
- Committed: No (gitignored)

**`node_modules/`:**
- Purpose: NPM dependencies (esbuild for build, tokenx for token estimation)
- Generated: Yes — by `npm install`
- Committed: No (gitignored)

**`~/.config/opencode/get-shit-done/` (deploy target):**
- Purpose: Production install location for the GSD plugin
- Generated: Yes — by `deploy.sh`
- Committed: N/A (separate from this repo)
- Contains: Copy of `bin/`, `workflows/`, `templates/`, `references/`, `src/`, `VERSION`

---

*Structure analysis: 2026-02-26*
