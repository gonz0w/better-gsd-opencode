# Stack Research

**Domain:** Node.js CLI build tooling, bundling, and caching
**Researched:** 2026-02-22
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| esbuild | 0.27.3 | Bundle split source modules into single CJS file | Fastest JS bundler (10-100x faster than alternatives), native CJS output with `--platform=node --format=cjs`, zero-config for this use case. Used by tsup, Vite, and lru-cache itself as build tool. Node 18+ engine requirement matches project constraint. |
| lru-cache | 10.4.3 | In-process file/parse result caching | Purpose-built LRU with TTL support, zero dependencies in v10, CJS + ESM exports, battle-tested (used by npm itself). v10 is the last line supporting Node 18; v11 requires Node 20+. |
| Node.js | >=18.0.0 | Runtime | Already the project minimum. Provides native `node:test`, global `fetch`, sufficient for all tooling. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lru-cache | 10.4.3 | File content caching within single CLI invocation | Always — replaces repeated `fs.readFileSync` calls for same paths within one command execution |
| (none additional) | — | — | The project should stay minimal. esbuild + lru-cache are the only two runtime/dev additions needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| esbuild | Bundler (dev dependency only) | Invoked via `node build.js` script, not globally installed. ~4MB install, sub-second builds. |
| node:test | Test runner | Already in use, no changes needed. Continue using built-in test runner. |
| node:assert | Test assertions | Already in use, no changes needed. |

## Installation

```bash
# Initialize package.json (first time only)
npm init -y

# Runtime dependency (bundled into output)
npm install lru-cache@10.4.3

# Dev dependency (build tooling only)
npm install -D esbuild@0.27.3
```

## Build Configuration

### esbuild build script (`build.js`)

```javascript
const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints: ['src/index.cjs'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outfile: 'bin/gsd-tools.cjs',
  packages: 'bundle',        // Bundle ALL packages into output (override 0.22+ default)
  banner: {
    js: '#!/usr/bin/env node',
  },
  sourcemap: false,           // Not needed for CLI tool
  minify: false,              // Keep readable for debugging
  logLevel: 'info',
});
```

**Critical configuration notes:**

1. **`packages: 'bundle'`** — Since esbuild 0.22.0, `--platform=node` defaults to `--packages=external`, meaning npm packages are NOT bundled. You MUST set `packages: 'bundle'` to inline lru-cache into the single output file. Without this, the deployed artifact would require `node_modules/` at runtime, breaking the zero-dependency deploy requirement. **(Confidence: HIGH — verified via esbuild changelog for 0.22.0)**

2. **`banner.js`** — Adds shebang line for direct execution. esbuild's banner option prepends arbitrary text before the bundle. **(Confidence: HIGH — verified via esbuild official API docs)**

3. **`format: 'cjs'`** — Explicit CJS output. When `platform: 'node'` and bundling enabled, esbuild defaults to CJS anyway, but being explicit prevents surprises. **(Confidence: HIGH — verified via esbuild API docs)**

4. **`target: 'node18'`** — Ensures output uses only syntax available in Node 18+. **(Confidence: HIGH — verified via esbuild docs)**

### package.json structure

```json
{
  "name": "gsd-tools",
  "version": "1.20.5",
  "private": true,
  "description": "GSD planning plugin CLI for Claude Code",
  "main": "bin/gsd-tools.cjs",
  "scripts": {
    "build": "node build.js",
    "test": "node --test bin/gsd-tools.test.cjs",
    "dev:test": "node --test --watch bin/gsd-tools.test.cjs",
    "deploy": "./deploy.sh"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "lru-cache": "10.4.3"
  },
  "devDependencies": {
    "esbuild": "0.27.3"
  }
}
```

**Key decisions:**
- **`private: true`** — This is not an npm package. Prevents accidental publish.
- **`engines.node >= 18`** — Formalizes existing requirement (was undocumented).
- **lru-cache in `dependencies`** (not `devDependencies`) — It's bundled into output, but semantically it's a runtime dependency. esbuild resolves it from `node_modules/` at build time.
- **Version pinned** — Exact versions, no ranges. Build reproducibility matters for a tool other tools depend on.

### Source file structure (post-split)

