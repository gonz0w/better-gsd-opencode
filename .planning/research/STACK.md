# Technology Stack: v8.1 RAG-Powered Research Pipeline

**Project:** bGSD Plugin
**Researched:** 2026-03-02
**Focus:** yt-dlp for YouTube, NotebookLM API for synthesis, additional MCP servers, fallback RAG strategies
**Overall confidence:** MEDIUM-HIGH (NotebookLM integration has caveats; everything else is HIGH)

## Executive Summary

The v8.1 stack adds three new capability layers: (1) YouTube content discovery via yt-dlp, (2) RAG-based synthesis via Google NotebookLM, and (3) expanded MCP server discovery. The critical design constraint is **no new bundled dependencies** — all external tools (yt-dlp, Python, NotebookLM CLI) are invoked via `child_process.execFileSync` subprocess calls, matching the existing pattern for git operations. The tool must degrade gracefully when any external dependency is absent.

**Key finding: Two NotebookLM integration paths exist, and neither is ideal.** The official Google Cloud NotebookLM Enterprise API requires a Google Cloud project with Gemini Enterprise licensing (paid). The unofficial `notebooklm-py` (v0.3.2) uses reverse-engineered browser APIs — powerful but fragile and dependent on a personal Google account session. **Recommendation: Support both paths behind a unified interface**, with the unofficial library for personal/prototype use and the official API for enterprise deployments.

**yt-dlp is the clear winner for YouTube** — no separate YouTube search library needed. yt-dlp handles search (`ytsearch:` prefix), metadata extraction (`--dump-single-json --skip-download`), and subtitle/transcript extraction (`--write-sub --write-auto-sub --sub-format json3`) all in one tool. The Node.js wrapper `youtube-dl-exec` (v3.1.3) auto-installs the latest yt-dlp binary.

**VTT parsing should be built-in, not an npm dependency.** VTT format is trivially parseable (~30 lines of code) — regex strip timestamps, deduplicate lines. No need to add a library to a project that already has 309+ regex patterns.

## Recommended Stack

### YouTube: yt-dlp via youtube-dl-exec

| Technology | Version | Purpose | Why |
|---|---|---|---|
| youtube-dl-exec | ^3.1.3 | Node.js wrapper for yt-dlp binary | Auto-installs latest yt-dlp, Promise interface, subprocess control with timeout/kill, 602 stars, 7.2K dependents, MIT license, actively maintained (last release Feb 25, 2026) |
| yt-dlp (auto-installed) | latest (2025.x) | YouTube search, metadata, subtitle extraction | Feature-rich CLI, 100K+ GitHub stars, supports 1000+ sites, built-in YouTube search via `ytsearch:` prefix, JSON metadata output, subtitle extraction in multiple formats |

**Why NOT a separate YouTube search library:**

| Alternative | Verdict | Reason |
|---|---|---|
| **yt-dlp `ytsearch:`** | **USE THIS** | Built into yt-dlp — `ytsearch5:query` returns top 5 results with full metadata. No extra dependency. Already installed via youtube-dl-exec. |
| youtube-sr | NO | Scrapes YouTube HTML — fragile, breaks when YouTube changes layout. Unmaintained (last publish 2+ years ago). |
| ytsr | NO | Same HTML scraping approach. Deprecated, recommends yt-dlp instead. |
| YouTube Data API v3 | NO | Requires API key, quota limits (10,000 units/day), OAuth complexity. Overkill for search+metadata extraction. |

**Confidence: HIGH** — youtube-dl-exec API verified via Context7 (12 code snippets, High reputation). yt-dlp `ytsearch:` functionality confirmed via GitHub issues and documentation.

#### yt-dlp Key Commands for Research Pipeline

