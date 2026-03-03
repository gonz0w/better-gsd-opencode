# Pitfalls Research

**Domain:** Adding RAG-powered research pipeline (yt-dlp, notebooklm-py, Brave Search, Context7) to an existing zero-dependency single-file Node.js CLI tool (1133KB bundle, 762 tests, esbuild pipeline, file-copy deploy)
**Researched:** 2026-03-02
**Confidence:** HIGH — based on Context7 docs for notebooklm-py and yt-dlp, official troubleshooting guides, GitHub issue trackers, Brave Search results for real-world failure reports, and codebase analysis of existing gsd-tools.cjs architecture

<!-- section: compact -->
<pitfalls_compact>
**Top pitfalls:**
1. **notebooklm-py uses unofficial reverse-engineered API with cookie-based auth that expires every few weeks** — not a real API; Google can break it at any time; session cookies need manual browser re-login; account flagging risk (Phase: NotebookLM Integration)
2. **yt-dlp breaks constantly as YouTube actively fights it** — nsig extraction failures, SABR streaming blocks, rate limiting require frequent yt-dlp updates; pinning a version guarantees breakage within weeks (Phase: YouTube Integration)
3. **Python as a runtime dependency breaks the zero-dependency promise** — Node.js CLI must spawn Python subprocess for notebooklm-py; Python version requirements (>=3.10), venv management, PATH resolution, and cross-platform differences all introduce failure modes that don't exist today (Phase: Foundation)
4. **RAG latency is minutes not seconds** — NotebookLM source ingestion takes 30 seconds to 5+ minutes; audio/artifact generation takes 3-45 minutes; current research workflow takes 10-30 seconds of LLM time; users will perceive RAG research as broken (Phase: Orchestration)
5. **YouTube transcript unavailability pollutes research** — many videos lack subtitles; auto-generated captions are noisy; searching YouTube for "React hooks best practices" returns clickbait and outdated content alongside quality content; no reliable signal for filtering quality (Phase: YouTube Integration)

**Tech debt traps:** building a full RAG pipeline when NotebookLM's chat API can do direct Q&A against sources; overengineering the orchestration layer; storing NotebookLM auth in the project repo; adding playwright as a transitive dependency

**Security risks:** Google session cookies in `~/.notebooklm/storage_state.json` contain full Google account access; yt-dlp can be tricked into downloading non-YouTube content if URLs aren't validated; API keys/cookies in environment variables leak through process listing

**"Looks done but isn't" checks:**
- NotebookLM integration: verify auth token refresh works after 2+ weeks without re-login
- yt-dlp transcripts: test with videos that have NO subtitles, ONLY auto-generated captions, and ONLY manual captions — three different code paths
- Graceful fallback: disable ALL RAG tools (`yt-dlp` not installed, `notebooklm` not authenticated, Brave Search API key absent) and verify research workflow produces identical quality to current LLM-only approach
- Latency: measure end-to-end time for a real research query through the full pipeline; if >3 minutes, the UX design is wrong
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: notebooklm-py Is an Unofficial Reverse-Engineered API — Not a Real API

**What goes wrong:**
notebooklm-py (v0.x, 2.4k GitHub stars) is an **unofficial** Python client that reverse-engineers Google NotebookLM's internal `batchexecute` RPC endpoint. There is no official NotebookLM API. The library:

