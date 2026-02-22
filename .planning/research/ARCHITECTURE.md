# Architecture Research

**Domain:** Node.js CLI tool refactoring — single-file to bundled modules
**Researched:** 2026-02-22
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
 Development (src/)                        Build                    Deploy (bin/)
┌──────────────────────────────────────┐   ┌──────────┐   ┌──────────────────────┐
│  ┌──────────┐  ┌──────────────────┐  │   │          │   │                      │
│  │ index.js │  │ commands/        │  │   │  esbuild │   │  gsd-tools.cjs       │
│  │ (entry)  │  │  state.js        │  │──▶│  bundle  │──▶│  (single file,       │
│  │          │  │  roadmap.js      │  │   │  + banner │   │   ~6500 lines,       │
│  └────┬─────┘  │  phase.js        │  │   │          │   │   zero runtime deps) │
│       │        │  verify.js       │  │   └──────────┘   │                      │
│       │        │  init.js         │  │                   └──────────────────────┘
│       │        │  features.js     │  │                            │
│       │        │  scaffold.js     │  │                            │
│       │        │  frontmatter.js  │  │                   ┌──────────────────────┐
│       │        └──────────────────┘  │                   │  deploy.sh           │
│  ┌────┴─────┐  ┌──────────────────┐  │                   │  copies bin/ to      │
│  │ router.js│  │ lib/             │  │                   │  ~/.config/opencode/ │
│  │ (switch) │  │  config.js       │  │                   └──────────────────────┘
│  │          │  │  frontmatter.js  │  │
│  └──────────┘  │  git.js          │  │
│                │  markdown.js     │  │
│                │  output.js       │  │
│                │  cache.js        │  │
│                │  constants.js    │  │
│                └──────────────────┘  │
└──────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `src/index.js` | Entry point: imports router, calls `main()` | 5-10 lines, shebang handled by esbuild banner |
| `src/router.js` | CLI argv parsing + command dispatch switch | Extracted from current lines 6022-6492 |
| `src/commands/*.js` | Command functions grouped by domain | One file per section marker in current code |
| `src/lib/config.js` | `loadConfig()`, `CONFIG_SCHEMA`, config defaults | Single source of truth for all config shape |
| `src/lib/frontmatter.js` | `extractFrontmatter()`, `reconstructFrontmatter()` | YAML subset parser, shared across commands |
| `src/lib/git.js` | `execGit()`, `isGitIgnored()`, `cmdCommit()` | All `child_process` git operations |
| `src/lib/markdown.js` | Shared regex patterns, section extraction helpers | `safeReadFile()`, heading parsers, field extractors |
| `src/lib/output.js` | `output()`, `error()`, large-output tmpfile handling | JSON-to-stdout, stderr error helper |
| `src/lib/cache.js` | In-memory `Map`-based file read cache | `cachedReadFile()` wrapping `fs.readFileSync` |
| `src/lib/constants.js` | `MODEL_PROFILES`, shared constants | Static lookup tables |

## Recommended Project Structure

