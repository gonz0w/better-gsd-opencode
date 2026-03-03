# Project Research Summary

**Project:** bGSD Plugin v8.1 — RAG-Powered Research Pipeline
**Domain:** Developer research automation — YouTube content extraction, NotebookLM RAG synthesis, multi-source orchestration
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH

<!-- section: compact -->
<compact_summary>
<!-- The compact summary is the DEFAULT view for orchestrators and planners.
     Keep it under 30 lines. Synthesizes all 4 research areas.
     Full sections below are loaded on-demand via extract-sections. -->

**Summary:** v8.1 adds a RAG-powered research pipeline that gathers sources from YouTube (yt-dlp), Brave Search, and Context7, then synthesizes them via Google NotebookLM — reducing LLM token spend while grounding research in actual sources. The primary recommendation is to build YouTube/yt-dlp integration first (low risk, high value) and NotebookLM integration last (highest risk — unofficial reverse-engineered API with cookie auth that can break anytime). The key risk is NotebookLM fragility: cookie-based auth expires every few weeks, Google can break the undocumented API without notice, and the official Enterprise API lacks chat/query functionality.

**Recommended stack:** yt-dlp (standalone binary for YouTube search + transcript), notebooklm-py v0.3.2 (Python CLI for RAG synthesis), youtube-dl-exec v3.1.3 (optional npm wrapper), built-in VTT parser (~30 lines), Exa MCP server (semantic search) — all invoked via execFileSync, zero bundled dependencies

**Architecture:** 2-3 new src/ modules (~400-600 lines) using execFileSync subprocess pattern matching git.js; `research:` namespace commands; 4-tier graceful degradation (Full RAG → Sources without synthesis → Brave/Context7 only → Pure LLM)

**Top pitfalls:**
1. NotebookLM unofficial API — cookie auth expires, Google can break it anytime — build it LAST, make it fully optional
2. yt-dlp arms race with YouTube — nsig/SABR breakage, rate limiting — retry with backoff, treat transcripts as bonus not requirement
3. Pipeline latency 10-50x slower (3-8 min vs 10-30 sec) — progressive output, time budgets, parallel source collection, --quick flag
4. Python dependency breaks zero-dep promise — graceful detection, standalone yt-dlp binary preferred, dedicated venv for notebooklm-py
5. YouTube search quality — clickbait, outdated content — channel allowlist, recency/duration filters, metadata-first approach

**Suggested phases (starting at phase 56):**
1. Phase 56: Foundation & Config — config schema, capability detection, research:capabilities command
2. Phase 57: YouTube Integration — yt-dlp wrapper, search, transcript extraction, VTT parsing, result filtering
3. Phase 58: Research Orchestration — multi-source collection, graceful degradation, agent integration, progress reporting
4. Phase 59: NotebookLM Integration — notebooklm-py wrapper, notebook lifecycle, source ingestion, chat synthesis
5. Phase 60: Testing & Polish — integration tests, caching, source quality scoring, report generation

**Confidence:** MEDIUM-HIGH | **Gaps:** NotebookLM API stability (unofficial), YouTube transcript availability (~30-40% estimated), official NotebookLM API chat endpoint (missing)
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

The v8.1 milestone adds a RAG-powered research pipeline to the bGSD Plugin, enhancing the existing 4-agent parallel research workflow (gsd-project-researcher × 4) with external source collection and synthesis. The pipeline gathers content from three new sources — YouTube video transcripts via yt-dlp, semantic web search via Exa MCP, and RAG-based synthesis via Google NotebookLM — alongside the existing Brave Search and Context7 MCP servers. The architecture follows the established `execFileSync` subprocess pattern (matching `git.js`), adding 2-3 new `src/` modules (~400-600 lines total, ~25KB bundle impact) with a new `research:` command namespace. All external tools are optional; the system degrades through 4 tiers from full RAG synthesis down to pure LLM-only research (the current v8.0 behavior), ensuring zero regression when tools are absent.

