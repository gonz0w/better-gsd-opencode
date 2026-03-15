# Phase 126: Extended Tools - Research

**Researched:** 2026-03-15
**Domain:** CLI tool integration (yq, bat, gh) into bgsd-tools workflows
**Confidence:** HIGH

## Summary

Phase 124 delivered the complete tool detection infrastructure and Phase 125 established the integration pattern: config toggles in `CONFIG_SCHEMA` → wire wrappers into consumer code → test suite. The yq, bat, and gh wrapper modules already exist in `src/lib/cli-tools/` with full implementations including fallback logic (yq, bat) or clear error-and-stop (gh). **None are wired into actual workflows yet.**

Phase 126's job is narrower and more concrete than Phase 125: add `tools_yq`, `tools_bat`, `tools_gh` config toggles to `CONFIG_SCHEMA` (following the exact pattern of `tools_ripgrep/fd/jq`), integrate yq into YAML-touching code paths, integrate bat into code/diff display output, wire gh into the `bgsd-github-ci` workflow via the wrapper module, and enforce the gh 2.88.0 version blocklist. The wrappers are done — this phase is purely about consumption and testing.

**Primary recommendation:** Follow the Phase 125 pattern exactly: Plan 01 adds config toggles + yq/bat integration into consumer code. Plan 02 wires gh into the CI workflow with version constraint. Plan 03 is the test suite. Each plan should have 2-3 tasks targeting specific files.

<user_constraints>

## User Constraints

These decisions from CONTEXT.md are **locked** — planner MUST honor them:

1. **Silent fallback for yq and bat** — No user-facing message when yq/bat unavailable and JS equivalent is used. The workflow just works. Users don't need to know which backend ran.
2. **Tool availability in health check** — Include tool availability status in `/bgsd-health` output. Already done (verify.js:665-699 shows `tool_availability` in health output). No new work needed here.
3. **gh CLI: clear error and stop** — When gh is missing or unauthenticated, display a clear error explaining what's missing and how to fix it, then abort the workflow. No partial completion. No JS fallback for GitHub operations.
4. **gh version constraint is hard** — If gh version is 2.88.0 exactly, treat it as if gh is not installed. Refuse to use it. Same error-and-stop behavior as missing gh.

</user_constraints>

<phase_requirements>

## Phase Requirements Mapping

