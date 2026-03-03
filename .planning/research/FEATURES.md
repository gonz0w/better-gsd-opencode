# Feature Landscape: RAG-Powered Research Pipeline

**Domain:** Developer research automation with RAG-based synthesis
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH (NotebookLM API is unofficial/unstable; yt-dlp and content source APIs are well-documented)

<!-- section: compact -->
<features_compact>
<!-- Compact view for planners. Keep under 30 lines. -->

**Table stakes (must have):**
- YouTube search + metadata extraction via yt-dlp (ytsearch, `--dump-json`, no download)
- YouTube transcript extraction via yt-dlp (`--write-auto-subs` + `--skip-download`)
- NotebookLM notebook creation + multi-source ingestion (URLs, YouTube, text) via notebooklm-py
- NotebookLM chat/query for research synthesis (ask questions, get cited answers)
- Research orchestration: Brave Search → Context7 → YouTube → NotebookLM → structured output
- Graceful degradation: every RAG tool optional, fallback to current LLM-only research
- Configuration: API credentials and tool availability in config.json, runtime detection

**Differentiators:**
- NotebookLM report generation (briefing docs, study guides) for structured research output
- Source quality scoring: filter YouTube results by view count, recency, duration, channel authority
- Research caching: store NotebookLM notebook IDs + synthesis results in SQLite cache
- MCP server discovery: detect available research MCPs and recommend missing ones

**Anti-features (explicitly avoid):**
- Building a local vector store / embedding pipeline (wrong architecture for CLI)
- Scraping YouTube without yt-dlp (fragile, ToS risk)
- Direct Google API integration for NotebookLM (no official API exists; notebooklm-py uses undocumented RPCs)
- Real-time content monitoring / watch mode (CLI is short-lived)

**Key dependencies:** Existing Brave Search MCP, Context7 MCP, gsd-project-researcher × 4, gsd-phase-researcher, research/ output directory, SQLite L1/L2 cache from v8.0
</features_compact>
<!-- /section -->

<!-- section: feature_landscape -->
## Feature Landscape

### Table Stakes (Must Work For MVP)

Features users expect when "RAG-powered research" is promised. Missing any = pipeline feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **YouTube search via yt-dlp** | Developers learn from conference talks, library demos, architecture discussions — YouTube is the largest video content source for developer education | MEDIUM | Use `ytsearchN:<query>` with `--dump-json --flat-playlist --no-download`. Returns title, duration, view_count, upload_date, channel, video_id. N controls result count (e.g., `ytsearch10`). yt-dlp is a CLI binary — call via `execFileSync` or `youtube-dl-exec` npm wrapper. |
| **YouTube transcript extraction** | Transcripts are the actual research content — video metadata alone is insufficient for synthesis | MEDIUM | Use `--write-auto-subs --sub-lang en --skip-download --convert-subs srt`. Most tech talks have auto-generated English subtitles. Parse SRT to plain text (strip timestamps). For videos with manual captions, prefer those (`--write-subs`). |
| **YouTube result filtering** | Not all YouTube content is useful — need to filter by relevance signals before expensive transcript extraction | LOW | Filter by: duration (10-60min for talks, 5-30min for tutorials), view_count (>1K for relevance), upload_date (prefer last 2 years), channel reputation (known conference channels). Implement as configurable match_filter. |
| **NotebookLM notebook creation + source ingestion** | NotebookLM is the RAG engine — it needs sources loaded before it can synthesize | HIGH | Use `notebooklm-py` Python library. Create notebook per research session. Add sources: `add_url()` for web pages, `add_youtube()` for video URLs, `add_text()` for plain text (transcripts, search results). **Critical:** notebooklm-py is async Python, but bGSD is sync Node.js — must shell out to a Python helper script. |
| **NotebookLM chat-based synthesis** | The RAG value: ask domain-specific questions and get grounded, cited answers from loaded sources | HIGH | Use `client.chat.ask(notebook_id, question)` with source-restricted queries. Configure with `ChatGoal.CUSTOM` and a custom prompt tuned for developer research. Responses include citation references back to specific sources. |
| **Research orchestration layer** | Sources must be collected from multiple tools and fed into NotebookLM in the right order | HIGH | Pipeline: (1) Brave Search → top URLs, (2) Context7 → library docs, (3) yt-dlp → YouTube transcripts, (4) All fed into NotebookLM notebook, (5) Chat queries extract structured findings, (6) Output to research/ markdown files. Orchestrator lives in gsd-tools.cjs as a new command. |
| **Graceful degradation** | Not all users will have yt-dlp installed, NotebookLM credentials, or Brave Search API key — research must still work | MEDIUM | Feature detection at startup: check for `yt-dlp` binary, `notebooklm` CLI / Python, Brave MCP, Context7 MCP. Missing tools → skip that source, warn user, continue with available tools. If ALL RAG tools missing → fall back to current LLM-only researcher agent behavior (no regression). |
| **Configuration for RAG tools** | Users need to configure credentials and preferences without editing code | LOW | Extend `config.json` with `research` section: `{ "research": { "youtube": { "enabled": true, "max_results": 10, "min_views": 1000 }, "notebooklm": { "enabled": true }, "brave_search": { "enabled": true } } }`. Runtime detection overrides config if tool not found. |