```
gsd-opencode/
├── src/                      # Source modules (development)
│   ├── index.js              # Entry point: require('./router').main()
│   ├── router.js             # CLI arg parsing + command dispatch
│   ├── commands/             # Command implementations by domain
│   │   ├── state.js          # State progression engine (lines 1191-2110)
│   │   ├── roadmap.js        # Roadmap analysis + updates (lines 2531-2662, 3057-3131)
│   │   ├── phase.js          # Phase add/insert/remove/complete (lines 2663-3056, 3202-3372)
│   │   ├── milestone.js      # Milestone complete + archive (lines 3373-3525)
│   │   ├── verify.js         # Verification suite (lines 2239-2530)
│   │   ├── validate.js       # Consistency + health validation (lines 3526-3895)
│   │   ├── scaffold.js       # Scaffolding + template fill (lines 3999-4058)
│   │   ├── init.js           # Compound init commands (lines 4059-5010)
│   │   ├── features.js       # Extended features: session-diff through quick-summary (lines 5012-6018)
│   │   ├── atomic.js         # Simple commands: slug, timestamp, todos, etc. (lines 488-1190)
│   │   ├── frontmatter-cmd.js # Frontmatter CRUD commands (lines 2175-2237)
│   │   ├── requirements.js   # Requirements mark-complete (lines 3133-3201)
│   │   └── websearch.js      # Brave API search (lines 2111-2174)
│   └── lib/                  # Shared internal libraries
│       ├── config.js          # loadConfig(), CONFIG_SCHEMA, CONFIG_DEFAULTS
│       ├── frontmatter.js     # extractFrontmatter(), reconstructFrontmatter()
│       ├── git.js             # execGit(), isGitIgnored()
│       ├── markdown.js        # safeReadFile(), heading parsers, field extractors
│       ├── output.js          # output(), error(), tmpfile handling
│       ├── cache.js           # FileCache class (Map-based)
│       └── constants.js       # MODEL_PROFILES, static tables
├── bin/                      # Build output (committed, deployed)
│   ├── gsd-tools.cjs         # Bundled single file (generated by esbuild)
│   └── gsd-tools.test.cjs    # Tests (NOT bundled, stays as-is)
├── build.js                  # esbuild build script
├── package.json              # engines, scripts (build, test), devDependencies
├── deploy.sh                 # Unchanged: copies bin/ to live install
├── workflows/                # Workflow prompts (unchanged)
├── templates/                # Document templates (unchanged)
├── references/               # Reference docs (unchanged)
├── AGENTS.md                 # Dev workspace docs (unchanged)
└── VERSION                   # Version tracking (unchanged)
```

### Structure Rationale

- **`src/commands/` by domain, not by command:** Grouping by the existing section markers (State Progression Engine, Verification Suite, etc.) keeps related commands together. Each file exports named functions that the router imports. This mirrors how the file is already organized with `// ───` section headers.
- **`src/lib/` for shared internals:** These are pure utility modules with no CLI-specific logic. They can be tested independently. Every command file imports from `lib/` but never from other `commands/` files — this enforces a strict dependency direction.
- **`bin/` as build output:** The bundled `gsd-tools.cjs` stays in `bin/` exactly where it is now. `deploy.sh` copies `bin/` unchanged. No deploy workflow changes needed.
- **Tests stay unbundled:** `bin/gsd-tools.test.cjs` tests the bundled output (black-box), not source modules. This validates that the bundle works identically to the old single file. Module-level unit tests can be added separately in `src/**/*.test.js` later if wanted, but are not required for the refactor.

## Architectural Patterns

### Pattern 1: Barrel Exports per Command Module

**What:** Each command module exports a flat object of named command functions. The router imports all barrels and dispatches by command name.
**When to use:** When you have many functions that need to be addressable by a string key (CLI command name) at a central dispatch point.
**Trade-offs:** Simple and grep-friendly. No dynamic `require()` needed. esbuild tree-shakes nothing (all commands are reachable from router), but that's fine — we want the full CLI in the bundle.

**Example:**
```javascript
// src/commands/state.js
const { loadConfig } = require('../lib/config');
const { safeReadFile } = require('../lib/markdown');
const { output, error } = require('../lib/output');

function cmdStateLoad(cwd, raw) { /* ... */ }
function cmdStateUpdate(cwd, field, value) { /* ... */ }
function cmdStatePatch(cwd, patches, raw) { /* ... */ }
// ... all state commands

module.exports = {
  cmdStateLoad,
  cmdStateUpdate,
  cmdStatePatch,
  // ...
};
```

```javascript
// src/router.js
const state = require('./commands/state');
const roadmap = require('./commands/roadmap');
const phase = require('./commands/phase');
// ...

async function main() {
  const args = process.argv.slice(2);
  // ... parse args ...
  switch (command) {
    case 'state': {
      if (subcommand === 'update') state.cmdStateUpdate(cwd, args[2], args[3]);
      else if (subcommand === 'get') state.cmdStateGet(cwd, args[2], raw);
      // ...
      break;
    }
    // ...
  }
}
module.exports = { main };
```