| Requirement | Description | Key Acceptance Criteria |
|-------------|-------------|------------------------|
| TOOL-04 | yq integration | YAML config workflows use yq when available, JS fallback for simple ops |
| TOOL-05 | bat integration | Code display uses bat for syntax highlighting, fallback to plain text |
| TOOL-06 | GitHub CLI integration | CI workflows use gh when authenticated, graceful skip when not logged in |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yq (mikefarah/yq) | 4.44+ | YAML processing | Standard YAML processor, JSON output mode, pipe-friendly |
| bat | 0.24+ | Syntax-highlighted file display | cat alternative with syntax highlighting, line numbers, git integration |
| gh (GitHub CLI) | 2.88.1+ | GitHub operations | Official GitHub CLI for PR/issue management |
| Node.js child_process | Built-in | Process spawning | execFileSync with array args (zero shell injection) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing frontmatter.js | Built-in | YAML frontmatter parsing | Always (yq supplements, doesn't replace) |
| fs.readFileSync | Built-in | Plain text file reading | bat fallback for code display |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| yq for all YAML | yq for everything | Decision: Only use yq for complex YAML transforms. Keep frontmatter.js for plan/state files — it's custom-optimized and heavily tested |
| bat for all file output | bat everywhere | Decision: Only use bat where visual output matters (code display commands, diff display). Internal file reading stays as readFileSync |
| gh REST API fallback | GitHub REST API via fetch | Decision locked: no JS fallback for gh. Error-and-stop if missing |

## Architecture Patterns

### Pattern 1: Config Toggle (Phase 125 Established Pattern)

Add to `CONFIG_SCHEMA` in `src/lib/constants.js:56-59` (after existing tools_jq):

```javascript
tools_yq:  { type: 'boolean', default: true, description: 'Enable yq for YAML transformation', aliases: [], nested: { section: 'tools', field: 'yq' } },
tools_bat: { type: 'boolean', default: true, description: 'Enable bat for syntax highlighting',  aliases: [], nested: { section: 'tools', field: 'bat' } },
tools_gh:  { type: 'boolean', default: true, description: 'Enable gh for GitHub operations',     aliases: [], nested: { section: 'tools', field: 'gh' } },
```

No changes to `fallback.js` needed — `isToolEnabled()` already checks `config[tools_${toolName}]` generically. Adding these to CONFIG_SCHEMA makes `isToolEnabled('yq')` etc. work automatically.

### Pattern 2: gh Version Blocklist (New Pattern)

The gh CLI v2.88.0 has a confirmed regression: PR commands fail with `error: your authentication token is missing required scopes [read:project]`. This was a graceful degradation bug in scope error matching that was reverted in v2.88.1.

Implementation: In `src/lib/cli-tools/gh.js` or `src/lib/cli-tools/fallback.js`, add a version check before allowing gh operations:

```javascript
// In gh.js — add version validation 
const { meetsMinVersion, parseVersion, detectTool } = require('./detector');

function isGhUsable() {
  const detection = detectTool('gh');
  if (!detection.available) return { usable: false, reason: 'not_installed' };
  
  // Block exactly 2.88.0 (known regression)
  const version = parseVersion(detection.version);
  if (version && version.major === 2 && version.minor === 88 && version.patch === 0) {
    return { usable: false, reason: 'blocked_version', version: '2.88.0',
             message: 'gh 2.88.0 has a known regression with PR commands. Update to 2.88.1+: gh upgrade' };
  }
  
  return { usable: true };
}
```

Per CONTEXT.md: blocked version = same behavior as missing gh. Error-and-stop.

### Pattern 3: Integration Into Consumer Files

Following Phase 125's pattern, integration happens in the **consumer** files, not in the wrappers:

- **yq consumers**: Files that process YAML content (frontmatter extraction is excluded — it's custom-optimized)
- **bat consumers**: Files that display file content or diffs to users
- **gh consumers**: The github-ci workflow and agent

### Anti-Patterns to Avoid

- **Don't replace frontmatter.js with yq.** The custom YAML parser in `src/lib/frontmatter.js` is optimized for GSD planning files and has a parse cache. yq is for external/user YAML, not internal plan files.
- **Don't use bat for internal file reads.** bat is for display output only. Internal `readFileSync` calls that parse content should stay as-is.
- **Don't add partial gh fallback.** Per CONTEXT.md decision, gh operations either work fully or error-and-stop. No "show cached PR data" or "use REST API" fallback.
- **Don't check gh version on every invocation.** Cache the version check result in the 5-minute detection cache (already handled by detector.js).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom YAML parser for external files | yq with JS basic-parse fallback | yq handles all YAML edge cases (anchors, multi-doc, etc.) |
| Syntax highlighting | Custom ANSI color codes for code display | bat with `--style header,grid` | bat handles 200+ languages, themes, line numbering |
| Git diff coloring | Custom diff colorizer | bat with `--language diff` | bat natively renders unified diff format with colors |
| GitHub API calls | Raw `fetch` to api.github.com | gh CLI wrapper | gh handles auth tokens, pagination, rate limiting |
| Version blocklist | Manual string compare for 2.88.0 | `parseVersion()` from detector.js | Already tested, handles edge cases |

## Common Pitfalls

### Pitfall 1: yq Python vs Go Version Confusion
**What goes wrong:** There are TWO tools named yq — Python yq (`pip install yq`) and Go yq (`mikefarah/yq`). They have incompatible syntax.
**Why it happens:** The existing `yq.js` wrapper writes to temp files and uses expression syntax. Need to verify which yq variant it targets.
**How to avoid:** The existing wrapper in `src/lib/cli-tools/yq.js:59` uses `execFileSync('yq', ['.', tempFile])` — this is compatible with both Go yq (mikefarah/yq) and Python yq (kislyuk/yq), as `.` is a basic identity filter. However, more complex expressions may differ. The detection in detector.js doesn't distinguish variants. For Phase 126 integration, stick to basic yq expressions (`.key`, `.[] | .field`) that work in both variants, or detect the variant via `yq --version` output parsing (Go yq says "yq (https://github.com/mikefarah/yq/) version v4.x", Python yq says "yq x.x.x").
**Warning signs:** yq works on dev machine but fails on CI (different variant installed).

### Pitfall 2: bat Not Available in CI Environments
**What goes wrong:** bat typically not installed in Docker/CI environments. Tests that depend on bat output format will fail.
**Why it happens:** CI images are minimal — no syntax highlighting tools.
**How to avoid:** Tests must verify BOTH paths: bat available (mocked) and bat unavailable (fallback). Never assert on ANSI color codes in test output — assert on content presence.
**Warning signs:** Tests pass locally, fail in CI.

### Pitfall 3: gh Auth Status Check Timing
**What goes wrong:** `gh auth status` takes 500ms-2s due to network verification. Calling it on every gh operation causes visible latency.
**Why it happens:** gh auth status contacts GitHub API to verify token validity.
**How to avoid:** Check auth once at workflow start (the github-ci workflow already does this in Step 2). Cache the auth status for the duration of the workflow. Don't re-check before each individual gh command.
**Warning signs:** gh-backed operations feel sluggish despite being on a fast network.

### Pitfall 4: gh 2.88.0 Version Check Must Be Exact
**What goes wrong:** Version check blocks 2.88.x instead of exactly 2.88.0.
**Why it happens:** Sloppy version comparison (checking only major.minor).
**How to avoid:** Use `parseVersion()` and check all three components: `major === 2 && minor === 88 && patch === 0`. All other 2.88.x versions are fine.
**Warning signs:** Users on 2.88.1+ get blocked.

### Pitfall 5: bat --color=always Breaks JSON Parsing
**What goes wrong:** bat with `--color=always` embeds ANSI escape sequences. If output is captured and parsed (not displayed), the ANSI codes corrupt the data.
**Why it happens:** bat defaults to `--color=auto` which detects tty. But if explicitly set to `always`, it adds escapes even when piped.
**How to avoid:** Use `--color=auto` (the default in the bat.js wrapper). For diff display, let bat detect the terminal. Never pass bat output through JSON.parse or regex matching.
**Warning signs:** Garbled characters in programmatic bat output.

### Pitfall 6: Frontmatter.js Must NOT Be Replaced
**What goes wrong:** Replacing the custom YAML parser with yq breaks performance and caching.
**Why it happens:** Temptation to "use the better tool" for all YAML.
**How to avoid:** `src/lib/frontmatter.js` has a parse cache (`_fmCache`) and is optimized for the specific YAML subset used in PLAN.md, STATE.md, SUMMARY.md. It processes thousands of calls per session. yq spawns a process per call. Keep frontmatter.js for internal files; yq is for external/user YAML and complex transforms.
**Warning signs:** Performance regression on large projects with many plans.

## Code Examples

### Example 1: Config Toggle Addition

```javascript
// In src/lib/constants.js — add after tools_jq line 59
tools_yq:  { type: 'boolean', default: true, description: 'Enable yq for YAML transformation', aliases: [], nested: { section: 'tools', field: 'yq' } },
tools_bat: { type: 'boolean', default: true, description: 'Enable bat for syntax highlighting',  aliases: [], nested: { section: 'tools', field: 'bat' } },
tools_gh:  { type: 'boolean', default: true, description: 'Enable gh for GitHub operations',     aliases: [], nested: { section: 'tools', field: 'gh' } },
```

### Example 2: gh Version Blocklist

```javascript
// In src/lib/cli-tools/gh.js — add isGhUsable() function
const { detectTool, parseVersion } = require('./detector');

const BLOCKED_VERSIONS = [
  { major: 2, minor: 88, patch: 0, reason: 'PR commands fail with read:project scope error (reverted in 2.88.1)' }
];

function isGhUsable() {
  const detection = detectTool('gh');
  if (!detection.available) {
    return { usable: false, reason: 'not_installed', 
             message: 'GitHub CLI (gh) not found. Install from https://cli.github.com/' };
  }
  
  const version = parseVersion(detection.version);
  if (version) {
    for (const blocked of BLOCKED_VERSIONS) {
      if (version.major === blocked.major && version.minor === blocked.minor && version.patch === blocked.patch) {
        return { usable: false, reason: 'blocked_version', version: detection.version,
                 message: `gh ${blocked.major}.${blocked.minor}.${blocked.patch} has a known regression: ${blocked.reason}. Update: gh upgrade` };
      }
    }
  }
  
  return { usable: true, version: detection.version };
}
```

### Example 3: bat for Git Diff Display

```javascript
// In diff display code — enhance with bat
const { catWithHighlight, isBatAvailable } = require('../lib/cli-tools');

function formatDiffOutput(diffText, options = {}) {
  if (!isBatAvailable()) {
    return diffText; // Plain text fallback
  }
  
  // Write diff to temp file and display with bat
  const tmpFile = writeTempFile(diffText, '.diff');
  try {
    const result = catWithHighlight(tmpFile, {
      language: 'diff',
      style: 'numbers,grid',
      color: 'auto'
    });
    return result.success ? result.result : diffText;
  } finally {
    fs.unlinkSync(tmpFile);
  }
}
```

### Example 4: yq for Docker Compose YAML Processing

```javascript
// In env.js — enhance detectInfraServices() with yq
const { parseYAML, isYqAvailable } = require('../lib/cli-tools');

// Instead of regex-parsing docker-compose.yml for service names:
const yamlContent = fs.readFileSync(composeFile, 'utf8');
const parsed = parseYAML(yamlContent);
if (parsed.success && parsed.result && parsed.result.services) {
  services = Object.keys(parsed.result.services);
}
// parseYAML uses yq when available, falls back to basic JS parsing
```

### Example 5: gh Wrapper Usage in CI Workflow

```javascript
// In bgsd-github-ci agent integration
const { checkAuth, listPRs, isGhAvailable } = require('../lib/cli-tools');

// Pre-flight check (once per workflow)
const ghCheck = isGhUsable();
if (!ghCheck.usable) {
  return { error: ghCheck.message, action_required: 'install_gh' };
}

const authResult = checkAuth();
if (!authResult.success || !authResult.result.authenticated) {
  return { error: 'Not authenticated. Run: gh auth login', action_required: 'authenticate' };
}
```

## Integration Points — Detailed Inventory

### yq Integration Points

The codebase has limited YAML processing needs — most "YAML" files are actually plan/state frontmatter handled by the custom parser. Concrete integration points:

| File | Function | Current Approach | Integration Notes |
|------|----------|-----------------|-------------------|
| `src/commands/env.js:539-563` | `detectInfraServices()` | readFileSync + regex on docker-compose.yml | **Primary target**: parseYAML for structured service extraction instead of line-by-line regex |
| `src/commands/env.js:649-657` | pnpm-workspace.yaml parsing | readFileSync + basic parsing | parseYAML for extracting `packages` field |
| `src/commands/env.js:747+` | docker-compose port parsing | readFileSync + regex | parseYAML for structured port extraction |
| `src/commands/mcp.js:171` | Docker/env file detection | File existence check + basic read | Low priority — only reads file names, not YAML content |

**Important scope note:** `src/lib/frontmatter.js` and `src/plugin/parsers/plan.js` handle YAML-like frontmatter but are custom-optimized parsers with caching. Do NOT replace these with yq.

### bat Integration Points

bat is for **display output** — places where code/diff content is shown to users:

| File | Function | Current Approach | Integration Notes |
|------|----------|-----------------|-------------------|
| `src/lib/git.js:115-150` | `diffSummary()` | Returns structured JSON (numstat) | NOT a display function — leave as-is |
| `src/commands/features.js:19-78` | `cmdSessionDiff()` | Returns JSON commit data | Display wrapper could bat-highlight the diff output |
| `src/commands/misc.js:1608-1616` | `cmdRollbackInfo()` | diffSummary + structured output | Could add bat-enhanced diff view |
| `src/commands/misc.js:2130-2150` | Summary generation (diff view) | diffSummary data | Could add bat-enhanced diff display |
| `src/commands/codebase.js:232-261` | `groupChangedFiles()` | git diff --name-only | Returns data, not display — leave as-is |
| Workflow: `cmd-session-diff.md` | Session diff display | Agent formats git log output | Agent could use bat for diff highlighting |

**Primary integration approach**: Add a utility function `formatDiffWithBat(diffText)` in `src/lib/cli-tools/bat.js` or a new `src/lib/display.js` that bat-highlights unified diff text. Then integrate at the command output layer rather than deep in data functions.

### gh Integration Points

The gh CLI integration is focused on the github-ci workflow:

| File | Function | Current Approach | Integration Notes |
|------|----------|-----------------|-------------------|
| `workflows/github-ci.md:39-41` | Auth check | Direct `gh auth status` bash | **Replace**: Use `checkAuth()` from gh.js wrapper |
| `workflows/github-ci.md` (agent) | PR creation, check monitoring | Direct `gh pr create`, `gh pr checks` | **Add**: `createPR()`, `mergePR()` functions to gh.js, or keep as agent bash commands |
| `bgsd-github-ci.md:91-98` | PR create/list | Direct `gh pr list`, `gh pr create` bash | Agent calls gh directly — could use wrapper for pre-flight check |

**Key insight about gh integration scope**: The bgsd-github-ci agent is a **markdown prompt** that tells an LLM to run bash commands. The gh.js wrapper is a Node.js module. These don't naturally connect — the agent runs `gh` directly via bash, not through the wrapper. The integration path is:

1. **Pre-flight validation** (Node.js side): Before spawning the CI agent, run `isGhUsable()` + `checkAuth()` to validate gh is available, not blocked version, and authenticated. This happens in the workflow orchestrator (`workflows/github-ci.md` Step 2).
2. **Version blocklist** (Node.js side): The `isGhUsable()` function blocks 2.88.0 before the agent ever spawns.
3. **CLI commands** (bgsd-tools side): Add a `detect:gh-preflight` CLI command that the workflow can call to get a JSON result with `{ usable, authenticated, version, errors }`.

This approach avoids rewriting the agent's bash commands to use Node.js wrappers — the agent continues to call `gh` directly, but the orchestrator validates the environment first.

## gh 2.88.0 Regression — Details

**Bug:** gh v2.88.0 introduced a regression where PR commands (`gh pr list`, `gh pr create`, `gh pr view`, `gh pr checks`, `gh pr merge`) fail with:
```
error: your authentication token is missing required scopes [read:project]
To request it, run: gh auth refresh -s read:project
```

**Root cause:** A refactoring of scope error handling in `api/client.go` and project queries inadvertently broke the error matching that enabled graceful degradation when `read:project` scope was missing. Previously, missing `read:project` was silently skipped (project data omitted). After 2.88.0, it became a hard error.

**Fix:** v2.88.1 reverted both changes:
- Reverted "refactor: deduplicate scope error handling between api/client.go and project queries"
- Reverted "fix: clarify scope error while creating issues for projects"

**Impact on bgsd:** The bgsd-github-ci workflow uses `gh pr create`, `gh pr list`, `gh pr checks`, and `gh pr merge` — all affected. Users on 2.88.0 would get cryptic scope errors despite being properly authenticated.

**Enforcement strategy:** Check gh version before any gh operation. If exactly 2.88.0, return a clear error: "gh 2.88.0 has a known bug affecting PR commands. Please update: `gh upgrade` or `brew upgrade gh`."

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cat docker-compose.yml \| grep image:` | `yq '.services[].image' docker-compose.yml` | yq 4.0+ (2021) | Structured YAML query vs brittle regex |
| `cat file.js` | `bat --style header,grid file.js` | bat 0.12+ (2019) | Syntax highlighting, line numbers, git markers |
| `git diff \| less` | `git diff \| bat --language diff` | bat 0.15+ (2020) | 2-color diff with line numbers |
| `curl -H "Authorization: token $TOKEN" api.github.com/...` | `gh pr list --json ...` | gh 1.0+ (2020) | Built-in auth, pagination, JSON output |
| Manual version string comparison | `parseVersion()` + blocked list | Phase 124 (2026) | Tested semver comparison |

## Open Questions

1. **yq integration depth**: How many docker-compose.yml parsing locations justify yq vs keeping simple regex? There are 3-4 locations in env.js. The parseYAML wrapper makes this trivial — just replace `readFileSync + regex` with `parseYAML(content)`.

2. **bat display integration layer**: Should bat integration go into individual command functions, or create a shared display utility? Recommendation: Create `formatWithBat(content, language)` in bat.js as a convenience function, then call from command output paths.

3. **gh preflight CLI command**: Should the preflight check be a new `detect:gh-preflight` subcommand, or integrate into the existing `detect:tools` output? Recommendation: Add `isGhUsable()` export from gh.js and a `detect:gh-preflight` CLI command that the workflow calls.

4. **Agent bash commands vs wrapper**: The bgsd-github-ci agent calls `gh` directly via bash. Should we change it to use bgsd-tools commands instead? Recommendation: No — keep agent bash commands as-is. Only add pre-flight validation on the orchestrator side. The agent is an LLM prompt, not Node.js code.

## Sources

### Primary (HIGH confidence)
- **Phase 124/125 source code**: `src/lib/cli-tools/*.js` — all wrapper modules read directly
- **Phase 125 plan/research**: `.planning/phases/0125-core-tools-integration/` — established pattern
- **CONTEXT.md**: User decisions from `/bgsd-discuss-phase` session
- **Project codebase**: All consumer files inspected (env.js, misc.js, features.js, codebase.js, git.js, frontmatter.js, verify.js)
- **gh 2.88.1 release notes**: https://github.com/cli/cli/releases/tag/v2.88.1 — confirmed regression details
- **Existing test patterns**: `tests/cli-tools-integration.test.cjs` (511 lines, Phase 125 pattern)

### Secondary (MEDIUM confidence)
- **yq documentation**: Expression syntax compatibility between Go yq (mikefarah) and Python yq (kislyuk)
- **bat documentation**: `--language diff` for git diff display, `--style` options
- **gh CLI docs**: `gh auth status`, `gh pr` command family

### Tertiary (LOW confidence)
- **yq variant detection**: Whether the wrapper correctly handles both Go and Python yq — needs validation during testing

## Metadata

**Confidence breakdown:**
- Config toggle pattern: HIGH (exact copy of Phase 125)
- yq integration points: HIGH (inspected all YAML-touching code)
- bat integration points: HIGH (inspected all display/diff code)
- gh integration approach: HIGH (read workflow + agent, confirmed pre-flight pattern)
- gh 2.88.0 regression: HIGH (confirmed from official release notes)
- yq variant compatibility: MEDIUM (basic expressions work in both, complex may differ)

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (tool APIs stable, codebase may evolve)