The research converged on a clear build order: **YouTube/yt-dlp first, NotebookLM last.** yt-dlp is a battle-tested tool (100K+ GitHub stars, 600+ contributors) with stable CLI output — the lowest-risk, highest-value addition. NotebookLM is the highest-risk component: `notebooklm-py` (v0.3.2, 2.4K stars) reverse-engineers Google's undocumented `batchexecute` RPC endpoint using browser-captured session cookies that expire every few weeks. Google can break this API without notice, and the official NotebookLM Enterprise API (v1alpha, Pre-GA) critically lacks chat/query functionality — making it insufficient for RAG synthesis alone. The recommendation is to support both paths behind a unified interface, but design the system so NotebookLM is a quality enhancer, never a requirement.

The dominant risk is **pipeline latency**: the full RAG pipeline takes 3-8 minutes (10-50x slower than current LLM-only research at 10-30 seconds). This requires UX mitigation — progressive output, parallel source collection, configurable time budgets, and a `--quick` flag to skip RAG entirely. Secondary risks include Python dependency management (notebooklm-py requires Python ≥3.10), YouTube search quality (clickbait and outdated content mixed with quality results), and yt-dlp's perpetual arms race with YouTube's anti-extraction countermeasures. All are manageable through graceful degradation, retry logic, source quality filtering, and treating every external tool as optional.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

No changes to the core bundle architecture. All new capabilities are external tool wrappers invoked via `execFileSync`. One optional npm dependency (`youtube-dl-exec`) and one optional Python package (`notebooklm-py`). VTT transcript parsing is built-in (~30 lines of regex), not a library — consistent with the project's 309+ regex patterns.

**Core technologies:**
- **yt-dlp (standalone binary):** YouTube search (`ytsearch:` prefix), metadata extraction (`--dump-json`), transcript extraction (`--write-auto-sub --skip-download`) — 100K+ GitHub stars, actively maintained, handles 1000+ sites, eliminates need for separate YouTube search library or YouTube Data API
- **youtube-dl-exec v3.1.3 (optional npm wrapper):** Auto-installs yt-dlp binary, provides Promise interface and subprocess control — 602 stars, 7.2K dependents, MIT license, last release Feb 2026
- **notebooklm-py v0.3.2 (Python CLI):** Full NotebookLM access — create notebooks, add sources (URLs, YouTube, text, PDFs), chat/query for RAG synthesis, generate reports — 2.4K stars, MIT, requires Python ≥3.10
- **Built-in VTT parser (~30 lines):** Strip timestamps, deduplicate lines, clean HTML tags — no npm dependency needed
- **Exa MCP server (recommended addition):** Semantic search with category filtering (research_paper, personal_site, company) — fills gap between Brave (keyword) and Context7 (library-specific)

**Critical technology decisions:**
- **yt-dlp over YouTube Data API v3:** No API key management, no quota limits, no OAuth. yt-dlp's `ytsearch:` prefix handles search + metadata + transcripts in one tool.
- **notebooklm-py over official Enterprise API:** The official API lacks chat/query — the core RAG synthesis capability. Only notebooklm-py provides programmatic Q&A against loaded sources.
- **Built-in VTT over node-webvtt/subtitle.js:** VTT format is trivially parseable. Adding a library for ~30 lines of regex contradicts the project's architectural style.
- **No local RAG framework:** PROJECT.md explicitly scopes out "RAG / vector search." NotebookLM IS the external RAG engine. If unavailable, the LLM synthesizes directly — no LangChain.js, no vector DB, no embeddings.

**What NOT to add:** youtube-sr/ytsr (fragile HTML scrapers), YouTube Data API v3 (overkill), node-webvtt/subtitle.js (30 lines of regex), LangChain.js/LlamaIndex.js (wrong architecture), Chromadb/Pinecone (too heavy), google-auth-library (shell out to gcloud instead), Perplexity MCP (redundant with Brave Search unless budget allows).

### Expected Features