### Pattern 2: Module-level File Cache (Map-based)

**What:** A singleton `Map` that caches `fs.readFileSync` results by absolute path. All file reads go through `cachedReadFile()`. Cache lives for the duration of one CLI invocation (single `main()` call) — no TTL needed.
**When to use:** Short-lived CLI processes that read the same files multiple times within a single invocation (e.g., `init progress` reads `ROADMAP.md` and `STATE.md` through multiple internal functions).
**Trade-offs:** Zero-dependency, zero-config. Adds ~30 lines of code. Eliminates redundant `readFileSync` calls. No invalidation complexity because the process exits after each command. Only risk: stale reads within a single invocation if a command writes then re-reads the same file — solved by busting the cache entry on write.

**Example:**
```javascript
// src/lib/cache.js
const fs = require('fs');
const path = require('path');

const _cache = new Map();

function cachedReadFile(filePath) {
  const abs = path.resolve(filePath);
  if (_cache.has(abs)) return _cache.get(abs);
  try {
    const content = fs.readFileSync(abs, 'utf-8');
    _cache.set(abs, content);
    return content;
  } catch {
    _cache.set(abs, null);
    return null;
  }
}

function invalidate(filePath) {
  _cache.delete(path.resolve(filePath));
}

function invalidateAll() {
  _cache.clear();
}

module.exports = { cachedReadFile, invalidate, invalidateAll };
```

**Usage in write paths:**
```javascript
// In any command that writes a file
const { invalidate } = require('../lib/cache');

function cmdStateUpdate(cwd, field, value) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  // ... modify content ...
  fs.writeFileSync(statePath, newContent);
  invalidate(statePath); // bust cache so subsequent reads see the update
}
```

### Pattern 3: esbuild Single-File Bundle with Shebang

**What:** A `build.js` script that uses esbuild's JavaScript API to bundle all `src/` modules into a single `bin/gsd-tools.cjs` file. Node.js builtins (`fs`, `path`, `child_process`) are automatically excluded via `platform: 'node'`. The shebang line is injected via esbuild's `banner` option.
**When to use:** When you need multi-file development with single-file deployment.
**Trade-offs:** Adds esbuild as a devDependency (~9MB install). Build step is fast (<100ms for ~6500 lines). The output is a single readable (non-minified) CJS file. Source maps are optional but helpful for debugging stack traces.

**Example:**
```javascript
// build.js
const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints: ['src/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'bin/gsd-tools.cjs',
  banner: { js: '#!/usr/bin/env node' },
  sourcemap: false,       // optional: 'linked' for debugging
  minify: false,           // keep output readable for debugging
  keepNames: true,         // preserve function names in stack traces
  logLevel: 'warning',
});
```

## Data Flow

### Build Flow

```
Developer edits src/**/*.js
        ↓
npm run build  (or: node build.js)
        ↓
esbuild reads src/index.js
        ↓
esbuild resolves all require() calls → traverses src/ tree
        ↓
esbuild excludes Node builtins (fs, path, child_process) via platform: 'node'
        ↓
esbuild concatenates all modules → single IIFE in CJS format
        ↓
esbuild prepends shebang via banner option
        ↓
Writes bin/gsd-tools.cjs  (single file, ~6500 lines, zero runtime deps)
        ↓
Developer runs: node bin/gsd-tools.cjs <command>  (same as before)
```

### Runtime Data Flow (unchanged from current architecture)

```
Workflow invokes: node gsd-tools.cjs init execute-phase 3
        ↓
src/index.js → main()
        ↓
src/router.js → parse argv → dispatch to command module
        ↓
src/commands/init.js → cmdInitExecutePhase()
        ↓
  reads .planning/config.json    ← via lib/config.js → lib/cache.js
  reads .planning/STATE.md       ← via lib/markdown.js → lib/cache.js
  reads .planning/ROADMAP.md     ← via lib/markdown.js → lib/cache.js
  reads .planning/phases/03-*/   ← via lib/markdown.js → lib/cache.js
        ↓
  assembles JSON result object
        ↓
src/lib/output.js → JSON.stringify → stdout (or tmpfile if >50KB)
```

