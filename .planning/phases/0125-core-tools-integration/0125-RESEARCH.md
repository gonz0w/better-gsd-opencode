# Phase 125: Core Tools Integration - Research

**Researched:** 2026-03-14
**Domain:** CLI tool integration (ripgrep, fd, jq) into Node.js CLI workflows
**Confidence:** HIGH

## Summary

Phase 124 delivered a complete tool detection infrastructure in `src/lib/cli-tools/` with detector, fallback wrapper, install guidance, and individual tool wrapper modules (ripgrep.js, fd.js, jq.js). These wrappers already implement the `withToolFallback()` pattern with `execFileSync` array args for security, but **none are yet integrated into actual bgsd-tools workflows**. The wrapper modules exist as standalone, unused code.

Phase 125's job is to wire these wrappers into the real codebase workflows — replacing Node.js file traversal with fd, content search with ripgrep, and JSON processing with jq — while respecting the CONTEXT.md decisions on silent fallback, unified search, config toggles, and identical output format.

**Primary recommendation:** Integrate each tool one at a time (ripgrep → fd → jq) into the specific callsites identified below, adding per-tool config toggles to CONFIG_SCHEMA, and ensuring the existing 1350 tests continue passing after each integration.

<user_constraints>

## User Constraints

These decisions from CONTEXT.md are **locked** — planner MUST honor them:

1. **Silent fallback** — No user-visible messages when falling back to Node.js. Fallback events logged to debug output only.
2. **Unified ripgrep replacement** — ripgrep replaces ALL file content search throughout bgsd-tools when available, not selective.
3. **fd scope limited** — fd used only for large-scale codebase file discovery. Keep simple glob/readdir for `.planning/` and known small directories.
4. **Per-tool config toggles** — `tools.ripgrep: false`, `tools.fd: true`, `tools.jq: false` in config.json for fine-grained control. Config overrides Phase 124 detection cache.
5. **Tools must be on PATH** — No custom path configuration. No environment variable overrides.
6. **jq for all JSON file processing** — Both internal config files AND external/user data when available.
7. **JavaScript fallback must produce identical results** — No degraded mode for jq. Full feature parity for every filter used.
8. **Output format parity** — Node.js fallback produces identical output format to external tools. Callers don't need to know which backend ran.
9. **Health command integration** — Tool availability surfaced via `/bgsd-health` command showing tool name + link to project page for missing tools.
10. **jq filter storage** — Agent's discretion whether inline or separate .jq files.

</user_constraints>

<phase_requirements>

## Phase Requirements Mapping

| Requirement | Description | Key Acceptance Criteria |
|-------------|-------------|------------------------|
| TOOL-01 | ripgrep integration | <100ms on 10K+ file codebase, execFileSync array args |
| TOOL-02 | fd integration | 20x+ speedup vs Node.js traversal, .gitignore respect |
| TOOL-03 | jq integration | <50ms per invocation, full JS fallback parity |
| TOOL-DEGR-01 | Graceful degradation | CLI never crashes, fallback quality acceptable, clear guidance |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ripgrep (rg) | 14.x+ | Content search | 50x+ faster than grep, JSON output mode, .gitignore respect |
| fd (fd-find) | 10.x+ | File discovery | 20x+ faster than find, .gitignore respect by default |
| jq | 1.7+ | JSON transformation | Standard JSON processor, streaming support, pipe-friendly |
| Node.js child_process | Built-in | Process spawning | execFileSync with array args (zero shell injection) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fast-glob (fg) | Already in project | fd Node.js fallback | When fd unavailable for codebase file discovery |
| ignore | Already in project | .gitignore parsing | Already used in discovery.js for optimized mode |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ripgrep JSON output | ripgrep plain text | JSON output already implemented in ripgrep.js, easier to parse |
| fd for all file ops | fd for everything | Decision locked: fd only for large-scale discovery |
| jq for simple lookups | Always JS | Decision locked: jq for ALL JSON processing when available |

## Architecture Patterns

### Pattern 1: Config-Aware Tool Resolution

The existing `withToolFallback()` in `src/lib/cli-tools/fallback.js:30` checks `detectTool()` then runs CLI or fallback. Phase 125 must add a config check layer **before** detection:

```javascript
// New pattern: config toggle → detection → execute/fallback
function isToolEnabled(toolName) {
  const config = loadConfig(process.cwd());
  const configKey = `tools_${toolName}`;  // e.g., tools_ripgrep
  if (config[configKey] === false) return false;  // Explicitly disabled
  return isToolAvailable(toolName);  // Phase 124 detection
}
```