```
src/
  index.cjs          # Entry point — command dispatch, CLI arg parsing
  cache.cjs          # File cache module (wraps lru-cache)
  parsers.cjs        # Markdown/YAML parsing (309+ regex patterns)
  state.cjs          # STATE.md read/write/patch operations
  roadmap.cjs        # Roadmap analysis, milestone detection
  git.cjs            # Git operations (execSync wrappers)
  commands/          # Individual command implementations
    init.cjs
    roadmap.cjs
    plan.cjs
    state.cjs
    ...
  utils.cjs          # Shared utilities, path helpers, debug logging
```

esbuild will resolve all `require('./...')` calls and produce a single `bin/gsd-tools.cjs` — identical deployment artifact to today.

## Caching Architecture

### Why lru-cache, not native Map

For a short-lived CLI process (runs once, exits), you might think a plain `Map` is sufficient. Here's why lru-cache is still better:

| Concern | Map | lru-cache |
|---------|-----|-----------|
| Memory bound | Unbounded — leaks if bug causes repeated caching | `max` option prevents runaway memory |
| Stale data | No TTL — stale forever during process | TTL support for safety |
| Size awareness | No concept of entry size | `maxSize` + `sizeCalculation` for byte-aware bounds |
| Eviction | None — grows until process exits | LRU eviction when hitting bounds |
| Debug/observability | Manual `.size` only | `.size`, `.calculatedSize`, `.getRemainingTTL()` |

For a CLI that reads 10-50 files per invocation, the difference is negligible in happy-path. But lru-cache prevents the pathological case (huge `.planning/` directory, recursive operations) from eating memory. The library adds ~30KB to the bundle — trivial.

**(Confidence: HIGH — lru-cache API verified via Context7, npm-compare.com confirms lru-cache is the standard choice for Node.js in-memory caching)**

### Why NOT node-cache

- `node-cache@5.1.2` — Last published June 2020. Effectively unmaintained.
- Has `clone` as a dependency (deep-clones all values by default — unnecessary overhead).
- Uses `setTimeout` internally for TTL — wasteful for short-lived processes.
- lru-cache checks staleness lazily on `get()` — zero overhead when TTL isn't hit.

**(Confidence: HIGH — verified node-cache publish date via npm registry, last release 2020-07-01)**

### Cache usage pattern