### Cache Data Flow

```
                  First read of STATE.md
cmdInitProgress() ──────────────────────────▶ cachedReadFile()
                                                   │
                                          ┌────────┴────────┐
                                          │ Map.has(path)?   │
                                          │   NO → readFile  │
                                          │   cache result   │
                                          │   return content │
                                          └─────────────────┘

                  Second read of STATE.md (from different internal function)
getSessionDiffSummary() ────────────────────▶ cachedReadFile()
                                                   │
                                          ┌────────┴────────┐
                                          │ Map.has(path)?   │
                                          │   YES → return   │
                                          │   cached content │
                                          └─────────────────┘

                  Write to STATE.md
cmdStateUpdateProgress() ───────────────────▶ writeFileSync() + invalidate(path)
                                                   │
                                          ┌────────┴────────┐
                                          │ Map.delete(path) │
                                          │ Next read will   │
                                          │ hit disk again   │
                                          └─────────────────┘
```

### Key Data Flows

1. **Build flow:** `src/**/*.js` → esbuild → `bin/gsd-tools.cjs`. Developer runs `npm run build` (or it runs automatically via a watcher). Output file replaces the current hand-maintained single file.
2. **Runtime flow:** Identical to current. `bin/gsd-tools.cjs` is invoked the same way. All consumers (workflows, commands, agents) see no change.
3. **Cache flow:** Within a single CLI invocation, `cachedReadFile()` deduplicates disk reads. Write operations bust their own cache entries.
4. **Deploy flow:** `deploy.sh` unchanged — copies `bin/` to live install. The bundled file is in `bin/` just like before.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (~6,500 lines) | Split into ~15 source files. esbuild bundles in <100ms. No issues. |
| ~15,000 lines | Same approach scales fine. May want to split `features.js` into individual command files. |
| ~30,000+ lines | Consider code-splitting by command group if startup parsing becomes measurable. Unlikely for a CLI. |

### Scaling Priorities

1. **First bottleneck: file I/O in compound commands.** `init` commands read 5-10 files each. The cache eliminates redundant reads within a single invocation. This is the only real performance issue today.
2. **Second bottleneck: grep-based codebase-impact.** Multiple `child_process` spawns per file. Fix by batching grep patterns (orthogonal to the module refactor).

## Anti-Patterns

### Anti-Pattern 1: Circular Dependencies Between Command Modules

**What people do:** Command module A imports a function from command module B, which imports from A.
**Why it's wrong:** Creates hard-to-debug initialization order issues in CJS. esbuild handles it but the code becomes fragile and hard to reason about.
**Do this instead:** If two command modules need the same function, extract it to `lib/`. Command modules only import from `lib/`, never from each other. The dependency graph is strictly: `router → commands → lib`.

### Anti-Pattern 2: Dynamic require() Based on Command Name

**What people do:** `require('./commands/' + commandName)` to lazily load command modules.
**Why it's wrong:** esbuild cannot statically analyze dynamic `require()` paths. The command module won't be included in the bundle. You'd need to manually configure `external` or inject, defeating the purpose.
**Do this instead:** Static imports in `router.js`. All command modules are imported at the top of the file. esbuild bundles everything. The cold-start cost of parsing ~6500 lines of JS is <5ms in V8 — laziness is unnecessary.

### Anti-Pattern 3: Introducing Runtime Dependencies