### Differentiators (Competitive Advantage)

Features that make the research pipeline impressive, not strictly required for basic function.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **NotebookLM report generation** | Generate structured briefing docs and study guides from loaded sources — better than raw chat Q&A | MEDIUM | Use `client.artifacts.generate_report(notebook_id, type="briefing-doc")` or `type="study-guide"`. Produces well-structured markdown. Limit: 10/day on free tier, 100/day on Pro. Could replace significant LLM synthesis work. |
| **Source quality scoring** | Automatically rank and filter content before loading into NotebookLM — reduces noise, improves synthesis quality | MEDIUM | Score YouTube results on: (1) view_count normalized, (2) like_ratio if available, (3) channel subscriber count, (4) upload recency, (5) duration appropriateness for content type, (6) title keyword relevance. Score web results on: domain authority, content freshness. Top-N sources loaded into NotebookLM. |
| **Research caching in SQLite** | Avoid re-running expensive research for the same topic — cache notebook IDs, transcripts, synthesis results | MEDIUM | Extend v8.0 SQLite cache with `research_cache` table: key = hash(query + sources), value = NotebookLM notebook_id + synthesis results. TTL-based expiry (research stales over weeks, not hours). Allows resuming research sessions. |
| **MCP server discovery for research** | Detect which research MCPs are available and recommend missing ones | LOW | Extend existing MCP profiling (v4.0) to flag research-relevant servers: Brave Search, Context7, future YouTube MCP, etc. `gsd-tools mcp research-status` shows what's configured, what's missing, and how to add it. |
| **Parallel source collection** | Collect from Brave, Context7, and YouTube simultaneously to reduce wall-clock research time | MEDIUM | Use `Promise.all` (or parallel `execFileSync` with worktree patterns) to run source collection concurrently. Brave Search + Context7 are MCP calls (fast), YouTube search + transcript is yt-dlp (slower). Parallelize the fast sources while YouTube processes. |
| **Research session persistence** | Save and resume research sessions — don't lose work if process interrupted | LOW | Write `.planning/research/.session.json` with: notebook_id, collected sources, pending queries, completion status. On resume, skip already-collected sources and continue where left off. |
| **NotebookLM source guide extraction** | Get AI-generated summary + keywords for each loaded source — provides source-level understanding before synthesis | LOW | Use `client.sources.get_guide(notebook_id, source_id)` after source is ready. Returns summary + keywords. Useful for filtering which sources to query against. |
| **Structured research output templates** | Map NotebookLM synthesis to specific research document structures (STACK.md, FEATURES.md, etc.) | MEDIUM | Configure NotebookLM chat with role-specific custom prompts: "You are analyzing technology stacks for a software project. Focus on..." Different prompt per research dimension (stack, features, architecture, pitfalls). Output parsed into bGSD research markdown templates. |

### Anti-Features (Explicitly Do NOT Build)

Features that seem logical but create problems in bGSD's architecture or violate constraints.