```javascript
const { LRUCache } = require('lru-cache');

const fileCache = new LRUCache({
  max: 200,                    // Max 200 cached files
  ttl: 1000 * 60 * 5,         // 5 min TTL (safety; process exits in seconds)
  ttlAutopurge: false,         // Don't run timers — waste for short-lived process
  updateAgeOnGet: false,       // Don't reset TTL on read
});

function readFileCached(filePath) {
  const cached = fileCache.get(filePath);
  if (cached !== undefined) return cached;
  const content = fs.readFileSync(filePath, 'utf8');
  fileCache.set(filePath, content);
  return content;
}
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| esbuild (direct) | tsup | If you want TypeScript compilation + declaration files. tsup wraps esbuild but adds config overhead. Since this project is pure JS (CJS), tsup adds a layer of indirection with no benefit. |
| esbuild (direct) | Rollup | If you need advanced tree-shaking of ESM or plugin ecosystem (e.g., virtual modules). Rollup is slower (10-100x), requires plugins for CJS input (`@rollup/plugin-commonjs`), and is overkill for bundling CJS→CJS. |
| esbuild (direct) | Rolldown | If the project migrates to ESM and needs Rollup-compatible plugin ecosystem with Rust performance. Rolldown is still pre-1.0 (beta). Not appropriate for stable tooling. |
| esbuild (direct) | webpack | Never for this use case. Webpack is designed for web applications, not CLI tools. Massive config surface, slow builds, heavy install. |
| lru-cache v10 | lru-cache v11 | When the project drops Node 18 support and requires Node 20+. v11 has the same API with minor improvements. Migrate when Node 18 reaches EOL (April 2025 — already past, but the project currently targets it). |
| lru-cache | native Map | If the project will NEVER cache more than ~20 items and memory bounds are guaranteed by the caller. Not recommended — the safety net of bounded caching costs nothing. |
| lru-cache | @isaacs/ttlcache | If you only need TTL-based expiry without LRU eviction. Same author, simpler API. But lru-cache's `max` bound is the primary value here, not TTL. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| tsup | Adds unnecessary abstraction over esbuild for a pure-CJS project. tsup's value is TypeScript DX + multi-format output — neither applies here. | esbuild directly |
| Rollup | 10-100x slower than esbuild. Requires `@rollup/plugin-commonjs` + `@rollup/plugin-node-resolve` just to handle CJS input. Three dependencies vs one. | esbuild |
| webpack | Designed for web apps, not CLI tools. Massive config surface. Would be comically over-engineered for "bundle CJS files into one CJS file." | esbuild |
| Rolldown | Pre-1.0, beta stability. Promising but not production-ready for stable build tooling (as of Feb 2026). | esbuild |
| node-cache | Unmaintained since 2020. Deep-clones values by default (unnecessary perf hit). Uses setTimeout for TTL (wasteful for CLI). | lru-cache |
| memory-cache | No size bounds, no LRU eviction, minimal maintenance. | lru-cache |
| node-persist | Disk-based persistence. Adds I/O latency. CLI processes don't survive between invocations anyway. | lru-cache (in-memory) |
| quick-lru (sindresorhus) | ESM-only. Cannot be `require()`'d in CJS source files without bundler transformation. The source files are CJS. | lru-cache (CJS + ESM dual) |
| TypeScript | The project is 6,495 lines of working CJS JavaScript. Migrating to TypeScript is a rewrite, not a build improvement. Out of scope per PROJECT.md. | Stay with JavaScript |

## Stack Patterns by Variant

**If staying with single-file source (no split):**
- Skip esbuild entirely
- Use native `Map` for caching (add as module-level singleton)
- Add `package.json` with just `engines` field and scripts
- This is the minimal change — but misses the opportunity to improve code organization

**If splitting source into modules (recommended):**
- Use esbuild to bundle back to single file
- Use lru-cache for bounded file caching
- Add `package.json` with dependencies and build script
- deploy.sh runs `npm run build` before copying `bin/gsd-tools.cjs`
- Source lives in `src/`, built artifact in `bin/`

**If migrating to ESM in the future:**
- esbuild handles ESM→CJS output natively
- lru-cache v10 provides both CJS and ESM exports
- Change `format: 'cjs'` to `format: 'esm'` in build.js when ready
- No other tooling changes needed

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| esbuild@0.27.3 | Node >=18 | esbuild's own `engines` field requires Node 18+. Matches project constraint exactly. |
| lru-cache@10.4.3 | Node >=16.14 | v10 line supports Node 16+. v11 drops Node 18 — do NOT upgrade until project drops Node 18 support. |
| lru-cache@10.4.3 | esbuild@0.27.3 | lru-cache uses esbuild as a dev dependency itself. No conflicts. Bundling with esbuild is a tested path. |

## Deploy Integration

The deploy.sh script needs one addition:

```bash
#!/bin/bash
# Build before deploy
npm run build || exit 1

# ... existing deploy logic (copy bin/, workflows/, templates/, etc.)
```

This ensures the single-file artifact is rebuilt from split source before deployment. The deployed artifact (`bin/gsd-tools.cjs`) remains identical in structure to the current file — downstream consumers (workflows, agents) are unaffected.

## Sources

- esbuild official API docs (https://esbuild.github.io/api/) — Banner, platform, format, packages options — **HIGH confidence**
- esbuild npm registry (https://registry.npmjs.org/esbuild/latest) — Version 0.27.3 confirmed current — **HIGH confidence**
- Context7 `/evanw/esbuild` — CJS bundling, `--packages=external` default change in 0.22.0, banner syntax — **HIGH confidence**
- Context7 `/isaacs/node-lru-cache` — TTL configuration, cache bounds, CJS import pattern — **HIGH confidence**
- Context7 `/websites/tsup_egoist_dev` — Format options, splitting behavior, CJS output — **HIGH confidence**
- lru-cache npm registry (https://registry.npmjs.org/lru-cache/latest) — v11.2.6 requires Node 20+, v10.4.3 is last Node 18 compatible — **HIGH confidence**
- node-cache npm registry (https://registry.npmjs.org/node-cache/latest) — v5.1.2, last publish 2020-07-01, confirmed unmaintained — **HIGH confidence**
- npm-compare.com (lru-cache vs node-cache vs memory-cache) — Comparison of caching libraries, confirms lru-cache as standard choice — **MEDIUM confidence**
- esbuild changelog 2022 (via Context7) — `packages: 'external'` feature introduction, later made default for `platform: 'node'` — **HIGH confidence**
- esbuild changelog 2024 (via Context7) — 0.22.0 makes `packages=external` the default for Node platform — **HIGH confidence**

---
*Stack research for: GSD Plugin CLI build tooling and caching*
*Researched: 2026-02-22*