Add to `CONFIG_SCHEMA` in `src/lib/constants.js`:
- `tools_ripgrep: { type: 'boolean', default: true }`
- `tools_fd: { type: 'boolean', default: true }`
- `tools_jq: { type: 'boolean', default: true }`

### Pattern 2: Integration Point Replacement

Each integration follows the same pattern:
1. Identify the existing Node.js operation (readdir walk, regex search, JSON.parse)
2. Create a thin integration function that checks config + calls cli-tools wrapper
3. Replace the callsite to use the integration function
4. Existing fallback in the wrapper handles unavailability transparently

### Pattern 3: Identical Output Contract

Per CONTEXT.md, callers must not need to know which backend ran. The existing wrappers in `ripgrep.js`, `fd.js`, and `jq.js` already return `{ success, usedFallback, result }` — the `result` field must produce identical data shape regardless of backend.

### Recommended Integration Structure

All integration logic lives in the existing `src/lib/cli-tools/` directory:
```
src/lib/cli-tools/
  detector.js       # Phase 124 — unchanged
  fallback.js        # Phase 124 — add config-aware check
  install-guidance.js # Phase 124 — unchanged
  ripgrep.js         # Phase 124 wrapper — enhance with more options
  fd.js              # Phase 124 wrapper — enhance with more options
  jq.js              # Phase 124 wrapper — enhance with more filters
  index.js           # Phase 124 — unchanged (re-exports)
```

Integration happens in the **consumer** files:
```
src/lib/adapters/discovery.js   # fd integration for walkSourceFiles
src/lib/codebase-intel.js       # fd integration for getSourceDirs (via discovery.js)
src/lib/conventions.js          # ripgrep for framework pattern detection (file content search)
src/lib/deps.js                 # ripgrep for import parsing across files
src/commands/env.js             # ripgrep for content pattern detection
src/commands/codebase.js        # ripgrep for content search, fd for file discovery
```

### Anti-Patterns to Avoid

- **Don't refactor consumer APIs.** Replace the internal implementation, not the function signatures that callers use.
- **Don't add tool-specific logic to consumer files.** All tool selection logic stays in `src/lib/cli-tools/`. Consumer files call the same wrapper functions.
- **Don't change the `withToolFallback()` return shape.** The `{ success, usedFallback, result }` contract is Phase 124's API.
- **Don't add `require('child_process')` to consumer files.** All process spawning goes through the cli-tools wrappers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| .gitignore-aware search | Custom .gitignore parser for search | ripgrep `--json` (respects .gitignore natively) | ripgrep handles nested .gitignore, global ignores, etc. |
| .gitignore-aware file listing | Custom ignore matcher for large trees | fd (respects .gitignore by default) | fd handles all ignore edge cases |
| JSON query language | Custom JS filter interpreter | jq with JS `JSON.parse` fallback | jq is the standard; the JS fallback only needs to cover filters actually used |
| Version-specific feature flags | Custom version comparison | `meetsMinVersion()` from Phase 124's detector.js | Already implemented and tested |

## Common Pitfalls

### Pitfall 1: ripgrep Exit Code 1 on No Matches
**What goes wrong:** `execFileSync` throws on non-zero exit codes. ripgrep exits 1 when no matches found.
**Why it happens:** ripgrep uses exit code 1 for "no matches" (not an error).
**How to avoid:** The existing `ripgrep.js` wrapper already wraps in try/catch, but ensure ALL callsites handle empty results gracefully.
**Warning signs:** Tests that throw on "no results found" searches.

### Pitfall 2: fd Binary Name Varies by Platform
**What goes wrong:** On Debian/Ubuntu, fd is installed as `fdfind` not `fd` (package `fd-find`).
**Why it happens:** Package name conflict with `fd` (already used by another package on Debian).
**How to avoid:** Phase 124's detector already handles this via the `aliases: ['fd-find']` config, and `resolveToolPath()` tries all names. The fd.js wrapper uses `fd` as binary name — verify it also tries `fdfind`.
**Warning signs:** fd detected as available but `execFileSync('fd', ...)` fails on Ubuntu.

### Pitfall 3: jq Fallback Filter Coverage
**What goes wrong:** JavaScript fallback in `jq.js` only covers basic filters (`.[]`, `.key`, `length`). Real usage might need `select()`, `map()`, pipe chains.
**Why it happens:** Phase 124 implemented minimal fallback; Phase 125 adds real usage that may need more complex filters.
**How to avoid:** Inventory all jq filters that will be used BEFORE implementation. Ensure each filter has a working JS equivalent in the fallback.
**Warning signs:** Tests pass with jq installed but fail without it.

