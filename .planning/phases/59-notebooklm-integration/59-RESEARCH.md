# Phase 59: NotebookLM Integration - Research

**Researched:** 2026-03-03
**Domain:** NotebookLM RAG synthesis via notebooklm-py CLI, auth management, fire-and-poll patterns
**Confidence:** MEDIUM (unofficial API — auth can break, output formats may change)

## Summary

Phase 59 integrates NotebookLM as the Tier 1 synthesis engine, enabling the research pipeline to create notebooks, load sources, ask grounded questions, and generate reports — all via the `notebooklm-py` CLI tool (by teng-lin). This is the highest-risk phase in v8.1 because notebooklm-py reverse-engineers Google's undocumented internal APIs using browser cookie authentication that expires every few weeks.

The existing codebase already has notebooklm-py detection (`detectCliTools()` checks both `notebooklm-py` and `nlm` binary names), tier calculation (`calculateTier()` requires `hasNlm` for Tier 1), and config path override (`config.nlm_path`). This phase adds the actual command wrappers that invoke the CLI and integrates results into the `research:collect` pipeline.

**Primary recommendation:** Build 4 new commands in `src/commands/research.js` following the established `execFileSync` subprocess pattern:
1. `research:nlm-create` — Create notebook, return notebook_id
2. `research:nlm-add-source` — Add URL/YouTube/text sources to a notebook
3. `research:nlm-ask` — Ask question against notebook sources, get grounded answer
4. `research:nlm-report` — Generate structured report (briefing doc, study guide)

Plus an auth health check function called before every NLM operation. Modify `research:collect` to add a Tier 1 stage that creates a session notebook, loads collected sources, and asks a synthesis question.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NLM-01 | Create NotebookLM notebook and add sources (URLs, YouTube, text, PDFs) via CLI commands | `notebooklm create` + `notebooklm source add` wrapped in execFileSync — see CLI Command Patterns |
| NLM-02 | Ask domain-specific questions against loaded notebook sources and receive grounded answers | `notebooklm ask "question" --json` returns answer + citations — see Ask Pattern |
| NLM-03 | Generate structured research reports (briefing docs, study guides) from notebook | `notebooklm generate report --type study-guide --json` — see Report Pattern |
| NLM-04 | Check auth health before every operation, provide clear re-auth instructions on failure | Auth health check via `notebooklm list --json` probe — see Auth Health Pattern |
</phase_requirements>

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `child_process` | built-in | `execFileSync` for subprocess calls | Established pattern from git.js, yt-dlp, collect |
| `src/commands/research.js` | current (~1300 lines) | Research command module | All research commands live here |
| `src/lib/output.js` | current | `output()` + `status()` | Standard output pattern |
| `src/lib/config.js` | current | `loadConfig()` for nlm_path | Established config pattern |
| `src/router.js` | current | Namespace routing | Established routing pattern |

### External Tool (User-Installed)

| Tool | Install | Purpose | Notes |
|------|---------|---------|-------|
| notebooklm-py | `pip install "notebooklm-py[browser]"` | NotebookLM API wrapper | Unofficial, cookie auth, may break. Binary names: `notebooklm` or `nlm` |
| Playwright + Chromium | `playwright install chromium` | Required for first-time `notebooklm login` | One-time setup, not needed after auth |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| notebooklm-py (teng-lin) | notebooklm-cli (jacob-bd, `nlm` binary) | Different project, uses browser-cookie3 instead of Playwright. Less maintained. notebooklm-py has 1.8k stars and active development. |
| notebooklm-py | pynotebooklm | Apache 2.0 licensed, 457 unit tests. However notebooklm-py is already in our detection code and config schema. Switching would require changing detectCliTools(). |
| CLI subprocess | Python API (async) | Would require bundling Python async code. GSD is a zero-dependency Node.js CLI — subprocess pattern is the standard. |
| NotebookLM | No synthesis (stay at Tier 2) | Tier 2 already works well. NotebookLM adds grounded synthesis quality but at cost of auth fragility and latency. |

**No new Node.js dependencies.** notebooklm-py is a user-installed Python tool called via subprocess.

## Architecture Patterns

### Pattern 1: NLM Binary Resolution

```javascript
// Reuse existing detectCliTools() which already checks notebooklm-py and nlm fallback
function getNlmBinary(cwd) {
  const cliTools = detectCliTools(cwd);
  const nlm = cliTools['notebooklm-py'];
  if (!nlm.available) {
    return { available: false, error: 'notebooklm-py not installed', install_hint: 'pip install "notebooklm-py[browser]" && playwright install chromium && notebooklm login' };
  }
  return { available: true, path: nlm.path || 'notebooklm' };
}
```

### Pattern 2: Auth Health Check (NLM-04)

**Problem:** notebooklm-py uses Google cookie auth that expires. Operations fail silently or with cryptic errors.
**Solution:** Run a lightweight probe before every NLM operation.