| Anti-Feature | Why Tempting | Why Problematic | What To Do Instead |
|--------------|-------------|-----------------|-------------------|
| **Local vector store / embeddings** | "RAG needs vectors" | PROJECT.md explicitly lists "RAG / vector search" as out of scope. bGSD is a CLI tool, not a search engine. Embedding models add ~500MB+ dependencies. Vector DBs need persistent processes. NotebookLM IS the vector store — let Google handle the embeddings. | Use NotebookLM as the RAG engine. It already has embeddings, vector search, and grounding built in. |
| **Custom YouTube scraper** | "yt-dlp is a big dependency" | YouTube changes its HTML/API constantly. Any custom scraper breaks within weeks. yt-dlp has 600+ contributors maintaining extraction. Reinventing this is a maintenance nightmare. | Use yt-dlp binary. It's available via pip/brew/apt and handles all YouTube extraction edge cases. |
| **Direct Google internal API calls** | "Skip notebooklm-py, call Google APIs directly" | NotebookLM has NO official public API. notebooklm-py reverse-engineers undocumented Protobuf RPCs. Building our own would duplicate their work and double the maintenance burden when Google changes endpoints. | Use notebooklm-py as the abstraction layer. It handles auth, CSRF tokens, session management, and API changes. |
| **Real-time content monitoring** | "Watch for new content and auto-update research" | CLI tool is invoked on-demand. No daemon process. File watching would require persistent process, defeating single-invocation architecture. | Research is point-in-time. Run `/bgsd-research-phase` again if you need updated findings. |
| **Audio/video download and processing** | "Download YouTube videos for analysis" | Massive storage requirements. Video/audio analysis needs ffmpeg + ML models. Way outside scope. The transcript IS the content for developer research. | Extract transcripts only (`--skip-download`). Text is what matters for research synthesis. |
| **Replacing existing researcher agents** | "NotebookLM should replace gsd-project-researcher" | Existing researchers work WITHOUT any external dependencies. They produce reliable output with just the LLM. NotebookLM adds quality but introduces fragility (unofficial API, Google account dependency, rate limits). | Enhance existing researchers with RAG data when available. Researchers remain the authoritative output producers; RAG provides better source material. |
| **Stack Overflow API integration** | "SO has great Q&A data" | SO API has strict rate limits (300 requests/day without key), requires registration, and SO content quality has declined significantly since 2023 (AI-generated answers, reduced expert participation). The best SO content is already indexed by Google/Brave Search anyway. | Brave Search naturally surfaces relevant SO answers. No direct API integration needed. |
| **GitHub Discussions scraping** | "Project-specific discussions are valuable" | GitHub Discussions are project-specific, not ecosystem-wide. Would need to know which repos to search. API requires GraphQL, authentication, and pagination. Content is often niche and incomplete. | Brave Search and Context7 already surface GitHub content when relevant. |
<!-- /section -->

<!-- section: content_sources -->
## Content Source Analysis

### YouTube Content Types for Developer Research

Research into what YouTube content is most valuable for developer research workflows:

| Content Type | Value for Research | Typical Duration | Signal Quality | Examples |
|-------------|-------------------|------------------|----------------|----------|
| **Conference talks** (GOTO, NDC, Strange Loop, JSConf) | **HIGHEST** — Expert speakers, peer-reviewed content, architectural depth | 30-60 min | Very high — curated by conference organizers | "Scaling Microservices at Netflix" (GOTO), "The Art of Destroying Software" (Vimeo/conf) |
| **Library author demos** | **HIGH** — Authoritative source, shows intended usage patterns | 15-45 min | High — straight from the creator | React Server Components by Dan Abramov, Svelte by Rich Harris |
| **Architecture discussions** | **HIGH** — System design patterns, trade-off analysis | 20-60 min | High when from recognized practitioners | Martin Fowler, Sam Newman, Kelsey Hightower talks |
| **Tutorial walkthroughs** | **MEDIUM** — Good for "how to do X" but variable quality | 10-30 min | Medium — depends heavily on creator quality | Traversy Media, Fireship, ThePrimeagen |
| **Comparison/review videos** | **MEDIUM** — "X vs Y" format, useful for technology evaluation | 10-20 min | Medium — often opinionated, may lack depth | Fireship "X in 100 Seconds", tech comparison channels |
| **Podcast episodes** | **LOW** for research — conversational, hard to extract structured data | 60-120 min | Low — lots of filler, opinions over facts | Syntax.fm, JS Party, etc. |
| **Clickbait/listicle videos** | **AVOID** — "Top 10 frameworks in 2025" style content | 5-15 min | Very low — shallow, SEO-driven | Generic "best X" videos |

**Recommendation for search strategy:**
1. Search with technical terms + "conference talk" or "deep dive" modifiers
2. Filter for 10-60 minute duration (excludes shorts and podcasts)
3. Prefer channels: GOTO Conferences, NDC Conferences, Strange Loop, JSConf, InfoQ, Google Developers, AWS re:Invent
4. Require >5K views for conference talks, >10K for tutorials (quality signal)
5. Prefer uploads within last 24 months

**Confidence:** MEDIUM (based on web search of developer education landscape; no quantitative study found)

### NotebookLM as RAG Engine

**How NotebookLM works for research (verified via official docs + notebooklm-py Context7):**

**Input:**
- Up to 50 sources per notebook (free tier), 100-600 on paid tiers
- Each source up to 500,000 words or 200MB for uploads
- Supported source types: URLs, YouTube videos, PDF, TXT, MD, DOCX, Google Drive files, pasted text
- YouTube sources are automatically transcribed by NotebookLM (no separate transcript extraction needed for NotebookLM — but we still want yt-dlp transcripts for non-NotebookLM fallback path)

