# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
gsd-opencode/
├── bin/                    # Built artifacts (bundle + tests)
│   ├── gsd-tools.cjs      # Bundled CLI (15,348 lines, esbuild output)
│   └── gsd-tools.test.cjs # Integration test suite (13,040 lines)
├── src/                    # Source code (modular, pre-build)
│   ├── index.js            # Entry point (5 lines)
│   ├── router.js           # Command dispatch + arg parsing (772 lines)
│   ├── commands/           # Command handler modules (13 files)
│   └── lib/                # Shared libraries (10 files)
├── workflows/              # Agent workflow definitions (44 .md files)
├── templates/              # Document templates
│   ├── *.md                # Planning document templates
│   ├── codebase/           # Codebase analysis templates (7 files)
│   ├── plans/              # Plan type templates (3 files)
│   └── research-project/   # Research output templates (5 files)
├── references/             # Agent reference documents (13 .md files)
├── .planning/              # Project's own planning state
│   ├── config.json         # Project configuration
│   ├── STATE.md            # Current project state
│   ├── ROADMAP.md          # Phase tracking
│   ├── REQUIREMENTS.md     # Requirements document
│   ├── INTENT.md           # Project intent document
│   ├── PROJECT.md          # Project description
│   ├── MILESTONES.md       # Milestone history
│   ├── baselines/          # Performance baselines (JSON)
│   ├── codebase/           # Codebase analysis output
│   ├── memory/             # Persistent memory stores (JSON)
│   ├── milestones/         # Archived milestone data
│   ├── phases/             # Active phase directories
│   ├── quick/              # Quick task directories
│   └── research/           # Research output
├── build.js                # esbuild bundler script
├── deploy.sh               # Deploy to ~/.config/opencode/get-shit-done/
├── package.json            # Project manifest
├── AGENTS.md               # Development workspace instructions
├── README.md               # Public documentation
└── VERSION                 # Semantic version (1.20.5)
```

## Directory Purposes

**`src/`:**
- Purpose: All source code, organized by layer
- Contains: JavaScript modules (.js) — CommonJS format (`require`/`module.exports`)
- Key files:
  - `src/index.js`: Entry point — requires router, calls `main()`
  - `src/router.js`: Central dispatch — lazy-loads command modules, routes by command name

**`src/commands/`:**
- Purpose: Command handler implementations, one module per domain
- Contains: 13 .js files, each exporting multiple `cmd*` functions
- Key files:
  - `src/commands/init.js` (1493 lines): Compound context aggregation for workflows
  - `src/commands/verify.js` (1984 lines): All verification/validation commands
  - `src/commands/features.js` (1904 lines): Utility commands (session, budget, search, etc.)
  - `src/commands/intent.js` (1592 lines): INTENT.md lifecycle management
  - `src/commands/misc.js` (1431 lines): Smaller utility commands (commit, scaffold, template, config)
  - `src/commands/env.js` (1177 lines): Environment detection and scanning
  - `src/commands/state.js` (652 lines): STATE.md read/write operations
  - `src/commands/codebase.js` (489 lines): Codebase analysis orchestration
  - `src/commands/phase.js` (901 lines): Phase lifecycle (add, insert, remove, complete)
  - `src/commands/worktree.js` (791 lines): Git worktree management
  - `src/commands/roadmap.js` (295 lines): ROADMAP.md parsing
  - `src/commands/memory.js` (307 lines): Memory store operations
  - `src/commands/mcp.js` (405 lines): MCP server profiling

**`src/lib/`:**
- Purpose: Shared utilities and parsers used across command modules
- Contains: 10 .js files
- Key files:
  - `src/lib/helpers.js` (946 lines): File caching, phase tree, milestone detection, intent parsing
  - `src/lib/constants.js` (1088 lines): Model profiles, config schema, all command help text
  - `src/lib/deps.js` (697 lines): Multi-language import parsing and dependency graph
  - `src/lib/conventions.js` (644 lines): Convention detection and rules generation
  - `src/lib/codebase-intel.js` (529 lines): Source analysis engine
  - `src/lib/frontmatter.js` (166 lines): YAML frontmatter parser (custom, zero-dep)
  - `src/lib/output.js` (113 lines): Output formatting, field filtering, tmpfile handling
  - `src/lib/context.js` (97 lines): Token estimation and budget checking
  - `src/lib/regex-cache.js` (83 lines): LRU regex cache + pre-compiled patterns
  - `src/lib/config.js` (76 lines): Config loading with schema-driven defaults
  - `src/lib/git.js` (29 lines): Shell-free git execution wrapper

**`bin/`:**
- Purpose: Built artifacts — the deployable CLI bundle and its test suite
- Contains: 2 .cjs files
- Key files:
  - `bin/gsd-tools.cjs` (15,348 lines): esbuild bundle of `src/` — the single deployable artifact
  - `bin/gsd-tools.test.cjs` (13,040 lines): Integration tests using `node:test`

**`workflows/`:**
- Purpose: Agent workflow definitions — structured markdown prompts that agents follow
- Contains: 44 .md files (~8,400 lines total)
- Categories:
  - Core workflows: `execute-phase.md`, `plan-phase.md`, `new-project.md`, `new-milestone.md`
  - Lifecycle workflows: `progress.md`, `resume-project.md`, `pause-work.md`, `complete-milestone.md`
  - Phase operations: `add-phase.md`, `insert-phase.md`, `remove-phase.md`, `verify-phase.md`
  - Utility commands: `cmd-*.md` (11 files — thin wrappers for CLI features)
  - Discovery/research: `discovery-phase.md`, `discuss-phase.md`, `research-phase.md`
  - Admin: `settings.md`, `health.md`, `help.md`, `cleanup.md`, `update.md`
  - Codebase: `map-codebase.md`

**`templates/`:**
- Purpose: Document scaffolds for all planning artifacts
- Contains: 24 root .md files + 3 subdirectories with 15 more files
- Key files:
  - `templates/state.md`: STATE.md template
  - `templates/roadmap.md`: ROADMAP.md template
  - `templates/requirements.md`: REQUIREMENTS.md template
  - `templates/intent.md`: INTENT.md template
  - `templates/phase-prompt.md` (569 lines): Full plan execution prompt template
  - `templates/summary.md` (248 lines): SUMMARY.md template with sections
  - `templates/verification-report.md` (322 lines): Phase verification report
  - `templates/research.md` (602 lines): Research phase template
  - `templates/plans/execute.md`: Standard plan template
  - `templates/plans/tdd.md`: TDD-focused plan template
  - `templates/plans/discovery.md`: Discovery plan template
  - `templates/codebase/*.md` (7 files): Templates for codebase analysis docs

**`references/`:**
- Purpose: Shared knowledge documents loaded by agents for behavior consistency
- Contains: 13 .md files (~2,960 lines total)
- Key files:
  - `references/checkpoints.md` (782 lines): Checkpoint guidelines for plan execution
  - `references/verification-patterns.md` (620 lines): How to verify completed work
  - `references/tdd.md` (263 lines): TDD workflow patterns
  - `references/continuation-format.md` (254 lines): Session continuation format
  - `references/git-integration.md` (248 lines): Git branching and commit patterns
  - `references/planning-config.md` (196 lines): Config documentation
  - `references/ui-brand.md` (160 lines): UI/UX branding guidelines
  - `references/questioning.md` (145 lines): Deep questioning methodology
  - `references/model-profiles.md` (92 lines): Model assignment profiles

**`.planning/`:**
- Purpose: This project's own planning state (GSD manages itself)
- Contains: Planning documents, phase directories, memory stores, baselines
- Key files:
  - `.planning/config.json`: Project configuration (mode, profile, workflow flags)
  - `.planning/STATE.md`: Current project state
  - `.planning/ROADMAP.md`: Phase tracking across 6 milestones (v1.0–v5.0)
  - `.planning/INTENT.md`: Project intent document
  - `.planning/PROJECT.md`: Project description
  - `.planning/env-manifest.json`: Machine-specific env detection (gitignored)
  - `.planning/project-profile.json`: Team-visible project profile
  - `.planning/baselines/bundle-size.json`: Bundle size tracking
  - `.planning/memory/bookmarks.json`: Session bookmarks
  - `.planning/codebase/codebase-intel.json`: Source code analysis cache

## Key File Locations

**Entry Points:**
- `src/index.js`: Source entry — `require('./router').main()`
- `bin/gsd-tools.cjs`: Built bundle — the artifact deployed and invoked by agents
- `build.js`: Build script — esbuild configuration + smoke test + size tracking
- `deploy.sh`: Deploy script — build, backup, copy, smoke test, rollback

**Configuration:**
- `package.json`: Node.js manifest (name: `gsd-tools`, node >=18, zero runtime deps except `tokenx`)
- `VERSION`: Semantic version string (currently `1.20.5`)
- `.planning/config.json`: Per-project GSD configuration
- `src/lib/constants.js`: `CONFIG_SCHEMA` object defines all valid config keys, types, defaults, aliases

**Core Logic:**
- `src/router.js`: Command routing and argument parsing
- `src/commands/init.js`: Context aggregation for workflow initialization
- `src/commands/verify.js`: Plan/phase/artifact/requirement verification
- `src/commands/features.js`: Session, context, search, and analysis features
- `src/lib/helpers.js`: File caching, phase tree, milestone detection
- `src/lib/frontmatter.js`: YAML frontmatter parsing (custom implementation)
- `src/lib/codebase-intel.js`: Source code analysis engine
- `src/lib/deps.js`: Multi-language dependency graph construction

**Testing:**
- `bin/gsd-tools.test.cjs`: 13,040-line integration test suite using `node:test`

## Naming Conventions

**Files:**
- Source modules: `kebab-case.js` (e.g., `codebase-intel.js`, `regex-cache.js`)
- Command modules: `single-word.js` matching domain (e.g., `init.js`, `state.js`, `verify.js`)
- Workflows: `kebab-case.md` (e.g., `execute-phase.md`, `map-codebase.md`)
- Utility command workflows: `cmd-<name>.md` prefix (e.g., `cmd-velocity.md`, `cmd-test-run.md`)
- Templates: `kebab-case.md` (e.g., `phase-prompt.md`, `summary-complex.md`)
- References: `kebab-case.md` (e.g., `verification-patterns.md`, `git-integration.md`)
- Planning docs: `UPPER-CASE.md` (e.g., `STATE.md`, `ROADMAP.md`, `INTENT.md`)
- Phase plans: `NN-MM-PLAN.md` / `NN-MM-SUMMARY.md` (e.g., `01-01-PLAN.md`, `01-01-SUMMARY.md`)
- Phase context: `NN-CONTEXT.md`, `NN-VERIFICATION.md`, `NN-RESEARCH.md`

**Directories:**
- Phase directories: `NN-descriptive-slug/` (e.g., `01-foundation-safety-nets/`, `06-token-measurement-output-infrastructure/`)
- Milestone archives: `vX.Y-phases/` (e.g., `v1.0-phases/`, `v4.0-phases/`)
- Quick task directories: `N-slug/` (e.g., `1-research-and-optimize-gsd-tool-performan/`)

**Functions:**
- Command handlers: `cmd` prefix + PascalCase domain + action (e.g., `cmdInitExecutePhase`, `cmdStateLoad`, `cmdCodebaseAnalyze`)
- Internal helpers: camelCase (e.g., `findPhaseInternal`, `resolveModelInternal`, `getMilestoneInfo`)
- Lazy loaders: `lazy` prefix + PascalCase module name (e.g., `lazyState()`, `lazyInit()`)

**Variables:**
- Module-level caches: underscore prefix (e.g., `_configCache`, `_phaseTreeCache`, `_milestoneCache`, `_fmCache`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `CONFIG_SCHEMA`, `MODEL_PROFILES`, `SKIP_DIRS`, `BINARY_EXTENSIONS`)
- Cache size limits: `*_MAX` or `MAX_*` suffix/prefix (e.g., `FM_CACHE_MAX`, `MAX_CACHE_SIZE`)

## Where to Add New Code

**New CLI Command:**
1. Create handler function(s) in appropriate `src/commands/*.js` module (or new module if new domain)
2. Add case to switch in `src/router.js` — use lazy-loading pattern: `function lazyNewModule() { return _modules.newmodule || (_modules.newmodule = require('./commands/newmodule')); }`
3. Add help text to `COMMAND_HELP` in `src/lib/constants.js`
4. Add tests in `bin/gsd-tools.test.cjs`
5. Run `npm run build` to bundle, then `npm test` to verify

**New Workflow:**
1. Create `workflows/<name>.md` with `<purpose>`, `<process>`, and `<step>` tags
2. First step should call `init` command to gather context
3. Reference `gsd-tools.cjs` commands via full path: `node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs <command>`
4. Deploy via `./deploy.sh` to make available in OpenCode

**New Template:**
1. Add to `templates/` (root for planning docs, `templates/codebase/` for analysis docs, `templates/plans/` for plan types)
2. Use markdown with placeholders in `[brackets]`
3. Register in `cmdTemplateFill()` in `src/commands/misc.js` if template supports programmatic fill

**New Reference Document:**
1. Add to `references/<name>.md`
2. Reference from workflows via `@references/<name>.md` or load via `extract-sections`

**New Library Module:**
1. Add to `src/lib/<name>.js`
2. Export functions via `module.exports`
3. Import from command modules: `const { fn } = require('../lib/<name>')`
4. Keep modules focused — one responsibility per file

**New Init Workflow Command:**
1. Add handler `cmdInit<Workflow>` in `src/commands/init.js`
2. Add case to `init` switch in `src/router.js`
3. Aggregate all context the workflow needs into single JSON payload
4. Support `--compact` flag for reduced output

**New Verification Subcommand:**
1. Add handler `cmdVerify<Check>` in `src/commands/verify.js`
2. Add case to `verify` switch in `src/router.js`
3. Add help text to `COMMAND_HELP` under `'verify'` key

**New Framework Detector (conventions):**
1. Add detector object to `FRAMEWORK_DETECTORS` array in `src/lib/conventions.js`
2. Implement `detect(intel)` → boolean and `extractPatterns(intel, cwd)` → patterns array
3. Follows existing Elixir/Phoenix pattern as reference

**New Import Parser (deps):**
1. Add parser function `parse<Language>(content)` in `src/lib/deps.js`
2. Add resolver function `resolve<Language>Import()` in `src/lib/deps.js`
3. Register in `IMPORT_PARSERS` map

## Special Directories

**`bin/`:**
- Purpose: Built artifacts — the bundle and tests
- Generated: Yes — `bin/gsd-tools.cjs` is generated by `build.js`
- Committed: Yes — the bundle is version-controlled and deployed directly

**`.planning/baselines/`:**
- Purpose: Performance baselines for context budget tracking and bundle size
- Generated: Yes — created by `context-budget baseline` and `build.js`
- Committed: Yes

**`.planning/memory/`:**
- Purpose: Persistent agent memory (JSON stores)
- Generated: Yes — created by `memory write` commands
- Committed: Partially — `bookmarks.json` committed, some stores may be gitignored

**`.planning/codebase/`:**
- Purpose: Codebase analysis output (intel JSON + structured markdown docs)
- Generated: Yes — by `codebase analyze` and `map-codebase` workflow
- Committed: Yes (markdown docs committed, `codebase-intel.json` committed)

**`.planning/milestones/`:**
- Purpose: Archived milestone roadmaps, requirements, and phase directories
- Generated: Yes — by `milestone complete` command
- Committed: Yes

**`node_modules/`:**
- Purpose: npm dependencies (only `esbuild` dev + `tokenx` runtime)
- Generated: Yes — by `npm install`
- Committed: No — gitignored

---

*Structure analysis: 2026-02-26*