```javascript
const youtubedl = require('youtube-dl-exec');

// 1. SEARCH: Find YouTube videos by query
// Returns JSON array of video metadata (no download)
const searchResults = await youtubedl('ytsearch5:React Server Components tutorial 2025', {
  dumpSingleJson: true,
  flatPlaylist: true,    // Don't extract each video's full info
  noWarnings: true,
  noCheckCertificates: true,
});
// searchResults.entries = [{id, title, url, duration, view_count, upload_date, ...}, ...]

// 2. METADATA: Get full metadata for a specific video
const metadata = await youtubedl('https://www.youtube.com/watch?v=VIDEO_ID', {
  dumpSingleJson: true,
  skipDownload: true,    // Don't download the video
  noWarnings: true,
});
// metadata = {id, title, description, duration, view_count, like_count, 
//             channel, upload_date, tags, categories, subtitles, automatic_captions, ...}

// 3. TRANSCRIPT: Extract subtitles/transcript
// Must use .exec() and write to temp dir since subs are written to files
const subprocess = youtubedl.exec('https://www.youtube.com/watch?v=VIDEO_ID', {
  skipDownload: true,
  writeSub: true,        // Download manual subtitles
  writeAutoSub: true,    // Download auto-generated subtitles if no manual
  subLang: 'en',         // English subtitles
  subFormat: 'json3',    // Structured JSON format (has word-level timestamps)
  output: '/tmp/gsd-yt/%(id)s.%(ext)s',
});
```

#### Subtitle Format Comparison

| Format | Flag | Output | Best For |
|---|---|---|---|
| `json3` | `--sub-format json3` | JSON with word-level timestamps, events array | Programmatic processing, structured data for RAG |
| `vtt` | `--sub-format vtt` | WebVTT text with timestamps | Human-readable, simple parsing |
| `srt` | `--sub-format srt` | SubRip text with timestamps | Widespread compatibility |
| `srv3` | `--sub-format srv3` | YouTube's native XML format | Lossless preservation |

**Recommendation: Use `json3` for programmatic extraction.** It provides structured JSON that can be parsed without regex. For fallback, `vtt` is trivially parseable (strip timestamp lines, deduplicate overlapping cues).

#### VTT Parsing (Built-in, No Library Needed)

```javascript
// ~30 lines, zero dependencies — fits gsd-tools.cjs architecture
function parseVttToText(vttContent) {
  const lines = vttContent.split('\n');
  const seen = new Set();
  const textLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip metadata, timestamps, and empty lines
    if (!trimmed || trimmed === 'WEBVTT' || 
        trimmed.startsWith('Kind:') || trimmed.startsWith('Language:') ||
        trimmed.includes('-->') || /^\d+$/.test(trimmed)) continue;
    // Strip HTML tags (yt-dlp auto-subs have <c> tags)
    const clean = trimmed.replace(/<[^>]*>/g, '')
                         .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      textLines.push(clean);
    }
  }
  return textLines.join(' ');
}
```

**No VTT library needed.** The existing codebase has 309+ regex patterns. VTT parsing is simpler than markdown frontmatter extraction (which is already built-in). Libraries like `node-webvtt`, `subtitle`, or `@plussub/srt-vtt-parser` would add unnecessary bundle weight.

### NotebookLM: Dual-Path Integration

#### Path A: Unofficial API via notebooklm-py (Recommended for Personal Use)

| Technology | Version | Purpose | Why |
|---|---|---|---|
| notebooklm-py | ^0.3.2 | Python CLI + async API for Google NotebookLM | Full programmatic access: create notebooks, add sources (URLs, YouTube, text, PDFs), chat/query, generate reports. 2.4K GitHub stars, MIT license, active development (479 commits). |
| Python 3.10+ | >=3.10 | Runtime for notebooklm-py | Required dependency. Project already has Python check via yt-dlp (youtube-dl-exec requires Python 3.9+). |

**notebooklm-py capabilities relevant to research pipeline:**