**Must have (table stakes):**
- YouTube search + metadata extraction via yt-dlp — developers learn from conference talks, yt-dlp handles search and metadata in one tool
- YouTube transcript extraction — transcripts are the actual research content; videos without transcripts still provide metadata value
- NotebookLM notebook creation + multi-source ingestion — the RAG engine needs sources loaded before synthesis
- NotebookLM chat-based synthesis — ask domain-specific questions, get grounded answers with citations
- Research orchestration layer — Brave Search → Context7 → YouTube → NotebookLM → structured output
- 4-tier graceful degradation — every tool optional, pipeline never fails, just produces lower-quality research
- Configuration in config.json — API credentials, tool paths, search parameters, research timeout

**Should have (differentiators):**
- NotebookLM report generation (briefing docs, study guides) — structured output beyond raw chat Q&A
- Source quality scoring — filter YouTube results by view count, recency, duration, channel before expensive transcript extraction
- Research caching in SQLite — store notebook IDs + synthesis results, avoid re-running expensive research
- MCP server discovery — detect available research MCPs, recommend missing ones
- Research session persistence — save/resume interrupted research via `.planning/research/.session.json`
- Parallel source collection — Brave + Context7 + YouTube simultaneously to reduce wall-clock time

**Defer to v8.2+:**
- HackerNews Algolia API integration (useful but not critical)
- Research result non-determinism mitigation beyond source logging
- Internationalized YouTube search (English-only acceptable for v8.1)
- Advanced NotebookLM features: deep research mode, source guide extraction
- Exa MCP integration (recommend in docs, defer implementation)

### Architecture Approach

The architecture adds 2-3 new source modules using the established `execFileSync` subprocess pattern from `git.js`. All external tools (yt-dlp binary, notebooklm CLI) are called as subprocesses with JSON output parsing, timeout management, and structured error handling. The `research:` command namespace follows the v8.0 namespace routing pattern. Total new code is ~400-600 lines across 3 modules, adding ~25KB to the ~1133KB bundle (well within the 1500KB budget).

**Major components:**
1. **`src/lib/yt-dlp.js` (~120 lines)** — yt-dlp binary wrapper: `execYtDlp()` base caller, `searchYouTube()`, `getVideoMetadata()`, `extractTranscript()`, built-in VTT→text parser
2. **`src/lib/notebooklm.js` (~180 lines)** — notebooklm CLI wrapper: `execNotebookLM()` base caller, `createNotebook()`, `addSource()`, `askQuestion()`, `generateReport()`, `checkAuth()`, fire-and-poll for long operations
3. **`src/commands/research.js` (~250 lines)** — Command handlers for `research:capabilities`, `research:yt-search`, `research:yt-transcript`, `research:nlm-create`, `research:nlm-add-source`, `research:nlm-ask`, `research:nlm-report`, `research:nlm-status`
4. **Modified: `constants.js` (+30 lines)** — 5 new CONFIG_SCHEMA entries, COMMAND_HELP entries for research commands
5. **Modified: `router.js` (+25 lines)** — `lazyResearch()` loader, `research:` case block
6. **Modified: `init.js` (+20 lines)** — `rag_capabilities` detection in init output
7. **Modified: `env.js` (1 line)** — Export `checkBinary` function for reuse

### Critical Pitfalls

1. **NotebookLM unofficial API is fragile** — notebooklm-py reverse-engineers undocumented Google `batchexecute` RPCs with browser-captured session cookies that expire every few weeks. Google can break it anytime. Account flagging risk exists. **Mitigation:** Build NotebookLM integration LAST. Design it as fully optional. Auth health check before every operation. Aggressive timeouts (60s chat, 120s ingestion). Dedicated Google account recommended. Monitor notebooklm-py GitHub issues for breakage signals.

2. **yt-dlp is in perpetual arms race with YouTube** — nsig extraction failures, SABR streaming blocks, and rate limiting require frequent yt-dlp updates. A pinned version guarantees breakage within weeks. **Mitigation:** Use yt-dlp for metadata primarily; treat transcripts as bonus. Retry with exponential backoff. Check version freshness before use. Cache successful transcript extractions. Add `--sleep-interval` to respect rate limits.