**Processing:**
- Sources are indexed with embeddings (handled by Google internally)
- AI-generated summary + keywords per source (`get_guide()`)
- Full-text retrieval available (`get_fulltext()`)

**Output / Synthesis:**
- Chat Q&A with citations back to specific sources and passages
- Configurable chat modes: learning guide, custom goal, response length control
- Report generation: briefing docs, study guides, blog posts, custom types
- Deep research mode: autonomous web/Drive search with auto-import (10/month free, up to 200/day Ultra)

**Rate Limits (verified from official Google support page):**

| Tier | Notebooks | Sources/Notebook | Chats/Day | Reports/Day | Deep Research |
|------|-----------|-----------------|-----------|-------------|---------------|
| Free | 100 | 50 | 50 | 10 | 10/month |
| Plus | 200 | 100 | 200 | 20 | 3/day |
| Pro | 500 | 300 | 500 | 100 | 20/day |
| Ultra | 500 | 600 | 5,000 | 1,000 | 200/day |

**Latency expectations:**
- Source ingestion: 5-30 seconds per source (depends on size; YouTube may take longer for transcript processing)
- Chat query: 3-10 seconds per question
- Report generation: 15-60 seconds
- Deep research: 1-5 minutes

**Critical risk: notebooklm-py uses UNDOCUMENTED Google APIs.**
- Authentication via browser cookies (not OAuth/API key)
- Session cookies expire every few weeks — requires re-login
- Google could change internal endpoints at any time (breaking changes)
- Heavy automated usage could flag the Google account
- MIT licensed, 2.4K GitHub stars, actively maintained (479 commits, 6 releases as of Jan 2026)

**Confidence:** HIGH for limits/capabilities (verified via official Google support docs), MEDIUM for API stability (unofficial library risk)

### Other Developer Content Sources Evaluated

| Source | API Quality | Value for Dev Research | Integration Effort | Recommendation |
|--------|------------|----------------------|-------------------|----------------|
| **Brave Search** | Good (MCP already integrated) | HIGH — web-wide coverage, less SEO spam | Already done | **KEEP** — primary web search |
| **Context7** | Good (MCP already integrated) | HIGH — versioned library docs, code examples | Already done | **KEEP** — primary library docs |
| **YouTube (via yt-dlp)** | Excellent (battle-tested CLI) | HIGH — conference talks, demos, architecture | MEDIUM — binary dependency, transcript parsing | **ADD** — highest new value |
| **HackerNews (Algolia API)** | Good (free, no auth needed, fast) | MEDIUM — community discussion quality, trending topics | LOW — simple REST API at `hn.algolia.com/api/v1/` | **CONSIDER** for v8.2 — useful for "what does the community think about X" |
| **dev.to API** | Fair (REST, rate-limited) | LOW-MEDIUM — beginner-friendly articles, variable quality | LOW | **SKIP** — Brave Search already surfaces good dev.to content |
| **Stack Overflow API** | Fair (300 req/day free, registration needed) | LOW-MEDIUM — declining quality since 2023, best content surfaced by Brave | MEDIUM — auth, pagination, filtering | **SKIP** — not worth the integration cost |
| **GitHub Discussions** | Fair (GraphQL, auth required) | LOW — project-specific, not ecosystem-wide | HIGH — GraphQL complexity, repo discovery | **SKIP** — too narrow, too complex |
| **GitHub README/docs** | Good (REST API, high rate limits) | HIGH — but Context7 already covers this better | Already covered via Context7 | **SKIP** — Context7 is better |
| **ArXiv papers** | Good (free API) | LOW for developer tools (academic, not practical) | MEDIUM | **SKIP** — wrong domain |

**Confidence:** HIGH for API assessments (verified via official docs), MEDIUM for value rankings (based on developer workflow analysis)
<!-- /section -->

<!-- section: workflow -->
## Developer Research Workflow: How RAG Fits In

### Current Workflow (v8.0 — LLM-only)

```
User triggers /bgsd-new-project or /bgsd-new-milestone
  └─→ Orchestrator spawns 4× gsd-project-researcher agents in parallel
        ├─→ Stack researcher: LLM knowledge + Context7 + Brave Search → STACK.md
        ├─→ Features researcher: LLM knowledge + Brave Search → FEATURES.md
        ├─→ Architecture researcher: LLM knowledge + Context7 → ARCHITECTURE.md
        └─→ Pitfalls researcher: LLM knowledge + Brave Search → PITFALLS.md
  └─→ gsd-roadmapper synthesizes research/ into ROADMAP.md
```