| Feature | CLI Command | API Method |
|---|---|---|
| Create notebook | `notebooklm create "Research Topic"` | `client.notebooks.create("Topic")` |
| Add URL source | `notebooklm source add "https://..."` | `client.sources.add_url(nb_id, url)` |
| Add YouTube source | `notebooklm source add "https://youtube.com/..."` | `client.sources.add_url(nb_id, yt_url)` |
| Add text source | `notebooklm source add --text "content"` | `client.sources.add_text(nb_id, text)` |
| Query/Chat | `notebooklm ask "Summarize key themes"` | `client.chat.ask(nb_id, "question")` |
| Generate report | `notebooklm generate report` | `client.artifacts.generate_report(nb_id)` |
| Web research | `notebooklm research web "query"` | `client.research.web(nb_id, "query")` |

**Authentication:** Uses browser-based login (`notebooklm login` opens Chromium via Playwright, captures session cookies). Session persists in `~/.config/notebooklm-py/`. Requires initial interactive setup.

**Dependencies:** `httpx>=0.27.0`, `click>=8.0.0`, `rich>=13.0.0`. Browser login additionally requires `playwright>=1.40.0` + Chromium.

**⚠️ CRITICAL RISK:** This uses **undocumented Google APIs** reverse-engineered from the NotebookLM web UI. Google can change these endpoints without notice, breaking the library. Not suitable for production-critical workflows. Best for prototyping and personal research automation.

**Confidence: MEDIUM** — Library verified via GitHub (v0.3.2, pyproject.toml confirmed), PyPI confirmed. However, built on undocumented APIs that can break at any time.

#### Path B: Official Google Cloud NotebookLM Enterprise API

| Technology | Version | Purpose | Why |
|---|---|---|---|
| Google Cloud REST API | v1alpha (Preview) | Official NotebookLM Enterprise API | Google-supported, stable endpoints, proper auth via gcloud/service accounts |

**Official API capabilities (verified via Google Cloud docs, updated 2026-02-26):**

| Feature | REST Endpoint | Status |
|---|---|---|
| Create notebook | `POST .../notebooks` | Available |
| Add web source | `POST .../sources:batchCreate` with `webContent` | Available |
| Add YouTube source | `POST .../sources:batchCreate` with `videoContent` | Available |
| Add text source | `POST .../sources:batchCreate` with `textContent` | Available |
| Upload file (PDF, MD, DOCX) | `POST .../sources:uploadFile` | Available |
| Add Google Docs/Slides | `POST .../sources:batchCreate` with `googleDriveContent` | Available |
| Retrieve source metadata | `GET .../sources/{id}` | Available |
| Delete sources | `POST .../sources:batchDelete` | Available |
| Generate audio overview | Dedicated API endpoint | Available |
| Chat/Query | **NOT documented in official API** | Missing |
| Generate reports | **NOT documented in official API** | Missing |

**⚠️ CRITICAL GAP:** The official API does **not** expose chat/query functionality. You can create notebooks and add sources, but you cannot programmatically ask questions or get synthesized answers. This is a dealbreaker for RAG synthesis unless you pair it with Gemini API calls that reference the notebook's indexed content. The unofficial `notebooklm-py` fills this gap.

**Requirements:** Google Cloud project + Gemini Enterprise license + IAM role assignment. Auth via `gcloud auth print-access-token`. The `v1alpha` API is Preview status — may change.

**Confidence: HIGH for API availability, LOW for RAG synthesis** — Official docs verified directly (2026-02-26). The missing chat/query endpoint means the official API alone cannot perform research synthesis.

#### Integration Strategy: Node.js → Python Subprocess

```javascript
// Pattern: Match existing git execSync pattern in git.js
const { execFileSync } = require('child_process');

function notebooklmExec(args, options = {}) {
  try {
    const result = execFileSync('notebooklm', args, {
      encoding: 'utf8',
      timeout: options.timeout || 120000,  // 2 min default (API calls can be slow)
      ...options
    });
    return { success: true, output: result.trim() };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Create notebook and add research sources
notebooklmExec(['create', 'React 19 Research']);
notebooklmExec(['source', 'add', 'https://react.dev/blog/2024/12/05/react-19']);
notebooklmExec(['source', 'add', 'https://youtube.com/watch?v=VIDEO_ID']);
notebooklmExec(['source', 'add', '--text', transcriptContent]);

// Synthesize — the actual RAG query
const synthesis = notebooklmExec(['ask', 'Summarize the key architectural decisions and trade-offs']);
```