3. **Pipeline latency is 10-50x worse than current approach** — Full RAG pipeline takes 3-8 minutes vs 10-30 seconds for LLM-only. **Mitigation:** Progressive output (emit status at each stage). Parallelize source collection. Time-box each stage. Default 120s research timeout. `--quick` flag to skip RAG. Show time estimates before starting.

4. **Python dependency breaks zero-dependency promise** — notebooklm-py requires Python ≥3.10 with httpx, click, rich. Playwright + Chromium (~250MB) needed for initial browser login. **Mitigation:** Prefer standalone yt-dlp binary (no Python needed for YouTube). Isolate notebooklm-py in dedicated venv. Never make Python a hard requirement. Test "nothing installed" path rigorously.

5. **YouTube search results are low-signal** — Clickbait, outdated content, and SEO-spam mixed with quality results. Auto-generated captions misrecognize technical terms. ~30-40% of dev videos lack any subtitles. **Mitigation:** Channel allowlist for known quality channels. Filter by recency (last 2 years), duration (10-30 min), view count (>5K). Metadata-first approach (extract metadata for 20, filter to top 5, then transcripts). Transcript quality validation for technical term density.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure (5 phases, starting at Phase 56 — v8.0 ended at Phase 55):

### Phase 56: Foundation & Configuration
**Rationale:** Every feature depends on capability detection and configuration being correct. This phase has zero external dependencies — it's pure Node.js code that detects what tools are available and extends the config schema.
**Delivers:** CONFIG_SCHEMA entries for RAG settings (`rag_enabled`, `yt_dlp_path`, `notebooklm_path`, `yt_search_count`, `nlm_report_format`), COMMAND_HELP entries, `checkBinary` export from env.js, `research:capabilities` command that reports available tools and degradation tier, `rag_capabilities` field in init output.
**Addresses:** Configuration (FEATURES.md), runtime capability detection (ARCHITECTURE.md)
**Avoids:** P3 (Python dependency — detection only, no execution), P8 (sync architecture — establishes timeout patterns)

### Phase 57: YouTube Integration
**Rationale:** Lowest risk external integration. yt-dlp is battle-tested (100K+ stars), has stable JSON output, and provides the highest new value (conference talks and expert content not available via web search). No Python dependency if using standalone binary.
**Delivers:** `src/lib/yt-dlp.js` module (execYtDlp, searchYouTube, getVideoMetadata, extractTranscript, parseVttToText), `research:yt-search` and `research:yt-transcript` commands, YouTube result filtering (channel, recency, duration, view count), transcript caching.
**Uses:** yt-dlp binary (STACK.md), execFileSync pattern (ARCHITECTURE.md)
**Addresses:** YouTube search + metadata, transcript extraction, result filtering (FEATURES.md)
**Avoids:** P2 (yt-dlp breakage — retry with backoff, transcripts as bonus not requirement), P5 (low-signal results — quality filtering)

### Phase 58: Research Orchestration & Agent Integration
**Rationale:** The orchestration layer wires YouTube, Brave Search, and Context7 sources together and integrates with existing researcher agents. This phase delivers Tier 2-3 research (sources collected, LLM synthesizes) WITHOUT NotebookLM — providing immediate value while the riskiest component is deferred. Graceful degradation is the critical feature here.
**Delivers:** `src/commands/research.js` orchestration logic, `research:` namespace routing in router.js, 4-tier graceful degradation logic, progressive output/progress reporting, research timeout enforcement, researcher agent workflow updates (new-milestone.md, research-phase.md), `--quick` flag for LLM-only research.
**Implements:** Research orchestration layer (ARCHITECTURE.md), graceful degradation (FEATURES.md)
**Avoids:** P4 (latency — time budgets, parallel collection, progressive output), P7 (scope creep — validate value of Tier 2 before building Tier 1)