### Pitfall 4: Config Toggle Not Checked Before Detection
**What goes wrong:** Tool spawned despite user setting `tools.ripgrep: false` in config.
**Why it happens:** `withToolFallback()` calls `detectTool()` directly, which doesn't check config.
**How to avoid:** Add config check to `isToolAvailable()` or create a new `isToolEnabled()` that checks config first, then detection.
**Warning signs:** User disables tool in config but it still spawns.

### Pitfall 5: Output Format Divergence Between Backends
**What goes wrong:** Callers get different data shapes from CLI vs fallback path.
**Why it happens:** CLI output needs parsing; fallback produces native JS objects. Parsing may miss edge cases.
**How to avoid:** Write tests that assert identical output for both backends with the same input data.
**Warning signs:** Tests only test one code path (CLI or fallback, not both).

### Pitfall 6: Discovery Adapter Already Uses fast-glob
**What goes wrong:** Replacing `optimizedWalkSourceFiles` with fd when it already uses fast-glob creates confusion.
**Why it happens:** `src/lib/adapters/discovery.js` has both legacy (readdirSync) and optimized (fast-glob + ignore) modes.
**How to avoid:** fd integration should be a **third** mode in discovery.js, or replace the optimized path. The legacy path must remain as final fallback.
**Warning signs:** Breaking the shadow-compare parity system in discovery.js.

## Code Examples

### Example 1: Config-Aware Tool Check (New Pattern)

```javascript
// In src/lib/cli-tools/fallback.js — enhance isToolAvailable()
const { loadConfig } = require('../config');

function isToolEnabled(toolName) {
  try {
    const config = loadConfig(process.cwd());
    const key = `tools_${toolName}`;
    if (config[key] === false) return false;
  } catch {
    // Config not available (no .planning dir) — rely on detection only
  }
  return isToolAvailable(toolName);
}
```

### Example 2: fd Integration in Discovery Adapter

```javascript
// In src/lib/adapters/discovery.js — new fd-backed walk
const { findFiles: fdFindFiles, isFdAvailable } = require('../cli-tools');

function fdWalkSourceFiles(cwd, sourceDirs, skipDirs) {
  // fd respects .gitignore by default — no need for ignore matcher
  const allFiles = [];
  for (const dir of sourceDirs) {
    const result = fdFindFiles('', {
      type: 'f',
      exclude: [...skipDirs].join(','),  // fd --exclude pattern
      // fd --glob mode for finding all files
    });
    if (result.success) {
      allFiles.push(...result.result);
    }
  }
  return allFiles;
}
```

### Example 3: ripgrep for Content Search in Convention Detection

```javascript
// In src/lib/conventions.js — replace safeReadFile + regex pattern
const { searchRipgrep } = require('./cli-tools');

// Instead of reading every .ex file and regex-testing for 'use Ecto.Schema':
const result = searchRipgrep('use Ecto\\.Schema', {
  paths: [cwd],
  maxCount: 1  // Only need to know if file matches
});
// result.result is array of { path, lineNumber, line }
```

### Example 4: jq for JSON Config Processing

```javascript
// Transform tool detection output
const { transformJson } = require('./cli-tools');

const result = transformJson(
  toolStatusJson,
  '[.[] | select(.available == true) | .name]',
  { compact: true }
);
// result.result = '["ripgrep","fd","jq"]' (or JS equivalent from fallback)
```

### Example 5: execFileSync Array Args Pattern (Already Established)

```javascript
// From src/lib/git.js — the project's established pattern for safe process spawning
const stdout = execFileSync('git', args, {
  cwd,
  stdio: 'pipe',
  encoding: 'utf-8',
});
// This is the SAME pattern used in all cli-tools wrappers — no shell, array args
```

## Integration Points — Detailed Inventory

### ripgrep Integration Points

These locations currently do file content search via `readFileSync` + regex:

| File | Function | Current Approach | Integration Notes |
|------|----------|-----------------|-------------------|
| `src/lib/conventions.js:349-449` | `extractPatterns()` (Phoenix) | Read each .ex file, regex test | Replace with single ripgrep search per pattern |
| `src/lib/deps.js:20-56` | `parseJavaScript()` et al. | Read file content, regex parse imports | ripgrep can pre-filter files containing imports |
| `src/commands/env.js:536-563` | `detectInfraServices()` | Read docker-compose, regex parse | ripgrep for service extraction |
| `src/commands/env.js:363-406` | `detectTestFrameworks()` | Read config files, check patterns | Small files — may not benefit from ripgrep |
| `src/commands/research.js` | Various search functions | Shell-based research tool calls | Lower priority — already uses external tools |