### MCP Servers for Developer Research

The project already integrates Brave Search and Context7 MCP servers. Additional servers worth considering for the research pipeline:

| MCP Server | Purpose | API Key Required | Recommendation |
|---|---|---|---|
| **Brave Search** (existing) | Web search, general research | Yes (free tier available) | **KEEP** — Already integrated, good for broad web search |
| **Context7** (existing) | Library documentation, code examples | No (free) | **KEEP** — Best-in-class for library-specific docs |
| **Exa** | Semantic search, research papers, personal sites | Yes (paid, $1/1000 searches) | **RECOMMEND** — Category-based search (research_paper, personal_site, company), semantic understanding, finds expert content that keyword search misses |
| **Perplexity Sonar** | Real-time web search with synthesis | Yes (paid, $5/1000 queries for sonar-small) | **OPTIONAL** — Redundant with Brave Search for basic search. `sonar-deep-research` model is powerful but expensive. Only add if budget allows. |
| **Microsoft Learn MCP** | Microsoft/Azure documentation | No (free, official) | **OPTIONAL** — Only if researching Microsoft stack. Not generally needed. |
| **Firecrawl** | Web scraping, content extraction | Yes (free tier: 500 credits/mo) | **DEFER** — Overlaps with existing WebFetch capability. Only needed for JavaScript-heavy sites that WebFetch can't render. |

**Recommendation: Add Exa MCP server.** It fills a gap between Brave Search (keyword-based) and Context7 (library-specific). Exa's semantic search with category filtering (`research_paper`, `personal_site`, `company`) is uniquely valuable for research pipelines that need expert opinions, academic papers, and authoritative technical blog posts.

**Exa MCP configuration:**
```json
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": ["-y", "exa-mcp-server"],
      "env": {
        "EXA_API_KEY": "YOUR_KEY"
      }
    }
  }
}
```

**Confidence: HIGH for recommendations** — MCP server landscape verified via multiple 2025-2026 comparison articles and official documentation. Exa verified via official docs and GitHub (exa-labs/exa-mcp-server).

### Fallback RAG: When NotebookLM Is Unavailable

If NotebookLM is not configured (no login, no enterprise API), the research pipeline needs a fallback. **The fallback is the current LLM-only approach** — no local RAG framework should be added.

| Fallback Option | Verdict | Reason |
|---|---|---|
| **Current LLM-only approach** | **USE THIS** | Existing gsd-project-researcher and gsd-phase-researcher already work without NotebookLM. Research quality degrades but pipeline doesn't break. Zero new dependencies. |
| Local RAG with embeddings (LangChain.js, EmbedJs) | NO | Requires vector database, embedding model downloads (~100MB+), async pipeline. Violates synchronous CLI design, bloats bundle, adds complex dependency chain. Fundamentally wrong architecture for a CLI tool. |
| SurfSense (open-source NotebookLM alternative) | NO | Full application, not a library. Requires Postgres, Redis, embedding models. Far too heavy for a CLI plugin. |
| Embrix (local embeddings) | NO | 384-dim embeddings via @xenova/transformers — adds ~50MB model download, async inference. Not suitable for CLI. |

**The project explicitly has "RAG / vector search — Wrong architecture for a CLI tool" in Out of Scope.** The v8.1 approach is to use NotebookLM *as an external service* for RAG, not to build RAG into the CLI. If NotebookLM is unavailable, fall back to LLM-only research (which already works).

**Confidence: HIGH** — This aligns with explicit architectural decisions documented in PROJECT.md.