### Phase 59: NotebookLM Integration
**Rationale:** Highest-risk component, built LAST deliberately. By this point, the pipeline works at Tier 2-3 without NotebookLM. This phase adds Tier 1 (full RAG synthesis) as an optional enhancement. If NotebookLM proves too fragile, it can be disabled without impacting the rest of the pipeline.
**Delivers:** `src/lib/notebooklm.js` module (execNotebookLM, createNotebook, addSource, askQuestion, generateReport, checkAuth, waitForGeneration), `research:nlm-*` commands, auth health checking, fire-and-poll pattern for long operations, rate limit awareness, dedicated Google account recommendation in docs.
**Uses:** notebooklm-py CLI (STACK.md), Python subprocess pattern (ARCHITECTURE.md)
**Addresses:** NotebookLM notebook lifecycle, source ingestion, chat synthesis (FEATURES.md)
**Avoids:** P1 (unofficial API — fully optional, auth pre-check, aggressive timeouts, LLM fallback), P6 (cookie auth — dedicated account, expiry detection, clear re-auth messaging)

### Phase 60: Testing, Caching & Polish
**Rationale:** Integration testing across all tiers, performance optimization, and differentiator features that build on the proven pipeline. Lower blast radius, higher value once the core is stable.
**Delivers:** Contract tests for research:capabilities output shape, mock-based tests for yt-dlp and notebooklm wrappers, graceful degradation tests (all tools missing), build smoke test, research caching in SQLite (extend v8.0 cache), source quality scoring, NotebookLM report generation, research session persistence, MCP research status command.
**Addresses:** Research caching, source quality scoring, report generation, session persistence, MCP discovery (FEATURES.md)
**Avoids:** P10 (non-determinism — source logging), P9 (bundle size — monitor continuously)

### Phase Ordering Rationale

- **Phase 56 before all others:** Config and detection are foundational — every other phase reads config and checks capabilities.
- **Phase 57 before 58:** YouTube sources must be extractable before the orchestrator can collect them.
- **Phase 58 before 59:** Orchestration without NotebookLM (Tier 2-3) proves the pipeline architecture works and delivers value. If NotebookLM proves impractical, the project still ships useful research improvements.
- **Phase 59 deliberately last for features:** NotebookLM is highest-risk. Building it last means maximum fallback coverage is already in place. If it takes longer than expected or the API breaks during development, the rest of the pipeline is unaffected.
- **Phase 60 after core pipeline:** Testing and polish depend on having the full feature set available for integration testing.
- **Total new code ~550 lines, 3 new modules (34→37), ~25KB bundle impact** — this is a small, focused milestone.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 59 (NotebookLM Integration):** Complex integration with unofficial, fragile API. Need to research notebooklm-py CLI output formats, auth failure modes, rate limit behavior, and fire-and-poll patterns. The official Enterprise API's evolution should be monitored — if Google adds chat/query endpoints, the integration strategy changes.
- **Phase 58 (Orchestration):** Need to research optimal source-to-LLM feeding patterns — how much context can researcher agents absorb? What's the best format for YouTube transcript + web search results as LLM input?

Phases with standard patterns (skip research-phase):
- **Phase 56 (Foundation):** Well-documented — extends existing CONFIG_SCHEMA and checkBinary patterns. Zero new external dependencies.
- **Phase 57 (YouTube Integration):** yt-dlp has excellent documentation (Context7 HIGH confidence, benchmark 92.2). The execFileSync + JSON parsing pattern is identical to git.js.
- **Phase 60 (Testing & Polish):** Standard testing patterns. SQLite cache extension follows v8.0 cache.js patterns exactly.
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | yt-dlp verified via Context7 (High reputation, benchmark 92.2) and GitHub (100K+ stars). youtube-dl-exec verified via Context7 (12 snippets). notebooklm-py verified via GitHub (v0.3.2, pyproject.toml) and PyPI. Official NotebookLM Enterprise API verified via Google Cloud docs (2026-02-26). |
| Features | MEDIUM-HIGH | Table stakes features well-defined. NotebookLM capabilities verified via official tier docs and notebooklm-py Context7. YouTube content value assessment based on web search compilation (MEDIUM for specific percentages like subtitle availability). |
| Architecture | HIGH | Integration patterns directly mirror existing codebase (git.js execGit, env.js checkBinary). Module impact analysis based on reading all 34 source modules. Bundle impact calculated from known sizes. |
| Pitfalls | HIGH | NotebookLM fragility sourced from Context7 docs, GitHub issues, Reddit reports, and Google API ToS. yt-dlp breakage patterns from 10+ GitHub issues (2025-2026). Python dependency risks from Node.js child_process docs and community reports. Latency estimates from notebooklm-py Known Limitations docs. |