**Problems:**
1. LLM knowledge is 6-18 months stale — misses recent library versions, API changes
2. Web search returns snippets, not full content — researchers synthesize from fragments
3. No video content — misses conference talks and architecture discussions
4. Each researcher consumes 40-60K tokens of LLM context for synthesis
5. No grounding/citation — LLM can hallucinate capabilities or API patterns

### Proposed Workflow (v8.1 — RAG-enhanced)

```
User triggers /bgsd-new-project or /bgsd-new-milestone
  └─→ Orchestrator runs research collection phase (NEW):
        ├─→ Brave Search: top URLs for each research dimension
        ├─→ Context7: library documentation for known technologies
        ├─→ yt-dlp: YouTube search → filter → transcript extraction
        └─→ All sources fed into NotebookLM notebook
  └─→ NotebookLM synthesis phase (NEW):
        ├─→ Chat queries for each research dimension (stack, features, arch, pitfalls)
        ├─→ Optional: generate briefing doc / study guide report
        └─→ Cited, grounded answers extracted as structured data
  └─→ Researcher agents receive RAG-enriched context (ENHANCED):
        ├─→ Stack researcher: RAG synthesis + LLM knowledge → STACK.md
        ├─→ Features researcher: RAG synthesis + LLM knowledge → FEATURES.md
        ├─→ Architecture researcher: RAG synthesis + LLM knowledge → ARCHITECTURE.md
        └─→ Pitfalls researcher: RAG synthesis + LLM knowledge → PITFALLS.md
  └─→ gsd-roadmapper synthesizes research/ into ROADMAP.md
```

**Benefits:**
1. NotebookLM grounds answers in actual sources — reduces hallucination
2. YouTube transcripts provide deep expert knowledge not in web snippets
3. Citation references allow traceability ("this recommendation came from X talk")
4. Researchers receive pre-synthesized context — lower token spend per agent
5. Cached research sessions allow re-querying without re-collecting sources

**Key design principle:** RAG enriches the existing workflow; it doesn't replace it. If NotebookLM is unavailable, the pipeline gracefully skips the RAG phases and researchers use their current approach.
<!-- /section -->

<!-- section: dependencies -->
## Feature Dependencies

```
[yt-dlp binary detection]
    └──requires──> [Tool availability check in config/runtime]

[YouTube search + metadata]
    └──requires──> [yt-dlp binary detection]
    └──requires──> [execFileSync wrapper for yt-dlp commands]

[YouTube transcript extraction]
    └──requires──> [YouTube search + metadata] (need video IDs first)
    └──requires──> [SRT-to-plaintext parser]

[YouTube result filtering]
    └──requires──> [YouTube search + metadata]
    └──requires──> [Configuration for filter thresholds]

[notebooklm-py detection]
    └──requires──> [Tool availability check in config/runtime]

[NotebookLM notebook creation + source ingestion]
    └──requires──> [notebooklm-py detection]
    └──requires──> [Python subprocess wrapper]
    └──uses data from──> [Brave Search results (URLs)]
    └──uses data from──> [Context7 docs (text)]
    └──uses data from──> [YouTube transcripts (text)]

[NotebookLM chat synthesis]
    └──requires──> [NotebookLM notebook creation + source ingestion]
    └──requires──> [Research dimension-specific prompts]

[NotebookLM report generation]
    └──requires──> [NotebookLM notebook creation + source ingestion]

[Research orchestration layer]
    └──requires──> [YouTube search + metadata]
    └──requires──> [NotebookLM notebook creation + source ingestion]
    └──requires──> [NotebookLM chat synthesis]
    └──requires──> [Graceful degradation logic]

[Graceful degradation]
    └──requires──> [yt-dlp binary detection]
    └──requires──> [notebooklm-py detection]
    └──requires──> [Brave Search MCP detection (existing)]
    └──requires──> [Context7 MCP detection (existing)]

[Research caching in SQLite]
    └──requires──> [SQLite L1/L2 cache from v8.0]
    └──requires──> [Research orchestration layer]

[MCP server discovery for research]
    └──requires──> [MCP profiling from v4.0]

[Researcher agent enhancement]
    └──requires──> [Research orchestration layer]
    └──requires──> [Existing gsd-project-researcher agent]
    └──requires──> [Existing gsd-phase-researcher agent]
```

### Critical Path