## What NOT to Add

| Temptation | Why Resist |
|---|---|
| **youtube-sr / ytsr** | HTML scraping libraries that break when YouTube changes layout. yt-dlp's `ytsearch:` prefix does the same thing more reliably via YouTube's internal APIs. |
| **YouTube Data API v3** | Requires API key management, OAuth flows, quota tracking. yt-dlp provides everything needed without API keys. |
| **node-webvtt / subtitle.js** | VTT parsing is ~30 lines of regex. Adding a library for this in a project with 309+ regex patterns is architectural inconsistency. |
| **LangChain.js / LlamaIndex.js** | RAG framework for Node.js. Would require embedding models, vector store, async pipeline. Contradicts "single-file CLI" and "synchronous I/O" principles. |
| **Chromadb / Pinecone / pgvector** | Vector databases for RAG. Way too heavy for a CLI tool. NotebookLM handles the vector search externally. |
| **google-auth-library** | For NotebookLM Enterprise API auth. The official API uses `gcloud auth print-access-token` — just shell out to gcloud. No need for a Node.js auth library. |
| **Perplexity MCP (unless budget allows)** | Redundant with Brave Search for basic web search. The deep research model is powerful but at ~$5/1000 queries, it's expensive for a development tool. Exa provides better category-based search at lower cost. |
| **Firecrawl MCP** | Overlaps with existing WebFetch. Only needed for JS-rendered sites. Defer until a concrete need arises. |

## Dependencies Summary

### New Runtime Dependencies

| Package | Version | Bundle Impact | Install Impact | Required? |
|---|---|---|---|---|
| youtube-dl-exec | ^3.1.3 | 0KB (external, like better-sqlite3) | ~5MB in node_modules + downloads yt-dlp binary (~20MB) on postinstall | Optional — YouTube features disabled if absent |

### New External Tool Dependencies (Not npm)

| Tool | Install Method | Version | Required? |
|---|---|---|---|
| yt-dlp | Auto-installed by youtube-dl-exec | latest | Optional — auto-installed if youtube-dl-exec is present |
| Python 3.9+ | System package manager | >=3.9 | Optional — required for yt-dlp AND notebooklm-py |
| notebooklm-py | `pip install notebooklm-py` | ^0.3.2 | Optional — NotebookLM synthesis disabled if absent |
| Playwright + Chromium | `pip install 'notebooklm-py[browser]' && playwright install chromium` | >=1.40.0 | Optional — only for first-time notebooklm login |
| gcloud CLI | Google Cloud SDK installer | latest | Optional — only for NotebookLM Enterprise API path |

### No New Dev Dependencies

None.

### Existing Dependencies (Unchanged)

| Package | Version | Status |
|---|---|---|
| esbuild | ^0.27.3 | Keep — no changes needed |
| acorn | ^8.16.0 | Keep — no changes needed |
| tokenx | ^1.3.0 | Keep — no changes needed |

### MCP Server Recommendations (User-Configured, Not Project Dependencies)

| MCP Server | npm Package | Config Required |
|---|---|---|
| Brave Search | Already configured | BRAVE_API_KEY env var |
| Context7 | Already configured | None |
| Exa (NEW) | `exa-mcp-server` (npx) | EXA_API_KEY env var |

## Installation

```bash
# Core: YouTube capabilities (Node.js dependency)
npm install youtube-dl-exec

# Verify yt-dlp works
npx youtube-dl-exec --version

# Optional: NotebookLM integration (Python dependency)
pip install "notebooklm-py[browser]"
playwright install chromium
notebooklm login  # Interactive, opens browser

# Optional: NotebookLM Enterprise (Google Cloud)
# Requires: Google Cloud project with Gemini Enterprise license
gcloud auth login --enable-gdrive-access
```

### build.js Changes

```javascript
// Add to external array in esbuild.build()
external: [
  // ... existing externals ...
  'youtube-dl-exec'  // Native binary wrapper — cannot/should not be bundled
],
```