**Overall confidence: MEDIUM-HIGH**

The confidence is HIGH for everything except NotebookLM's long-term viability. The unofficial API could break at any time, and the official Enterprise API lacks the chat/query capability we need. This is a known, accepted risk — the architecture is designed so NotebookLM failure degrades quality but never breaks the pipeline.

### Gaps to Address

- **NotebookLM API stability:** The unofficial notebooklm-py depends on undocumented Google RPCs. No guarantee of continued functionality. Monitor the library's GitHub issues during development. If Google releases an official API with chat/query, pivot to that.
- **YouTube transcript availability:** Estimated ~30-40% of developer videos lack subtitles (community reports, not measured). Need to validate this during Phase 57 with real searches and adjust the pipeline's reliance on transcripts accordingly.
- **Official NotebookLM Enterprise API evolution:** v1alpha Preview as of Feb 2026. If Google adds chat/query endpoints before or during v8.1 development, the notebooklm-py dependency becomes optional. Worth monitoring.
- **Optimal LLM context format for RAG sources:** How should YouTube transcripts + Brave results + Context7 docs be formatted when fed to researcher agents without NotebookLM (Tier 2)? Needs experimentation during Phase 58 planning.
- **Exa MCP server value:** Recommended in STACK.md but deferred from implementation. Should be evaluated for v8.2 based on real research quality comparisons.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- Context7 yt-dlp docs (`/yt-dlp/yt-dlp`, benchmark 92.2) — search syntax, metadata extraction, subtitle formats, rate limiting
- Context7 youtube-dl-exec docs (12 snippets, High reputation) — Node.js wrapper API, subprocess control
- Google Cloud NotebookLM Enterprise API docs (updated 2026-02-26) — v1alpha REST API, source management, NO chat/query endpoint
- Google NotebookLM tier limits (support.google.com) — 50 sources/50 queries/day (free), up to 600/5000 (Ultra)
- notebooklm-py pyproject.toml (GitHub v0.3.2) — Python ≥3.10, dependencies: httpx, click, rich, optional playwright
- yt-dlp GitHub issues (#13241, #13249, #13252, #13260, #13968, #14707, #14734) — nsig failures, SABR blocking
- Node.js child_process docs — execFileSync timeout, stdio, PATH behavior
- Existing codebase analysis — git.js (401 lines), env.js checkBinary, router.js (1585 lines), config.js, init.js, all 34 modules

### Secondary (MEDIUM confidence)
- notebooklm-py GitHub (teng-lin/notebooklm-py, 2.4K stars) — CLI reference, auth flow, known limitations, troubleshooting
- Exa MCP Server (exa-labs/exa-mcp-server) — semantic search categories, code search
- MCP server landscape comparisons (Builder.io, AIMultiple) — Exa highest search success rate
- Reddit r/youtubedl (2025-2026) — rate limiting escalation, sleep delays
- Reddit r/notebooklm — account flagging reports, API access community requests
- YouTube developer education landscape — conference channels, tutorial quality assessment
- RAG pipeline pattern literature — Naive → Advanced → Agentic RAG evolution

### Tertiary (needs validation)
- YouTube subtitle availability (~30-40% of dev videos lacking subtitles) — community estimate, not measured
- notebooklm-py long-term API stability — depends on Google not breaking undocumented endpoints
- Auto-caption technical term accuracy — reported high error rate for dev terms, needs real-world validation
- Pipeline latency estimates (3-8 minutes) — based on documented per-stage times, needs end-to-end measurement

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