```
[yt-dlp detection] → [YouTube search] → [YouTube transcripts] ─┐
[Brave Search (existing)] ─────────────────────────────────────┤
[Context7 (existing)] ─────────────────────────────────────────┤
                                                                ├→ [NotebookLM ingestion] → [NotebookLM synthesis] → [Researcher enhancement]
[notebooklm-py detection] ─────────────────────────────────────┘

[Graceful degradation] ← runs in parallel, wraps everything
```
<!-- /section -->

<!-- section: mvp -->
## MVP Definition

### Phase 1: YouTube Content Pipeline (Foundation)

yt-dlp integration for YouTube search and transcript extraction. This phase has NO external Python dependency — only the yt-dlp binary.

- [ ] **yt-dlp binary detection** — Check `which yt-dlp` at runtime, store availability in tool registry
- [ ] **YouTube search command** — `gsd-tools research:youtube-search "<query>" --max N` using `ytsearchN:<query>` with `--dump-json --flat-playlist --no-download`
- [ ] **YouTube metadata parsing** — Extract title, duration, view_count, upload_date, channel, video_id from JSON output
- [ ] **YouTube result filtering** — Configurable filters: min views, duration range, max age, channel allowlist
- [ ] **YouTube transcript extraction** — `yt-dlp --write-auto-subs --write-subs --sub-lang en --skip-download --convert-subs srt` then SRT→plaintext conversion
- [ ] **Research config schema** — Add `research` section to config.json with YouTube settings

### Phase 2: NotebookLM Integration (RAG Engine)

NotebookLM as the synthesis engine. Requires Python + notebooklm-py.

- [ ] **notebooklm-py detection** — Check for `notebooklm` CLI or `python -c "import notebooklm"` at runtime
- [ ] **Python subprocess wrapper** — Helper in gsd-tools to invoke notebooklm-py CLI commands and parse JSON output
- [ ] **NotebookLM notebook lifecycle** — Create notebook per research session, add sources, query, cleanup
- [ ] **Source ingestion pipeline** — Feed URLs (from Brave), text (from Context7), YouTube URLs, and transcripts into notebook
- [ ] **Chat-based synthesis** — Ask dimension-specific research questions, extract cited answers
- [ ] **Rate limit awareness** — Track daily usage against tier limits, warn when approaching limits

### Phase 3: Orchestration + Graceful Degradation (Glue Layer)

Wire everything together and ensure nothing breaks when tools are missing.

- [ ] **Research orchestration command** — `gsd-tools research:collect "<topic>"` runs full pipeline: search → collect → ingest → synthesize
- [ ] **Graceful degradation logic** — Feature flags per tool, skip missing tools, log warnings, continue with available
- [ ] **Researcher agent integration** — Modify gsd-project-researcher and gsd-phase-researcher to consume RAG synthesis when available
- [ ] **Research session persistence** — `.planning/research/.session.json` for resumable research
- [ ] **MCP research status** — `gsd-tools research:status` shows available tools, missing tools, configuration state

### Phase 4: Quality + Polish (Differentiators)

Enhancements once the core pipeline works.

- [ ] **Source quality scoring** — Rank sources before loading into NotebookLM
- [ ] **NotebookLM report generation** — Generate briefing docs and study guides
- [ ] **Research caching** — Cache notebook IDs and synthesis results in SQLite
- [ ] **Source guide extraction** — Get per-source summaries from NotebookLM
- [ ] **Parallel source collection** — Concurrent Brave + Context7 + YouTube collection
<!-- /section -->

<!-- section: prioritization -->
## Feature Prioritization Matrix

| Feature | User Value | Impl Cost | Risk | Priority |
|---------|-----------|-----------|------|----------|
| yt-dlp binary detection | HIGH | LOW | LOW | P1 |
| YouTube search + metadata | HIGH | MEDIUM | LOW | P1 |
| YouTube transcript extraction | HIGH | MEDIUM | LOW | P1 |
| YouTube result filtering | MEDIUM | LOW | LOW | P1 |
| notebooklm-py detection | HIGH | LOW | MEDIUM | P1 |
| Python subprocess wrapper | HIGH | MEDIUM | MEDIUM | P1 |
| NotebookLM notebook lifecycle | HIGH | HIGH | HIGH | P1 |
| NotebookLM source ingestion | HIGH | HIGH | HIGH | P1 |
| NotebookLM chat synthesis | HIGH | HIGH | HIGH | P1 |
| Research orchestration | HIGH | HIGH | MEDIUM | P1 |
| Graceful degradation | **CRITICAL** | MEDIUM | LOW | P1 |
| Research config schema | MEDIUM | LOW | LOW | P1 |
| Researcher agent integration | HIGH | MEDIUM | LOW | P1 |
| Rate limit awareness | MEDIUM | LOW | LOW | P2 |
| Research session persistence | MEDIUM | LOW | LOW | P2 |
| MCP research status | MEDIUM | LOW | LOW | P2 |
| Source quality scoring | MEDIUM | MEDIUM | LOW | P2 |
| NotebookLM report generation | MEDIUM | MEDIUM | MEDIUM | P2 |
| Research caching (SQLite) | MEDIUM | MEDIUM | LOW | P3 |
| Source guide extraction | LOW | LOW | LOW | P3 |
| Parallel source collection | LOW | MEDIUM | LOW | P3 |