### Graceful Degradation Detection

```javascript
// src/lib/research-tools.js — detect available tools at startup
function detectResearchTools() {
  const tools = { ytdlp: false, notebooklm: false, notebooklmEnterprise: false };
  
  try {
    require.resolve('youtube-dl-exec');
    tools.ytdlp = true;
  } catch {}
  
  try {
    execFileSync('notebooklm', ['--version'], { encoding: 'utf8', timeout: 5000 });
    tools.notebooklm = true;
  } catch {}
  
  try {
    execFileSync('gcloud', ['--version'], { encoding: 'utf8', timeout: 5000 });
    tools.notebooklmEnterprise = true;  // May still need license check
  } catch {}
  
  return tools;
}
```

## Integration Architecture (Informing ARCHITECTURE.md)

### Research Pipeline Flow

```
Research Query (from gsd-project-researcher or gsd-phase-researcher)
    │
    ├─► [Brave Search MCP] ──► Web results (URLs, snippets)
    ├─► [Context7 MCP] ──► Library docs, code examples
    ├─► [Exa MCP] ──► Semantic search, expert content, papers
    ├─► [yt-dlp] ──► YouTube search → metadata + transcripts
    │
    ▼
[Source Collection] ──► Collated URLs, text content, transcripts
    │
    ▼
┌─────────────────────────────────┐
│ NotebookLM Available?           │
│   YES → Create notebook,       │
│          add sources,           │
│          query for synthesis    │
│   NO  → Pass raw sources to    │
│          LLM for synthesis      │
│          (current behavior)     │
└─────────────────────────────────┘
    │
    ▼
[Synthesis Output] ──► Research files (.planning/research/*.md)
```

### Subprocess Call Pattern

All external tool invocations follow the same pattern as `src/lib/git.js`:

```javascript
// Unified pattern: execFileSync with timeout, encoding, error handling
function callExternalTool(binary, args, options = {}) {
  const { timeout = 30000, cwd = process.cwd() } = options;
  try {
    return {
      success: true,
      output: execFileSync(binary, args, { 
        encoding: 'utf8', timeout, cwd,
        maxBuffer: 10 * 1024 * 1024  // 10MB for large metadata/transcripts
      }).trim()
    };
  } catch (e) {
    debugLog('research', `${binary} failed: ${e.message}`);
    return { success: false, error: e.message, code: e.status };
  }
}
```

## Python Dependency Implications

The project already implicitly depends on Python through `youtube-dl-exec` (which requires Python 3.9+ for yt-dlp). Adding `notebooklm-py` extends this to Python 3.10+.

| Concern | Mitigation |
|---|---|
| Users without Python | Graceful degradation — YouTube and NotebookLM features disabled, research falls back to LLM-only |
| Python version conflicts | Both yt-dlp and notebooklm-py work with Python 3.10+. Document minimum as 3.10. |
| pip/venv management | Recommend `pipx install notebooklm-py` for isolated install. Or `uv tool install notebooklm-py` (notebooklm-py uses uv for development). |
| Playwright/Chromium bloat | Only needed for first-time login. Can use `pip install notebooklm-py` without `[browser]` extra if user authenticates manually via environment variables. |

**Recommendation:** Add a `gsd-tools util:check-research-tools` command that reports which optional research tools are available, with install instructions for missing ones.

## NotebookLM API Comparison Matrix

| Capability | notebooklm-py (Unofficial) | NotebookLM Enterprise API (Official) |
|---|---|---|
| **Auth** | Browser login (Playwright) | gcloud service account |
| **Create notebook** | ✅ | ✅ |
| **Add URL source** | ✅ | ✅ |
| **Add YouTube source** | ✅ | ✅ (via videoContent) |
| **Add text source** | ✅ | ✅ |
| **Add PDF/files** | ✅ | ✅ |
| **Chat/Query** | ✅ | ❌ Not in API |
| **Generate report** | ✅ | ❌ Not in API |
| **Web research** | ✅ (fast/deep modes) | ❌ Not in API |
| **Source fulltext** | ✅ | ❌ Not documented |
| **Cost** | Free (Google account) | Gemini Enterprise license |
| **Stability** | LOW — undocumented APIs | MEDIUM — v1alpha Preview |
| **Rate limits** | Undocumented, may be throttled | Enterprise quotas |