**What people do:** `npm install node-cache` or `npm install yaml` as runtime dependencies, then try to bundle them.
**Why it's wrong:** Adds supply chain risk, increases bundle size, and some npm packages use native bindings or dynamic requires that break bundling. The current zero-runtime-dependency constraint is valuable.
**Do this instead:** Use native `Map` for caching (30 lines vs a library). Keep the hand-rolled YAML subset parser (it handles the project's actual usage). Only add devDependencies (esbuild itself).

### Anti-Pattern 4: Minifying the Bundle

**What people do:** Enable `minify: true` in esbuild to reduce file size.
**Why it's wrong:** The output file is a dev tool, not a production web bundle. Minification destroys readability (needed for debugging), mangles function names in stack traces, and makes `git diff` useless for reviewing build output changes. The 6500-line file is ~200KB — size is irrelevant.
**Do this instead:** `minify: false`, `keepNames: true`. The bundle should be readable. Optionally commit it to git so changes are reviewable.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Git (child_process) | `execGit()` in `lib/git.js` — all git ops go through one helper | Escapes arguments, returns `{exitCode, stdout, stderr}` |
| Brave Search API | `cmdWebsearch()` in `commands/websearch.js` — async `fetch()` | Only async command. Requires Node 18+ global `fetch` |
| Filesystem (.planning/) | `cachedReadFile()` in `lib/cache.js` — all reads via cache | `safeReadFile()` wraps cache, returns null on error |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `router → commands` | Direct function calls via static `require()` | Router is the only consumer of command modules |
| `commands → lib` | Direct function calls via static `require()` | One-way dependency. Commands never import from other commands |
| `lib → lib` | Direct function calls | Allowed (e.g., `cache.js` uses `path`, `config.js` uses `markdown.js`) |
| `build.js → src/` | esbuild file resolution | Build script is a dev tool, not part of the runtime |

### Build Integration

| Step | Tool | Input | Output |
|------|------|-------|--------|
| Bundle | esbuild (`build.js`) | `src/index.js` + all imports | `bin/gsd-tools.cjs` |
| Test | `node --test` | `bin/gsd-tools.test.cjs` | Pass/fail |
| Deploy | `deploy.sh` | `bin/`, `workflows/`, `templates/`, `references/` | `~/.config/opencode/get-shit-done/` |

### How deploy.sh Changes

**It doesn't.** The deploy script copies `bin/` to the live install. Since the bundled output lands in `bin/gsd-tools.cjs` — the same path as the current single file — deploy.sh works without modification. The only change is that `bin/gsd-tools.cjs` is now generated rather than hand-edited, but deploy.sh doesn't care about that.

### Build Order Implications for Phases

The refactor should proceed in this order to maintain a working CLI at every step:

1. **Add package.json + build.js first** — Create the build infrastructure. The initial `src/index.js` can just `require('../bin/gsd-tools.cjs')` as a passthrough. Verify `npm run build` produces the same output.
2. **Extract `lib/` modules** — Pull out shared utilities (`config.js`, `frontmatter.js`, `git.js`, `markdown.js`, `output.js`, `constants.js`). These are leaf dependencies with no command logic. After each extraction, run `npm run build && npm test` to verify identical behavior.
3. **Extract `commands/` modules one at a time** — Start with the simplest (atomic commands), then state, roadmap, phase, etc. Each extraction is a small, testable change. The order doesn't matter much because commands don't depend on each other.
4. **Extract router last** — The router imports all command modules. Extract it after all commands are in separate files.
5. **Add cache layer** — Once the module structure is in place, replace `safeReadFile()` calls with `cachedReadFile()`. This is an independent change that can happen at any point after `lib/cache.js` exists.

## Sources

- esbuild official documentation: `platform: 'node'` auto-externalizes Node builtins, `banner` option for shebang, `format: 'cjs'` for CommonJS output — **HIGH confidence** (Context7 + official docs)
- esbuild changelog (0.7.0): Output files starting with shebang are auto-marked executable — **HIGH confidence** (Context7, verified in esbuild changelog)
- esbuild API: `buildSync()` with `bundle: true`, `outfile` for single output, `keepNames: true` for stack traces — **HIGH confidence** (Context7)
- Node.js `Map` for in-memory caching: Native V8 data structure, O(1) lookups, no dependencies — **HIGH confidence** (Node.js built-in, well-established pattern)
- Current codebase analysis: Section markers at 34 positions identify natural module boundaries — **HIGH confidence** (direct code inspection of `bin/gsd-tools.cjs`)

---
*Architecture research for: Node.js CLI tool refactoring — single-file to bundled modules*
*Researched: 2026-02-22*