**Priority key:**
- P1: Must have for v8.1 — core pipeline functionality
- P2: Should have — improves quality and usability
- P3: Nice to have — optimize once core works

**Risk assessment:**
- **LOW risk:** yt-dlp features — battle-tested CLI, stable APIs, well-documented
- **MEDIUM risk:** Python subprocess integration — cross-language boundary, error handling, environment detection
- **HIGH risk:** NotebookLM features — unofficial API, cookie-based auth, Google can break it anytime
<!-- /section -->

<!-- section: implementation_notes -->
## Implementation Detail Notes

### yt-dlp Integration Strategy

**Binary, not library.** Use yt-dlp as a CLI binary called via `execFileSync`, not as a Python library import. This avoids Python dependency for YouTube features.

```bash
# Search: returns JSON array of video metadata
yt-dlp --dump-json --flat-playlist --no-download "ytsearch10:react server components conference talk"

# Metadata for specific video (no download)
yt-dlp --dump-json --no-download "https://www.youtube.com/watch?v=VIDEO_ID"

# Transcript extraction (auto-generated subtitles)
yt-dlp --write-auto-subs --write-subs --sub-lang en --skip-download --convert-subs srt -o "%(id)s" "https://www.youtube.com/watch?v=VIDEO_ID"
```

**Node.js wrapper options:**
- `youtube-dl-exec` npm package (12 code snippets on Context7, simple Promise API) — installs yt-dlp automatically
- Direct `execFileSync('yt-dlp', [...args])` — no additional npm dependency, but requires user to install yt-dlp

**Recommendation:** Direct `execFileSync` with yt-dlp path detection. Keeps zero-dependency architecture. Document yt-dlp installation in setup guide. The `youtube-dl-exec` package auto-installs yt-dlp which is convenient but adds a npm dependency.

### notebooklm-py Integration Strategy

**Python subprocess, not direct integration.** notebooklm-py is an async Python library. bGSD is synchronous Node.js. Integration via:

1. **CLI wrapper (preferred):** Call `notebooklm <command>` CLI and parse stdout JSON
2. **Python script helper:** Write a small Python script in bGSD's `src/` that uses notebooklm-py and outputs JSON
3. **REST bridge (overkill):** Don't. Too complex for a CLI tool.

**Authentication flow:**
- First-time: User runs `notebooklm login` (opens browser, captures cookies)
- Cookies stored in `~/.config/notebooklm-py/` (NOT in the project)
- Sessions expire every few weeks — user must re-authenticate
- bGSD detects auth failure and provides clear error message

**Recommendation:** Option 1 (CLI wrapper). The `notebooklm` CLI already outputs parseable results. No custom Python script needed. Just shell out and parse stdout.

### NotebookLM Usage Pattern for Research

One notebook per research session. Load sources, query, extract, cleanup.

```
1. Create notebook: "bGSD Research: [project-name] [timestamp]"
2. Add sources (up to 50 on free tier):
   - Top 5-10 URLs from Brave Search
   - Context7 library docs as text sources
   - Top 3-5 YouTube video URLs (NotebookLM auto-transcribes)
   - Additional YouTube transcripts as text sources (for videos NotebookLM can't process)
3. Wait for all sources to be "Ready" (poll status)
4. Configure chat: custom prompt for developer research, longer responses
5. Ask dimension-specific questions:
   - "What technology stack do these sources recommend and why?"
   - "What are the table stakes features users expect?"
   - "What architecture patterns are discussed?"
   - "What are the common pitfalls and mistakes to avoid?"
6. Extract answers with citations
7. Feed cited answers into researcher agents as pre-synthesized context
8. (Optional) Generate briefing doc report for archival
9. Keep notebook for potential follow-up queries during phase research
```

**Token savings estimate:** NotebookLM handles ~80% of source synthesis. Researcher agents receive pre-digested context (~5-10K tokens) instead of raw source material (~40-60K tokens). Estimated 50-70% LLM token reduction for research phases.

### Graceful Degradation Tiers