1. **Requires browser-based Google login** to obtain session cookies (`SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, `__Secure-1PSID`, `__Secure-3PSID`). The `notebooklm login` command opens a Chromium browser via Playwright for the user to manually authenticate.
2. **Cookies expire every few weeks.** When they expire, ALL API calls fail with `RPCError` or return `None`. The only fix is re-running `notebooklm login` — which requires a GUI browser, meaning headless servers and CI/CD environments cannot self-heal.
3. **Google enforces strict rate limits** on the `batchexecute` endpoint. Manifestations: RPC calls returning `None`, `RPCError` with ID `R7cb6c`, `UserDisplayableError` with code `[3]`. Free tier: 50 chat queries/day. Paid tier: 500/day. Source limits: 50 per notebook (free), up to 600 (Ultra).
4. **Google can break the API at any time.** As an undocumented internal endpoint, Google has no obligation to maintain backward compatibility. A Google-side change can render notebooklm-py non-functional until the library maintainer reverse-engineers the new protocol.
5. **Account flagging risk.** Google's automated systems may flag accounts using unofficial API access. Reports exist of NotebookLM uploads triggering Google account lockouts (Reddit r/notebooklm, user reports of Terms of Service warnings followed by account disables). Google's API Terms of Service explicitly prohibit "reverse engineer[ing] or attempt[ing] to extract the source code from any API."

**Consequences:**
- Research pipeline has a **single point of failure** that depends on a third-party reverse-engineering effort
- Authentication requires human interaction (browser login) — cannot be fully automated
- Rate limits mean batch research operations will hit walls quickly
- Legal/TOS risk for users' Google accounts

**Why it happens:**
Google has not released an official NotebookLM API despite repeated community requests (Reddit r/notebooklm, June 2025: "it is in the plan" / "COMING SOON"). The gap between "NotebookLM is useful for research synthesis" and "there's no API" creates demand for unofficial solutions. notebooklm-py fills this gap, but inherits all the fragility of reverse-engineering.

**Prevention:**
1. **Design NotebookLM as a fully optional enhancement, never a requirement.** The research workflow MUST produce complete, high-quality output without NotebookLM. NotebookLM adds depth but its absence cannot degrade output.
2. **Implement auth health checks before every research operation.** Before spawning the NotebookLM pipeline, run `notebooklm auth check --json` and parse the result. If auth is invalid, skip NotebookLM entirely and log a user-visible message: `"NotebookLM unavailable (session expired). Run 'notebooklm login' to re-authenticate. Continuing with LLM-only research."`
3. **Implement aggressive timeouts.** NotebookLM operations should timeout after 60 seconds for chat queries, 120 seconds for source ingestion. If timeout fires, fall back to LLM-only synthesis.
4. **Use a dedicated Google account for NotebookLM automation**, not the user's primary Google account. If the account gets flagged, it doesn't affect the user's email/drive/photos.
5. **Monitor notebooklm-py releases** for breaking changes. Pin a known-good version in requirements but have a strategy for rapid updates when Google changes their endpoint.
6. **Consider alternatives for synthesis.** Instead of NotebookLM, the orchestration layer could feed gathered sources (transcripts, search results, docs) directly into the LLM's context window as structured prompts. This eliminates the NotebookLM dependency entirely while keeping the multi-source research pattern.

**Detection (warning signs):**
- `RPCError` appearing in research output
- Research operations returning empty or `None` results
- User reports "NotebookLM stopped working" after a few weeks
- Google account security alerts for the authenticated account
- notebooklm-py GitHub issues spike with "broken" reports

**Phase to address:**
NotebookLM Integration — first task must be auth validation and fallback design, not feature implementation.

**Confidence:** HIGH — based on Context7 notebooklm-py docs (authentication, troubleshooting, known limitations), GitHub teng-lin/notebooklm-py releases/issues, Reddit r/notebooklm user reports, Google API Terms of Service.

---

### Pitfall 2: yt-dlp Is in a Perpetual Arms Race with YouTube

**What goes wrong:**
YouTube actively combats third-party download/extraction tools. As of early 2026, YouTube has deployed multiple countermeasures:

1. **SABR (Server-Based Adaptive Bit Rate) enforcement.** YouTube forces SABR streaming for certain clients, which breaks yt-dlp's format extraction. Error: `"YouTube is forcing SABR streaming for this client"`. This is a 2026-era escalation — yt-dlp must implement new client spoofing strategies.
2. **nsig extraction failures.** YouTube's JavaScript player obfuscation changes regularly, breaking yt-dlp's signature decryption. Error: `"nsig extraction failed: Some formats may be missing"`. This is the MOST frequent breakage — multiple GitHub issues per month (#13241, #13249, #13252, #13260, #13968, #14707, #14734).
3. **Rate limiting escalation.** Recent reports (Reddit r/youtubedl, June 2026): yt-dlp now "sleeps for 5-6 seconds as required by the site" during normal operation. Downloading transcripts/subtitles triggers rate limits even faster than video downloads.
4. **PO Token requirements.** YouTube increasingly requires Proof of Origin tokens for certain operations. yt-dlp has implemented a PO Token Provider Framework, but it adds complexity and can fail independently.

For our use case (transcript extraction, not video download), the impact is:
- **Metadata extraction** (`--dump-json`) is generally reliable but still subject to rate limiting
- **Subtitle/transcript extraction** (`--write-subs`, `--write-auto-sub`) requires the same player decryption that breaks regularly
- **A pinned version of yt-dlp guarantees breakage within weeks** as YouTube deploys new countermeasures

**Consequences:**
- Research pipeline fails intermittently based on YouTube's current countermeasure state
- Users see cryptic error messages from yt-dlp that have nothing to do with their research query
- yt-dlp must be updated frequently (nightly builds sometimes required), which conflicts with reproducible builds

**Why it happens:**
YouTube's business model depends on ad views and YouTube Premium subscriptions. Third-party tools that extract content bypass both revenue streams. This is a structural conflict with no resolution — the arms race will continue indefinitely.

**Prevention:**
1. **yt-dlp for metadata ONLY, not for video/audio download.** Use `yt-dlp --dump-json --flat-playlist "ytsearch10:React hooks"` to get video titles, descriptions, durations, and URLs. This is the least-breakage path because metadata extraction is lighter than media extraction.
2. **Subtitles as a bonus, not a requirement.** Extract transcripts when available (`--write-auto-sub --sub-langs en --skip-download`), but design the pipeline to work with metadata-only (title, description, channel name) when transcripts are unavailable. Many dev tutorial videos (~30-40% based on community reports) lack any form of subtitles.
3. **Version management via `--update-to nightly` is a trap.** Instead, check yt-dlp version before each research operation and warn if it's >30 days old: `"yt-dlp version is outdated (installed: 2026.01.15, latest: 2026.03.01). YouTube extraction may fail. Run 'yt-dlp -U' to update."`
4. **Implement retry with exponential backoff.** First attempt fails → wait 2s → retry. Second fails → wait 5s → retry. Third fails → give up and continue research without YouTube data. Never block the research pipeline on yt-dlp failures.
5. **Add `--sleep-interval 2 --max-sleep-interval 5`** to all yt-dlp invocations to respect rate limits proactively.
6. **Cache successful transcript extractions.** Store extracted transcripts in `.planning/.cache/transcripts/` keyed by video ID. YouTube video content doesn't change after upload, so cached transcripts never go stale.

**Detection (warning signs):**
- `nsig extraction failed` in stderr output
- `SABR streaming` warnings
- yt-dlp commands taking >30 seconds for simple metadata queries
- Transcript extraction returning empty files
- `HTTP Error 429: Too Many Requests`

**Phase to address:**
YouTube Integration — design for failure from day one; never assume yt-dlp will work on any given day.

**Confidence:** HIGH — based on Context7 yt-dlp docs, 10+ GitHub issues from 2025-2026, Reddit r/youtubedl user reports, DEV Community article on 2026 YouTube blocking.

---

### Pitfall 3: Adding Python as a Runtime Dependency to a Zero-Dependency Node.js CLI

**What goes wrong:**
The current system (`gsd-tools.cjs`) has **zero runtime dependencies** — it's a single-file Node.js script that works with just `node`. Adding `notebooklm-py` (Python >=3.10, with `httpx`, `click`, `rich` dependencies, plus optional `playwright` for browser login) and `yt-dlp` (Python package or standalone binary) introduces an entirely new runtime:

1. **Python version fragmentation.** notebooklm-py requires Python >=3.10. macOS ships with Python 3 but may be 3.9. Many Linux distros still default to Python 3.8/3.9. Windows may not have Python at all. The Node.js CLI must discover which Python is available, and it might be `python`, `python3`, `python3.10`, or a full path.

2. **Virtual environment hell.** Best practice is to install Python packages in a venv, not globally. But:
   - Where does the venv live? Per-project (`.planning/.venv/`)? Per-user (`~/.config/gsd/venv/`)? Global (`/opt/gsd-python/`)?
   - Who creates the venv? The Node.js CLI doing `execSync('python3 -m venv ...')` on first run?
   - `venv` activation is shell-specific (`source bin/activate` vs `Scripts\activate.bat`). You can't "activate" a venv from Node.js — you must use the full path to the venv's Python binary.

3. **PATH resolution across `child_process`.** Node.js `execSync`/`spawn` inherits the parent's PATH by default, but:
   - On macOS, GUI applications (including the host editor) may not inherit the user's shell PATH. Python installed via Homebrew (`/opt/homebrew/bin/python3`) may not be on PATH in the editor's process environment.
   - If env is explicitly passed to `spawn()`, the parent's PATH may be overwritten (Node.js issue #34667 — "PATH environment variable is not updated in the spawned process" on Windows).
   - `PYTHONPATH` in the subprocess may differ from the user's terminal (Reddit r/node report).

4. **Cross-platform Python binary naming.** Windows: `python` (from Microsoft Store or Python installer). macOS: `python3` (Homebrew) or `/usr/bin/python3` (Xcode CLT). Linux: `python3` or `python3.10` or `python`. The Node.js CLI must try multiple names.

5. **yt-dlp installation methods diverge.** It can be: a pip package (`pip install yt-dlp`), a standalone binary (downloaded from GitHub releases), a system package (`brew install yt-dlp`, `apt install yt-dlp`), or a pipx-installed tool. Each method puts the binary in a different location with different update mechanisms.

**Consequences:**
- A tool that "just works" today becomes one that requires a setup wizard
- First-run experience goes from "instant" to "install Python, create venv, pip install dependencies, run browser login"
- Support burden increases dramatically — "yt-dlp not found", "Python version too old", "pip not available"
- Every new machine/environment requires redoing the Python setup

**Why it happens:**
NotebookLM's only available client library is Python. yt-dlp is written in Python. These are the tools available — there's no Node.js alternative for either.

**Prevention:**
1. **yt-dlp: prefer standalone binary over Python package.** yt-dlp publishes self-contained binaries (Linux, macOS, Windows) on GitHub releases. These have zero Python dependency. Detect with `which yt-dlp` or check common install paths. If not found, provide install instructions: `"yt-dlp not found. Install: brew install yt-dlp (macOS) / sudo apt install yt-dlp (Linux) / winget install yt-dlp (Windows)"`
2. **notebooklm-py: isolate in a managed venv.** Create venv at `~/.config/gsd/python-env/` (or `$NOTEBOOKLM_HOME`). On first use, the CLI checks for the venv, creates it if missing, installs notebooklm-py into it. All subsequent calls use the venv's Python binary directly: `execSync('~/.config/gsd/python-env/bin/python -m notebooklm ...')`. Never rely on PATH or venv activation.
3. **Implement a `gsd-tools util:check-tools` command** that validates all optional dependencies:
   ```
   yt-dlp:       ✓ installed (2026.02.14) — via standalone binary
   notebooklm:   ✗ not configured (run 'gsd-tools util:setup-notebooklm')
   brave-search: ✓ API key configured
   context7:     ✓ available via MCP
   ```
4. **Never make Python a hard requirement.** The tool MUST work without Python installed. All Python-dependent features are optional enhancements. The `package.json` engines field stays at `"node": ">=22.5"` — no Python requirement.
5. **Use `execFileSync` not `execSync` for spawning Python.** `execFileSync` avoids shell interpretation, is safer against injection, and is more predictable for PATH resolution.
6. **Test the "nothing installed" path rigorously.** The most common environment is: Node.js installed, Python not installed (or wrong version), yt-dlp not installed, NotebookLM not authenticated. This MUST produce zero errors and graceful degradation.

**Detection (warning signs):**
- `ENOENT` errors when spawning `python3` or `yt-dlp`
- "ModuleNotFoundError: No module named 'notebooklm'" in subprocess stderr
- Tests that pass in CI but fail on developer machines (different Python setup)
- Setup instructions growing beyond 5 lines

**Phase to address:**
Foundation — dependency detection and graceful degradation must be the FIRST thing built, before any feature code.

**Confidence:** HIGH — based on Node.js child_process documentation, Stack Overflow reports of Python/Node.js integration issues, GitHub nodejs/node issues, codebase analysis showing existing `execSync` patterns in gsd-tools.cjs.

---

### Pitfall 4: RAG Pipeline Latency Destroys the Research UX

**What goes wrong:**
The current research workflow (LLM-only) takes **10-30 seconds** — the LLM reads the prompt, searches with available tools (Brave Search, Context7), and synthesizes. Users experience this as fast. The proposed RAG pipeline introduces multiple serial stages:

| Stage | Latency | Source |
|-------|---------|--------|
| YouTube search (`yt-dlp --flat-playlist ytsearch10:...`) | 3-8 seconds | yt-dlp metadata extraction |
| Transcript extraction per video (up to 10 videos) | 2-5 seconds each, sequential | yt-dlp subtitle download |
| NotebookLM notebook creation | 1-3 seconds | notebooklm-py API |
| NotebookLM source ingestion (per source) | 2-10 seconds each, with required 2-second delays between sources | notebooklm-py docs recommend `asyncio.sleep(2)` between sources |
| NotebookLM chat query for synthesis | 5-30 seconds | Depends on source volume |
| **Total worst case** | **3-8 minutes** | Cumulative |

This is 10-50x slower than current research. For the common case where the user runs `/bgsd-new-project` and expects to get a project scaffold in under a minute, a 5-minute research phase is a UX disaster.

Additionally, NotebookLM artifact generation (audio, video) takes 3-45 minutes. While we're using chat/query not artifacts, the underlying API is rate-limited for all operations. Free tier: 50 chat queries/day means a researcher that queries NotebookLM 5 times per research run can only do 10 research operations per day.

**Consequences:**
- Users will perceive the RAG pipeline as "hanging" or "broken"
- Users will disable the feature via config rather than wait
- The 50-query/day free-tier limit means research becomes a scarce resource
- Long-running operations interact badly with the CLI's synchronous architecture

**Why it happens:**
The RAG pipeline involves network calls to three external services (YouTube, Google/NotebookLM, Brave Search) plus Python subprocess spawning. Each adds latency. The sequential nature of "gather → ingest → synthesize" creates a pipeline where total latency is the sum of all stages.

**Prevention:**
1. **Progressive output, not batch-at-the-end.** As each stage completes, emit progress to stderr:
   ```
   [research] Searching YouTube for "React hooks patterns"... (3s)
   [research] Found 8 videos, extracting transcripts... (12s)
   [research] 5/8 transcripts available, feeding to NotebookLM... (25s)
   [research] Synthesizing research from 12 sources... (45s)
   [research] Research complete. (52s total)
   ```
2. **Parallelize the gather phase.** YouTube search, Brave Search, and Context7 queries are independent — run them concurrently. Use `Promise.all` or parallel subprocess spawning from Node.js. This reduces gather phase from serial (8+5+3=16s) to parallel (max 8s).
3. **Limit YouTube videos to 5, not 10.** Diminishing returns beyond 5 videos. The top 5 search results are the most relevant; videos 6-10 add noise and double the transcript extraction time.
4. **Skip NotebookLM for small research tasks.** If total gathered content is <20KB (a few search results, no transcripts), feed it directly to the LLM as context. NotebookLM adds value only when synthesizing LARGE volumes of content that exceed the LLM's context window.
5. **Set a hard time budget.** Research phase gets a configurable timeout (default: 120 seconds). If the pipeline hasn't completed, use whatever partial results are available and synthesize with the LLM. `config.json`: `"research_timeout": 120`
6. **Cache aggressively.** Same YouTube search query for "React hooks" should return cached results for 24 hours. Same Brave Search results cached for 1 hour. Transcripts cached indefinitely (video content doesn't change).
7. **Show time estimates.** Before starting the RAG pipeline: `"Enhanced research pipeline will take ~45-90 seconds. Use --quick to skip (LLM-only, ~15 seconds)."` Let users opt out before waiting.

**Detection (warning signs):**
- User reports "research is stuck" or "taking forever"
- Research operations hitting the 120-second timeout regularly
- NotebookLM rate limit errors appearing mid-day
- Users adding `research: false` to config.json to avoid the pipeline

**Phase to address:**
Orchestration — latency budget must be designed before implementing the full pipeline. Time-box each stage.

**Confidence:** HIGH — based on notebooklm-py Known Limitations docs ("30 seconds to over 45 minutes"), NotebookLM tier limits documentation, yt-dlp observed latency from GitHub issues, existing gsd-tools timing from codebase analysis.

---

### Pitfall 5: YouTube Search Results Are Low-Signal for Developer Research

**What goes wrong:**
YouTube search for developer topics returns a mix of:
- **High quality:** Conference talks (React Conf, JSConf), well-known educators (Fireship, Theo, ThePrimeagen)
- **Low quality:** Clickbait ("Learn React in 10 minutes!"), outdated content (React class components tutorial from 2019), SEO-spam channels that repackage documentation as low-effort videos, AI-generated narration over copied slides
- **Irrelevant:** Videos with matching keywords but wrong context ("hooks" returning fishing content, "react" returning chemistry content)

When these are fed into NotebookLM for synthesis, the garbage sources pollute the synthesis output. NotebookLM doesn't distinguish between a React Conf talk by Dan Abramov and a clickbait tutorial by an unknown channel — both are "sources" with equal weight.

Specific failure modes:
1. **Outdated best practices.** YouTube search doesn't filter by date effectively. A 2019 video about React class components ranks well but teaches deprecated patterns.
2. **Title/description keyword stuffing.** Low-quality videos stuff descriptions with keywords that match search queries but content is shallow.
3. **No subtitles on quality videos.** Many conference talks and live-coding sessions lack subtitles. The best content is often the least accessible to transcript extraction.
4. **Auto-generated captions are noisy.** Technical terms are frequently misrecognized: "useState" → "use state", "TypeScript" → "type script", "Next.js" → "next JS" or "nexus". This corrupts the source material for RAG synthesis.

**Consequences:**
- Research output includes outdated or incorrect recommendations
- User trusts RAG-synthesized research less than LLM-only research (which at least has training data curation)
- Time spent ingesting bad sources is wasted — negative ROI vs LLM-only approach
- NotebookLM's query quota is consumed on garbage sources

**Why it happens:**
YouTube's search ranking optimizes for engagement (views, watch time, click-through rate), not for technical accuracy or currency. This is fundamentally misaligned with developer research needs.

**Prevention:**
1. **Pre-filter by channel reputation.** Maintain a curated allowlist of high-quality developer channels: `["Fireship", "Theo - t3.gg", "ThePrimeagen", "Traversy Media", "Web Dev Simplified", "Jack Herrington", "Ben Awad"]`. Only extract transcripts from videos by known channels. Others provide metadata-only (title, description) for potential relevance but not transcript ingestion.
2. **Filter by recency.** Append current year to search queries: `"React hooks best practices 2026"`. Discard videos older than 2 years for fast-moving topics (frameworks, libraries). Allow older videos for stable topics (algorithms, design patterns).
3. **Filter by video length.** Short videos (<5 min) are usually shallow overviews. Very long videos (>60 min) are often unedited livestreams. Sweet spot: 10-30 minutes for focused technical content.
4. **Use metadata as pre-filter, not as final source.** Extract metadata for 20 videos, filter to top 5 by heuristics (channel reputation, view count, recency, duration), then extract transcripts only for the filtered set.
5. **Transcript quality validation.** After extracting a transcript, check for minimum technical term density. If a video about "React hooks" has zero occurrences of "useState", "useEffect", "component", or "render" in its transcript, it's probably not about React — discard it.
6. **Weight sources in NotebookLM.** When adding sources to a notebook, put high-confidence sources (official docs via Context7, Brave Search results from official sites) first. YouTube transcripts go last. NotebookLM synthesis will naturally weight earlier/primary sources more heavily.
7. **Let the LLM evaluate YouTube results.** Instead of blindly feeding all transcripts to NotebookLM, have the research agent review the metadata and pick which videos to include. The LLM's judgment on relevance is better than keyword matching.

**Detection (warning signs):**
- Research output recommends deprecated patterns (e.g., React class components in 2026)
- Research includes contradictory recommendations from different videos
- Transcript content doesn't match the expected topic
- NotebookLM synthesis is vague/generic despite having many sources (diluted by noise)

**Phase to address:**
YouTube Integration — quality filtering must be implemented before transcript extraction is wired into the pipeline.

**Confidence:** MEDIUM — based on YouTube search behavior observation, community reports, general RAG quality literature. The specific percentage of developer videos with subtitles is estimated (30-40%) not measured.

<!-- /section -->

<!-- section: moderate_pitfalls -->
## Moderate Pitfalls

### Pitfall 6: NotebookLM Cookie Auth Creates a Security and Operational Nightmare

**What goes wrong:**
notebooklm-py stores Google session cookies at `~/.notebooklm/storage_state.json` with `0o600` permissions. These cookies provide full access to the authenticated Google account — not just NotebookLM, but Gmail, Drive, Photos, everything. The authentication flow:

1. Run `notebooklm login` — opens Chromium browser via Playwright
2. User logs into Google manually
3. Session cookies saved to `storage_state.json`
4. Cookies expire in "a few weeks" (no documented exact TTL)
5. When expired, user must re-login via browser

Operational issues:
- **Headless environments can't re-authenticate.** If running on a server or in a docker container, `notebooklm login` fails because it needs a GUI browser.
- **Chromium download required.** `playwright install chromium` downloads ~250MB of Chromium. This is a heavy dependency for a CLI tool feature.
- **Cookie file is a high-value target.** Anyone who obtains `storage_state.json` has full Google account access. It's equivalent to a password file.
- **Environment variable alternative (`NOTEBOOKLM_AUTH_JSON`)** puts cookies in an env var visible to any process that reads `/proc/PID/environ` on Linux.

**Prevention:**
1. **Document the security implications clearly.** When running `gsd-tools util:setup-notebooklm`, warn: `"This will store Google session cookies on disk. Use a dedicated Google account, not your primary account."`
2. **Never store NotebookLM auth in the project directory.** Auth goes in `~/.notebooklm/` or `$NOTEBOOKLM_HOME`, never in `.planning/`. The `.planning/` directory may be committed to git.
3. **Add `storage_state.json` and `*.notebooklm*` to the project's `.gitignore`** as a safety net.
4. **Implement auth expiry detection proactively.** Before research operations, run `notebooklm auth check --json`. If cookies are >7 days old (not just expired), warn: `"NotebookLM auth is 12 days old and may expire soon. Run 'notebooklm login' to refresh."`
5. **For CI/CD, provide a "no-NotebookLM" flag** that disables NotebookLM entirely, since re-authentication can't happen automatically.

**Phase to address:**
NotebookLM Integration — auth management is a prerequisite for any NotebookLM feature work.

---

### Pitfall 7: Scope Creep — Building a Full RAG System vs. Using Simpler Approaches

**What goes wrong:**
The project goal is "reduce LLM token spend while improving research quality." But the proposed pipeline (YouTube → NotebookLM → Synthesis) is a complex multi-service orchestration system. Simpler approaches might achieve 80% of the benefit at 20% of the complexity:

- **Just feed search results into the LLM prompt.** Brave Search returns snippets. Context7 returns docs. These are already structured text. Concatenating them into the research agent's prompt (with a "synthesize these sources" instruction) doesn't need NotebookLM at all.
- **YouTube metadata without transcripts.** Video titles and descriptions alone provide signals about what the ecosystem looks like: "React Server Components Tutorial — 2026 Update" tells you RSC is current without needing the full transcript.
- **NotebookLM's value is for LARGE corpus synthesis.** If total gathered content is under the LLM's context window (~200K tokens for Claude, ~128K for GPT-4), there's no need for a separate RAG system. The LLM IS the RAG system.

The risk is building a sophisticated pipeline that adds 3 minutes of latency, 2 external dependencies (Python, yt-dlp), and auth complexity (NotebookLM cookies) — when the LLM could do the same synthesis from the same sources in 15 seconds.

**Prevention:**
1. **Implement in layers, validate each layer's value:**
   - Layer 0 (current): LLM-only research
   - Layer 1: LLM + Brave Search + Context7 (already available via MCP)
   - Layer 2: Layer 1 + YouTube metadata (add yt-dlp, metadata only)
   - Layer 3: Layer 2 + YouTube transcripts (add transcript extraction)
   - Layer 4: Layer 3 + NotebookLM synthesis (add Python dependency)

   **Only build the next layer if the current layer is demonstrably insufficient.** Run the same research query at each layer and compare output quality.

2. **Define success metrics before building.**
   - Research output covers X% more sources than LLM-only
   - Research includes N practical examples not in LLM training data
   - Total time is under 2 minutes (hard cap)
   - Fallback to Layer 0 is seamless

3. **NotebookLM should be Layer 4, not Layer 1.** It has the most dependencies, highest latency, most fragile auth, and most operational complexity. Build everything else first and measure whether NotebookLM adds enough value to justify its cost.

**Phase to address:**
Architecture/Orchestration — design the layer progression before implementing any layer.

---

### Pitfall 8: Synchronous Architecture vs. Long-Running External Processes

**What goes wrong:**
gsd-tools.cjs uses `execSync` and `execFileSync` for all external process calls. This is correct for fast operations (git commands, file reads) but problematic for operations that take 10-60+ seconds:

1. **No progress feedback.** `execSync` blocks until the subprocess completes. The user sees no output for 30+ seconds while yt-dlp extracts transcripts.
2. **No timeout by default.** `execSync` waits forever. A hung yt-dlp process (network timeout, YouTube server error) hangs the CLI indefinitely.
3. **No parallel execution.** Sequential `execSync` calls for 5 transcript extractions means 5× latency. Switching to async `spawn` or `execFile` requires restructuring the calling code.
4. **stdio buffering.** `execSync` buffers the entire stdout/stderr into a string and returns it after the process exits. For a large transcript (10K+ lines), this is fine. But for a process that streams progress (yt-dlp's `[download]` messages), buffering loses the real-time feedback.

**Prevention:**
1. **Use `execFileSync` with `timeout` option.** All external tool calls get a timeout: `execFileSync('yt-dlp', [...], { timeout: 30000 })`. Timeout throws an error that's caught and triggers fallback.
2. **Use `spawnSync` with `stdio: ['pipe', 'pipe', 'pipe']` for operations needing progress.** Parse stderr line-by-line after completion to extract yt-dlp's progress information, then emit a summary.
3. **For truly long operations (NotebookLM), use async `spawn`.** The research orchestrator can use `child_process.spawn` (async) with event listeners, even though the rest of the CLI is synchronous. The orchestrator function becomes the async boundary:
   ```javascript
   function runResearchPipeline(query) {
     // This is the one place where we go async
     return new Promise((resolve, reject) => {
       const proc = spawn('python3', ['-m', 'notebooklm', ...]);
       // ... handle events ...
     });
   }
   ```
4. **Never block for >60 seconds without user feedback.** If an operation will take >5 seconds, emit a progress message to stderr before starting it.

**Phase to address:**
Foundation — establish the subprocess execution pattern before implementing any external tool integration.

<!-- /section -->

<!-- section: minor_pitfalls -->
## Minor Pitfalls

### Pitfall 9: Bundle Size Impact from New Orchestration Code

**What goes wrong:**
Current bundle is 1133KB (over the 1050KB soft budget). Adding orchestration code (YouTube search logic, NotebookLM API wrapper, source filtering, progress reporting) could push it further. However, since all Python/yt-dlp interaction is via subprocess calls (not bundled libraries), the impact should be modest — probably 10-30KB for new `src/lib/research.js` and `src/commands/research.js` modules.

**Prevention:** Monitor bundle size in build output. Set a hard cap at 1200KB for v8.1. If orchestration code is larger than expected, refactor verbose string templates into compact formats.

**Phase to address:** All phases — monitor continuously.

---

### Pitfall 10: Research Results Non-Determinism Across Runs

**What goes wrong:**
YouTube search results change over time. Brave Search results change. NotebookLM synthesis is non-deterministic. Running the same research query twice may produce different recommendations. This makes research output unreviewable — "was the research good?" becomes unanswerable if you can't reproduce it.

**Prevention:**
1. Log all gathered sources (URLs, video IDs, search queries) into a `research-sources.json` in `.planning/research/`. This creates an audit trail.
2. Cache gathered sources for 24 hours. Re-runs within the cache window produce identical inputs (synthesis may still vary due to LLM non-determinism).
3. Include source URLs in the research output files (SUMMARY.md, STACK.md, etc.) so human reviewers can validate.

**Phase to address:** Orchestration — implement source logging from the start.

---

### Pitfall 11: MCP Server Discovery Scope Creep

**What goes wrong:**
The v8.1 spec mentions "MCP server discovery for additional research tools." This could become a rabbit hole of auto-detecting available MCP servers, probing their capabilities, and dynamically routing research queries. The existing MCP profiling system (v4.0) already detects 20 known servers. Adding "discovery" implies finding UNKNOWN servers, which is an open-ended problem.

**Prevention:** Scope this to "recommend MCP servers that enhance research" — a static mapping, not runtime discovery. Example: if Brave Search MCP is available, use it; if Context7 MCP is available, use it. Print a list of recommended servers that aren't yet configured. Don't build a generic MCP discovery framework.

**Phase to address:** Research Workflow Integration — defer to the last phase; not critical for core pipeline.

<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Call `notebooklm-py` CLI directly instead of Python API | No Python API wrapper code needed | Slower (process spawn per operation), harder to handle errors, output parsing fragile | Acceptable for v8.1 MVP — optimize later if NotebookLM proves valuable |
| Skip YouTube channel reputation filtering | Simpler implementation, all results treated equally | Garbage sources pollute research; user trust degrades | Never — at minimum filter by video age and duration |
| Store yt-dlp binary path in config.json | Works for one machine | Path is machine-specific; breaks when config is shared or backed up | Acceptable if also falls back to PATH lookup |
| Skip progress reporting for external tools | Simpler code, fewer stderr writes | Users think tool is hung during 30+ second operations | Never — any operation >5 seconds needs progress feedback |
| Put NotebookLM auth check inline in research code | Works, fewer modules | Auth logic scattered across research functions; hard to test | Never — auth validation belongs in a single utility function |
| Hardcode YouTube search to English | Simpler queries, predictable results | Non-English users get worse research results | Acceptable for v8.1 — internationalize in future |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Node.js → Python subprocess | Using `execSync('python3 -m notebooklm ...')` | Use `execFileSync` with explicit Python path from venv: `execFileSync('/path/to/venv/bin/python', ['-m', 'notebooklm', ...])` |
| Node.js → yt-dlp | Parsing yt-dlp stdout with regex | Use `--dump-json` flag — yt-dlp outputs machine-readable JSON. Parse with `JSON.parse()`. |
| yt-dlp → NotebookLM | Feeding raw auto-captions as sources | Clean transcripts first: remove filler words, timestamp markers, and repeated lines. Auto-captions have 10-20% error rate. |
| NotebookLM → Research output | Taking NotebookLM synthesis verbatim | NotebookLM synthesis is a starting point. The research agent should validate, cross-reference with Context7/Brave results, and add confidence levels. |
| Config → tool availability | Checking tool availability once at startup | Check before each research operation. User may install yt-dlp mid-session. |
| Error handling → user messaging | Exposing raw Python tracebacks or yt-dlp errors | Catch subprocess errors, parse for known error patterns (auth expired, rate limit, nsig failed), and emit user-friendly messages. |
| Research cache → research output | Caching the final SUMMARY.md | Cache SOURCE MATERIALS (transcripts, search results). Never cache the synthesized output — different queries need different synthesis even from the same sources. |
<!-- /section -->

<!-- section: security -->
## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| NotebookLM `storage_state.json` readable by other users | Full Google account access (Gmail, Drive, everything) | Verify `0o600` permissions; never copy to `.planning/`; add to `.gitignore` |
| NotebookLM cookies in environment variables | Visible via `/proc/PID/environ` on Linux, `Get-Process` on Windows | Prefer file-based auth over `NOTEBOOKLM_AUTH_JSON` env var for local dev |
| yt-dlp invoked with unsanitized user input as URL | Command injection or downloading from arbitrary domains | Validate URLs match YouTube domain pattern before passing to yt-dlp; use `execFileSync` not `execSync` |
| Brave Search API key stored in `config.json` in `.planning/` | API key committed to git if `.planning/` is tracked | Store API keys in `~/.config/gsd/secrets.json` or environment variables, never in project directory |
| NotebookLM notebook contents visible to Google | Research queries and sources uploaded to Google's servers | Document this in privacy notice; don't upload proprietary/confidential source material |
| Cached transcripts contain copyrighted content | YouTube video transcripts are derivative works | Cache locally only; never redistribute; purge on project cleanup |
<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

- [ ] **NotebookLM integration "works":** Auth check passes today. Wait 2 weeks WITHOUT re-login. Does it still work? Cookie expiry is the real test, not initial auth.
- [ ] **yt-dlp transcript extraction "works":** Test with 3 videos: one with manual subtitles, one with auto-generated only, one with NO subtitles. All three cases must be handled gracefully. Test with a video that has subtitles in a non-English language only.
- [ ] **Graceful fallback "complete":** Uninstall yt-dlp, remove NotebookLM auth, remove Brave Search API key. Run `/bgsd-new-project`. Research phase must complete successfully using LLM-only approach. Zero errors, zero degraded output.
- [ ] **Latency "acceptable":** Time the full pipeline from research start to research files written. If >120 seconds, the architecture needs revision. If >60 seconds, progress reporting must be visible.
- [ ] **Source quality "verified":** Run research for a well-known topic (e.g., "React state management 2026"). Check research output for outdated recommendations (Redux vs. Zustand), deprecated patterns (class components), or contradictions. If found, source filtering is insufficient.
- [ ] **Python dependency "isolated":** Remove Python from PATH. Run all 762 tests. Every test must pass. Python is never required for core functionality.
- [ ] **Error messages "user-friendly":** Trigger each failure mode (auth expired, yt-dlp not found, rate limited, no subtitles, timeout). Every error must produce a clear, actionable message — never a raw traceback or cryptic error code.
- [ ] **Config "documented":** All new config options (`research_timeout`, `youtube_max_results`, `notebooklm_enabled`) appear in `gsd-tools settings list` output and have `--help` descriptions.
- [ ] **Cache "disposable":** Delete `.planning/.cache/`. Run research. Everything rebuilds automatically. No "cache corrupted" errors, no setup required.
<!-- /section -->

<!-- section: phase_warnings -->
## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Foundation / Dependency Detection | Python not found, wrong version, yt-dlp not installed | Multi-strategy discovery: check PATH, common install locations, venv; provide install instructions; never fail |
| YouTube Integration | nsig extraction failure, rate limiting, no transcripts | Retry with backoff; metadata-only fallback; transcript caching; version freshness check |
| NotebookLM Integration | Auth expired, rate limited, API changed | Health check before use; hard timeout; LLM-only fallback; monitor library releases |
| Orchestration Layer | Pipeline too slow, sources too noisy | Time-box each stage; parallel where possible; quality filtering before ingestion; progressive output |
| Research Workflow Integration | Existing agents confused by new data format | New research data must match existing SUMMARY.md / STACK.md / FEATURES.md / PITFALLS.md format exactly; research agent produces same output format regardless of data source |
| MCP Server Discovery | Scope creep into generic discovery framework | Static mapping of known research-relevant MCP servers; recommend, don't auto-discover |

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| NotebookLM API breaks (Google-side change) | MEDIUM | Disable NotebookLM in config; research falls back to LLM-only; wait for notebooklm-py update |
| yt-dlp breaks (YouTube countermeasure) | LOW | Update yt-dlp (`yt-dlp -U`); if still broken, disable YouTube in config; research continues without video sources |
| Google account flagged | HIGH | Switch to different Google account; re-run `notebooklm login`; if primary account, contact Google support |
| Python venv corrupted | LOW | Delete venv directory; re-run `gsd-tools util:setup-notebooklm`; venv rebuilds from scratch |
| Research output quality degraded | MEDIUM | Check source filtering heuristics; review cached transcripts for quality; tighten channel allowlist; increase recency filter |
| Pipeline timeout on every run | MEDIUM | Reduce YouTube video count; skip NotebookLM for small research; increase timeout; check network connectivity |

<!-- /section -->

<!-- section: sources -->
## Sources

- **Context7 notebooklm-py docs** (/teng-lin/notebooklm-py): Authentication system (cookie-based, browser login, 4-level auth precedence), rate limiting (batchexecute endpoint, RPCError R7cb6c, UserDisplayableError [3]), known limitations (artifact generation failures, 30s-45min processing times), error handling patterns — HIGH confidence
- **Context7 yt-dlp docs** (/yt-dlp/yt-dlp): Subtitle extraction (`--write-subs`, `--write-auto-sub`), rate limiting (`--sleep-interval`), player_skip options, PO Token Provider Framework — HIGH confidence
- **GitHub teng-lin/notebooklm-py**: Installation requirements (Python >=3.10, httpx, click, rich, optional playwright), authentication storage (`~/.notebooklm/storage_state.json`, `NOTEBOOKLM_AUTH_JSON`), cookie domain priority fixes — HIGH confidence
- **DeepWiki notebooklm-py analysis** (deepwiki.com/teng-lin/notebooklm-py/1.2-installation-and-setup): System requirements, browser-based login flow, token extraction process (CSRF SNlM0e, session FdrFJe), platform-specific notes — HIGH confidence
- **NotebookLM tier limits** (Brave Search, multiple sources: support.google.com, elephas.app, xda-developers.com, Medium): Free=50 sources/50 queries/day, Plus=100/500, Pro=300, Ultra=600 sources — HIGH confidence
- **yt-dlp GitHub issues** (#13241, #13249, #13252, #13260, #13968, #14707, #14734): nsig extraction failures, SABR streaming enforcement — HIGH confidence
- **Reddit r/youtubedl** (multiple 2025-2026 threads): Rate limiting escalation, sleep delays, IP bans — MEDIUM confidence
- **DEV Community** (dev.to/ali_ibrahim): 2026 YouTube SABR blocking, yt-dlp workarounds — MEDIUM confidence
- **Google API Terms of Service** (developers.google.com/terms): Reverse engineering prohibition — HIGH confidence
- **Reddit r/notebooklm**: Account flagging reports, API access questions, daily limit complaints — MEDIUM confidence
- **Node.js child_process docs** (nodejs.org/api/child_process.html): PATH issues on Windows, env passing, spawn vs execSync — HIGH confidence
- **Stack Overflow / GitHub nodejs/node**: Python subprocess from Node.js issues (venv activation, PYTHONPATH, ENOENT errors) — MEDIUM confidence
- **RAG quality literature** (dextralabs.com, nb-data.com, medium.com multiple authors): Garbage-in/garbage-out, irrelevant retrieval, chunk quality — MEDIUM confidence
- **Codebase analysis:** gsd-tools.cjs (28201 lines, execSync patterns), PROJECT.md (251 lines, v8.1 requirements), config.json schema (brave_search, research settings) — HIGH confidence

<!-- /section -->

---
*Pitfalls research for: bGSD Plugin v8.1 RAG-Powered Research Pipeline*
*Researched: 2026-03-02*