```javascript
function checkNlmAuth(nlmPath, timeout) {
  try {
    const stdout = execFileSync(nlmPath, ['list', '--json'], {
      encoding: 'utf-8', timeout: timeout || 10000, stdio: 'pipe'
    });
    // If list succeeds, auth is valid — parse returns array of notebooks
    JSON.parse(stdout);
    return { authenticated: true };
  } catch (err) {
    const msg = err.message || '';
    const isAuthError = msg.includes('auth') || msg.includes('cookie') || msg.includes('login') ||
                        msg.includes('401') || msg.includes('403') || msg.includes('session');
    return {
      authenticated: false,
      reason: isAuthError ? 'auth_expired' : 'unknown_error',
      message: isAuthError
        ? 'NotebookLM auth expired. Run: notebooklm login'
        : `NotebookLM check failed: ${msg.slice(0, 200)}`,
      reauth_command: 'notebooklm login',
    };
  }
}
```

**Key insight:** `notebooklm list --json` is the cheapest operation that validates auth. If it succeeds, cookies are valid. If it fails with auth-related errors, provide clear re-auth instructions.

### Pattern 3: Create Notebook + Add Sources (NLM-01)

```javascript
// notebooklm create "title" → outputs notebook info with ID
function nlmCreateNotebook(nlmPath, title, timeout) {
  const stdout = execFileSync(nlmPath, ['create', title, '--json'], {
    encoding: 'utf-8', timeout, stdio: 'pipe'
  });
  return JSON.parse(stdout); // { id: "notebook_id", title: "..." }
}

// notebooklm source add "url" → adds source to active notebook
// Must run `notebooklm use <id>` first to set active notebook
function nlmAddSource(nlmPath, notebookId, sourceUrl, timeout) {
  // Set active notebook
  execFileSync(nlmPath, ['use', notebookId], {
    encoding: 'utf-8', timeout, stdio: 'pipe'
  });
  // Add source
  const stdout = execFileSync(nlmPath, ['source', 'add', sourceUrl, '--json'], {
    encoding: 'utf-8', timeout, stdio: 'pipe'
  });
  return JSON.parse(stdout);
}
```

**Source types supported by notebooklm-py:**
- Web URLs: `notebooklm source add "https://example.com"`
- YouTube videos: `notebooklm source add "https://youtube.com/watch?v=xxx"`
- Local files (PDF, TXT, MD, DOCX): `notebooklm source add "./file.pdf"`
- Pasted text: Through the Python API (not CLI — skip for now)

### Pattern 4: Ask with Grounded Answers (NLM-02)

```javascript
// notebooklm ask "question" --json → grounded answer from sources
function nlmAsk(nlmPath, notebookId, question, timeout) {
  // Ensure correct notebook is active
  execFileSync(nlmPath, ['use', notebookId], {
    encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
  });
  const stdout = execFileSync(nlmPath, ['ask', question, '--json'], {
    encoding: 'utf-8', timeout, stdio: 'pipe'
  });
  return JSON.parse(stdout);
  // Expected: { answer: "...", references: [...] } or similar
}
```

**Fire-and-poll pattern:** For ask operations, `notebooklm ask` blocks until the answer is ready (typically 5-15 seconds). The `--json` flag ensures machine-readable output. No polling needed — the CLI handles the wait internally.

### Pattern 5: Report Generation (NLM-03)

```javascript
// notebooklm generate report --type study-guide --json
function nlmGenerateReport(nlmPath, notebookId, reportType, timeout) {
  execFileSync(nlmPath, ['use', notebookId], {
    encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
  });
  const stdout = execFileSync(nlmPath, ['generate', 'report', '--type', reportType, '--json'], {
    encoding: 'utf-8', timeout, stdio: 'pipe'
  });
  return JSON.parse(stdout);
}
```

**Report types available:** `briefing-doc`, `study-guide`, `blog-post`, or custom prompt.

### Pattern 6: Tier 1 Pipeline Integration

**What:** Modify `research:collect` to add a NotebookLM synthesis stage when at Tier 1.
**When:** After web + YouTube sources are collected, if notebooklm-py is available and authenticated.

```
Tier 1 Pipeline Flow:
  1. Collect web sources (existing)
  2. Collect YouTube sources (existing)
  3. NEW: Create temp NotebookLM notebook
  4. NEW: Load collected source URLs into notebook
  5. NEW: Ask synthesis question against loaded sources
  6. NEW: Include synthesis answer in agent_context alongside raw sources
  7. NEW: (Optional) Delete temp notebook after use
```

**Key decision:** The synthesis answer is added ALONGSIDE raw sources, not replacing them. The agent gets both the grounded synthesis AND the raw sources for verification.

### Anti-Patterns to Avoid

- **Don't assume auth is always valid.** Check before every operation. Cookie expiry is unpredictable.
- **Don't block on long operations without timeout.** Report generation can take 30-60s. Use `rag_timeout` budget.
- **Don't create notebooks without cleanup.** Pipeline-created notebooks should be tagged or deleted to avoid polluting the user's NotebookLM account.
- **Don't parse non-JSON CLI output.** Always use `--json` flag. Human-readable output formats will change between versions.
- **Don't make NotebookLM required.** Every NLM command must return a structured error and the pipeline must fall back to Tier 2 on any NLM failure.