| Available Tools | Research Approach | Quality |
|----------------|-------------------|---------|
| All (Brave + Context7 + yt-dlp + NotebookLM) | Full RAG pipeline with grounded synthesis | Best |
| Brave + Context7 + yt-dlp (no NotebookLM) | Sources collected, LLM synthesizes directly from transcripts + search results | Good |
| Brave + Context7 (no yt-dlp, no NotebookLM) | Current v8.0 behavior — web search + library docs | Baseline |
| Context7 only (no Brave, no yt-dlp, no NotebookLM) | Library docs only | Minimal |
| Nothing (no MCPs, no tools) | Pure LLM knowledge (stale but functional) | Lowest |

Each tier is a strict superset of the one below. The tool never fails — it just produces lower-quality research.
<!-- /section -->

<!-- section: competitors -->
## Comparable Tools and Approaches

| Tool / Approach | How It Works | Strengths | Weaknesses | Relevance to bGSD |
|----------------|-------------|-----------|------------|-------------------|
| **Perplexity AI** | Web search + LLM synthesis with citations | Real-time web grounding, clean citations | Closed API, no YouTube, no library-specific docs | Model for citation quality |
| **NotebookLM (manual)** | Upload docs → chat → get grounded answers | Excellent RAG quality, multi-source synthesis | Manual process, 50 source limit (free), no automation | Our RAG engine — automating what users do manually |
| **Cursor / Windsurf docs search** | Indexed codebase + web search for code context | Fast, IDE-integrated | No YouTube, no external research synthesis | Different use case (coding assistance vs research) |
| **GPT Researcher** (open source) | Agent-based web research, generates reports | Full automation, parallel research agents | No YouTube, no NotebookLM-quality RAG, high token cost | Architectural inspiration for orchestration |
| **Storm by Stanford** | LLM-powered research article generation | Multi-perspective synthesis, Wikipedia-quality output | Academic focus, complex setup, no video content | Too heavyweight for CLI tool |
| **Google Deep Research** | NotebookLM's built-in autonomous research | Fully automated, high quality | 10/month on free tier, limited control, black box | Could use as alternative to our custom pipeline |

**Competitive position:** No existing tool combines YouTube transcript extraction + NotebookLM RAG synthesis + Context7 library docs + Brave web search in an automated developer research pipeline. This is a genuine differentiator.
<!-- /section -->

## Sources

- NotebookLM official FAQ (limits, source counts): https://support.google.com/notebooklm/answer/16269187 — Verified 50 sources/notebook, 500K words/source, 50 chats/day on free tier [HIGH confidence — official Google docs]
- NotebookLM upgrade tiers: https://support.google.com/notebooklm/answer/16213268 — Full tier comparison (Free/Plus/Pro/Ultra limits) [HIGH confidence — official Google docs]
- notebooklm-py GitHub + Context7: https://github.com/teng-lin/notebooklm-py — Python API for NotebookLM, 2.4K stars, v0.3.2 (Jan 2026), uses undocumented APIs [HIGH confidence for capabilities, MEDIUM for stability]
- notebooklm-py Sources API (Context7): add_url, add_youtube, add_text, add_file, add_drive methods [HIGH confidence]
- notebooklm-py Chat API (Context7): ask, configure (goal, response_length, custom_prompt), get_history [HIGH confidence]
- notebooklm-py Report generation (Context7): briefing-doc, study-guide, blog-post, custom types [HIGH confidence]
- yt-dlp official docs (Context7): extract_info, metadata extraction, subtitle handling, search syntax [HIGH confidence]
- yt-dlp search syntax: `ytsearchN:<query>`, `ytsearchdateN:<query>` for recency-sorted results [HIGH confidence — GitHub issues + docs]
- yt-dlp subtitle extraction: `--write-auto-subs --write-subs --sub-lang en --skip-download --convert-subs srt` [HIGH confidence — Context7 docs]
- youtube-dl-exec npm package: Node.js wrapper, auto-installs yt-dlp, Promise API [HIGH confidence — npm docs]
- HackerNews Algolia API: https://hn.algolia.com/api — Free, no auth, full-text search of stories + comments [HIGH confidence — official]
- YouTube developer education landscape: Conference channels (GOTO, NDC, Strange Loop), tutorial channels (Traversy, Fireship) [MEDIUM confidence — web search compilation]
- dev.tube: https://dev.tube/ — Curated tech talks database [MEDIUM confidence — web search]
- RAG pipeline patterns 2025-2026: Naive → Advanced → Agentic RAG evolution [MEDIUM confidence — multiple web sources agree]

---
*Feature research for: bGSD v8.1 RAG-Powered Research Pipeline*
*Researched: 2026-03-02*