### fd Integration Points

These locations currently do recursive file discovery:

| File | Function | Current Approach | Integration Notes |
|------|----------|-----------------|-------------------|
| `src/lib/adapters/discovery.js:356-395` | `optimizedWalkSourceFiles()` | fast-glob + ignore matcher | **Primary target** — fd replaces this for large codebases |
| `src/lib/adapters/discovery.js:256-311` | `optimizedGetSourceDirs()` | fast-glob for initial scan | fd for top-level source dir detection |
| `src/lib/codebase-intel.js:57-60` | `walkSourceFiles()` | Delegates to discovery adapter | Benefits automatically when adapter uses fd |
| `src/lib/conventions.js:148-289` | `detectFileOrganization()` | Iterates intel.files keys | Uses pre-computed intel — no direct integration needed |

### jq Integration Points

These locations currently do JSON processing:

| File | Function | Current Approach | Integration Notes |
|------|----------|-----------------|-------------------|
| `src/commands/tools.js:73-85` | `cmdDetectTools()` | JS `Object.entries().map()` | jq filter for tool status extraction |
| `src/lib/codebase-intel.js:372-383` | `readIntel()` | `JSON.parse(content)` | jq for field extraction from large intel JSON |
| `src/commands/env.js:575` | `detectMcpServers()` | `JSON.parse` + key iteration | jq filter for mcpServers key extraction |
| `src/commands/verify.js:527+` | Config validation | `JSON.parse` + manual checks | jq for schema-like validation |
| `src/commands/trajectory.js:72+` | Entry parsing | `JSON.parse` + transforms | jq for trajectory data extraction |

**Note:** Many JSON operations are simple parse-and-access patterns where jq adds overhead without benefit. Focus jq integration on **complex transformations** — multi-step filters, aggregations, select/map chains — not simple `JSON.parse(file)`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `grep -r pattern .` | `rg --json pattern .` | ripgrep 11+ (2019) | 50x+ speed, structured output |
| `find . -name '*.js'` | `fd --glob '*.js'` | fd 7+ (2020) | 20x+ speed, .gitignore aware |
| `cat file.json \| python -c "..."` | `jq '.key' file.json` | jq 1.5+ (2015) | Standard JSON transform tool |
| `execSync('rg ' + pattern)` | `execFileSync('rg', [pattern])` | Node.js best practice | Zero shell injection risk |
| Manual .gitignore parsing | fd/rg built-in .gitignore | Native feature | No custom ignore code needed for search |

## Open Questions

1. **fd binary name on Ubuntu**: The fd.js wrapper calls `execFileSync('fd', ...)` — does it need to try `fdfind` as well? The detector resolves the path, but the wrapper hardcodes `'fd'`. May need to use the resolved path from detection.
2. **jq filter inventory**: What specific jq filters will be used? The JS fallback must implement each one. Need to catalog before implementation.
3. **Discovery adapter mode**: Should fd be a third mode alongside legacy/optimized, or replace the optimized path? The shadow-compare infrastructure suggests a third mode is cleaner.
4. **Config schema nesting**: Should tool toggles be `tools_ripgrep` (flat) or `tools.ripgrep` (nested)? CONFIG_SCHEMA supports nested lookups but flat keys are simpler.

## Sources

### Primary (HIGH confidence)
- **Phase 124 source code**: `src/lib/cli-tools/detector.js`, `fallback.js`, `ripgrep.js`, `fd.js`, `jq.js` — read directly
- **Phase 124 tests**: `tests/cli-tools.test.cjs` — 67 tests covering detection, caching, version parsing
- **Project codebase**: Direct inspection of all integration point files
- **CONTEXT.md**: User decisions from `/bgsd-discuss-phase` session

### Secondary (MEDIUM confidence)
- **ripgrep docs**: JSON output format, exit codes, .gitignore behavior
- **fd docs**: Default .gitignore respect, --exclude patterns, --glob mode
- **jq manual**: Filter syntax, streaming, error handling

### Tertiary (LOW confidence)
- **Performance claims**: "50x faster", "20x faster" — actual speedup varies by codebase size and disk I/O

## Metadata

**Confidence breakdown:**
- Tool wrapper API and integration pattern: HIGH (read source directly)
- Integration point identification: HIGH (grep'd and read all consumer files)
- Performance expectations: MEDIUM (depends on codebase size, disk I/O)
- jq filter coverage: MEDIUM (need to catalog actual filters during planning)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (tool APIs stable, codebase may evolve)