## Common Pitfalls

### Pitfall 1: Auth Expiry Mid-Operation

**What goes wrong:** Auth check passes, but cookie expires during a long report generation.
**Why it happens:** Cookie TTL is unpredictable (hours to weeks).
**How to avoid:** Wrap each NLM subprocess call in try/catch. On auth-like errors, return structured fallback response. Never crash.
**Warning signs:** Intermittent failures, errors only during long operations.

### Pitfall 2: Notebook Pollution

**What goes wrong:** Pipeline creates dozens of temporary notebooks in user's account.
**Why it happens:** Creating notebooks for each `research:collect` invocation without cleanup.
**How to avoid:** Use a consistent naming convention (e.g., `[GSD] Research: <topic>`). Consider reusing recent notebooks for the same topic if they exist. Delete after synthesis or document the cleanup pattern.
**Warning signs:** User's NotebookLM account fills with auto-created notebooks.

### Pitfall 3: notebooklm-py Version Incompatibility

**What goes wrong:** CLI output format changes between versions. JSON parsing fails.
**Why it happens:** Unofficial API — no stability guarantees.
**How to avoid:** Validate JSON parse results defensively. Check for expected fields, don't assume schema. Log version in debug output.
**Warning signs:** JSON.parse errors, missing expected fields.

### Pitfall 4: Timeout Budget Exhaustion

**What goes wrong:** NLM operations consume entire rag_timeout, leaving no time for other stages.
**Why it happens:** NLM operations are slower (5-60s each) than web/YouTube searches (2-15s).
**How to avoid:** Allocate a fixed fraction of rag_timeout to NLM stage. E.g., if 3 stages share 30s, NLM gets 10s. If NLM times out, fall back to Tier 2 gracefully.
**Warning signs:** Pipeline consistently timing out at NLM stage.

### Pitfall 5: Source Loading Latency

**What goes wrong:** Adding multiple sources to a notebook takes 30s+ each.
**Why it happens:** NotebookLM processes each source (fetches URL, extracts text, indexes).
**How to avoid:** Limit sources added to notebook. For pipeline use: add top 2-3 URLs max. Web snippets are already in raw sources — only add YouTube URLs and key web pages.
**Warning signs:** Source addition takes >30s per source.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NLM binary detection | Custom PATH scanning | Existing `detectCliTools()` | Already handles `notebooklm-py` and `nlm` fallback + config override |
| Tier calculation | New tier logic | Existing `calculateTier()` | Already includes NLM in Tier 1 check |
| NLM auth | Cookie management | `notebooklm login` (user runs manually) | Auth is browser-based, handled by notebooklm-py's Playwright integration |
| Output formatting | Custom renderer | Existing `output()` + formatter pattern | Consistent with all other research commands |
| Progress messages | Custom progress | Existing `status()` | Writes to stderr, won't contaminate JSON |

## notebooklm-py CLI Reference (Key Commands)

| Command | Output (--json) | Timeout | Notes |
|---------|----------------|---------|-------|
| `notebooklm login` | Interactive (browser) | N/A | One-time setup, opens Chromium |
| `notebooklm list --json` | `[{id, title, ...}]` | 5-10s | Auth probe — cheapest validation |
| `notebooklm create "title" --json` | `{id, title, ...}` | 5-10s | Creates new notebook |
| `notebooklm use <id>` | Confirmation text | 1-2s | Sets active notebook context |
| `notebooklm source add "url" --json` | Source info | 10-60s | Processes source (fetch + index) |
| `notebooklm ask "question" --json` | `{answer, ...}` | 5-30s | Grounded answer from sources |
| `notebooklm generate report --type X --json` | Report content | 15-60s | briefing-doc, study-guide, blog-post |
| `notebooklm source list --json` | `[{id, title, type}]` | 3-5s | List sources in active notebook |

## Sources

### Primary (HIGH confidence)
- `src/commands/research.js` — Current implementation (1300 lines), all existing patterns
- `detectCliTools()` — Already detects notebooklm-py / nlm binary
- `calculateTier()` — Already checks `hasNlm` for Tier 1
- notebooklm-py GitHub (teng-lin/notebooklm-py) — CLI reference, 1.8k stars
- Context7 library docs (/teng-lin/notebooklm-py, benchmark 76.7)

### Secondary (MEDIUM confidence)
- notebooklm-py PyPI page — Install instructions, version info
- Medium article on notebooklm-py — Feature overview, auth patterns
- PleasePrompto/notebooklm-skill — Agent integration patterns

### Tertiary (LOW confidence)
- Exact `--json` output schemas (undocumented, may vary by version)
- Auth cookie TTL (varies by Google account settings)
- Rate limits (undocumented, likely generous for personal use)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — building entirely on existing patterns
- CLI integration: MEDIUM — notebooklm-py is well-documented but unofficial
- Auth handling: MEDIUM — cookie auth is inherently fragile
- Pipeline integration: HIGH — extending existing research:collect pattern
- Output schema: LOW — `--json` output format not formally documented

**Research date:** 2026-03-03
**Valid until:** 2026-03-15 (short validity — unofficial API may change)