**Bottom line:** For our RAG synthesis use case (add sources → query → get synthesis), only `notebooklm-py` provides the chat/query capability. The official API is useful for source management but cannot perform the actual research synthesis step.

## Sources

| Source | Type | Confidence | Key Finding |
|---|---|---|---|
| [youtube-dl-exec Context7 docs (v3.x)](https://github.com/microlinkhq/youtube-dl-exec) | Context7 | HIGH | `dumpSingleJson`, `skipDownload`, subprocess control, Promise interface |
| [youtube-dl-exec GitHub (v3.1.3)](https://github.com/microlinkhq/youtube-dl-exec/releases/tag/v3.1.3) | GitHub | HIGH | Latest release Feb 25, 2026. 602 stars, MIT license. Requires Python 3.9+. |
| [yt-dlp Wiki/Docs (Context7)](https://github.com/yt-dlp/yt-dlp) | Context7 | HIGH | `ytsearch:` prefix, subtitle formats, rate limiting guidance |
| [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp) | GitHub | HIGH | Subtitle formats: json3, vtt, srt, srv3. `--skip-download --write-info-json` for metadata-only |
| [yt-dlp issue #9371](https://github.com/yt-dlp/yt-dlp/issues/9371) | GitHub | HIGH | `--write-sub --write-auto-sub --sub-lang en` subtitle extraction patterns |
| [notebooklm-py GitHub (v0.3.2)](https://github.com/teng-lin/notebooklm-py) | GitHub | MEDIUM | Full API: create, sources, chat, artifacts. Uses undocumented Google APIs. 2.4K stars, MIT. |
| [notebooklm-py pyproject.toml](https://github.com/teng-lin/notebooklm-py/blob/main/pyproject.toml) | GitHub | HIGH | Version 0.3.2, Python >=3.10, deps: httpx, click, rich. Optional: playwright for browser login. |
| [Google Cloud NotebookLM Enterprise API](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks) | Official docs | HIGH | v1alpha Preview. Create/list/delete notebooks, share. Updated 2026-02-26. |
| [Google Cloud NotebookLM Sources API](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks-sources) | Official docs | HIGH | Add sources: webContent, videoContent, textContent, Google Drive, file upload. No chat/query endpoint. |
| [Exa MCP Server](https://github.com/exa-labs/exa-mcp-server) | GitHub | HIGH | Semantic search with categories (research_paper, personal_site). Code search via exa-code. |
| [Perplexity MCP Server](https://github.com/perplexityai/modelcontextprotocol) | GitHub | HIGH | Official Perplexity MCP. Sonar models for real-time web search. Paid API. |
| [Best MCP Servers 2026 (Builder.io)](https://www.builder.io/blog/best-mcp-servers-2026) | Web article | MEDIUM | MCP landscape comparison — Exa for semantic, Tavily for RAG, Brave for broad search |
| [MCP Benchmark 2026 (AIMultiple)](https://aimultiple.com/browser-mcp) | Web article | MEDIUM | Benchmarked 8 MCP servers — Exa highest success rate for search & extraction |
| [SurfSense (NotebookLM alternative)](https://github.com/Decentralised-AI/SurfSense-Open-Source-Alternative-to-NotebookLM) | GitHub | LOW | 2-tier RAG, 6000+ embedding models. Too heavy for CLI integration. |
| [EmbedJs (Node.js RAG)](https://github.com/llm-tools/embedJs) | GitHub | LOW | Node.js RAG framework. Async, requires vector DB. Wrong architecture for CLI. |
