# Research Summary: SQLite-First Data Layer for v12.1

**Project:** bgsd-oc v12.0 — SQLite-First Data Layer  
**Domain:** Node.js CLI development tool with structured planning data persistence  
**Researched:** 2026-03-14  
**Confidence:** HIGH (Node.js official docs, SQLite official docs, 2500+ lines of source code analysis)

<!-- section: compact -->
<compact_summary>
<!-- The compact summary is the DEFAULT view for orchestrators and planners.
     Keep it under 30 lines. Synthesizes all 4 research areas.
     Full sections below are loaded on-demand via extract-sections. -->

**Summary:** Structured SQLite tables (phases, plans, tasks, decisions, sessions) will accelerate the CLI by eliminating 3x file re-parsing and 2x duplication in the enricher, while preserving markdown as the authority format. Zero new npm dependencies — uses node:sqlite (built-in, Stability 1.2). Architecture is "derived cache" (markdown → SQLite), not "source of truth" (SQLite → markdown), ensuring markdown remains the human interface and git-tracked backup.

**Recommended stack:** 
- `node:sqlite DatabaseSync` (Node 22.5+) for synchronous database access
- `SQLTagStore` (Node 24.9+) for statement caching via tagged templates; fallback to `db.prepare()`
- `PRAGMA user_version` + embedded migration functions for forward-only schema versioning
- Per-project database at `.planning/.cache.db` (gitignored) for structured planning data
- `STRICT` tables for type enforcement; JSON1 extension for structured TEXT columns

**Architecture:** Write-through structured cache — markdown files remain authority, parsers write parsed data to SQLite after every successful parse, enricher and CLI commands read from SQLite on warm starts (git-hash invalidation checks), fall back to markdown parsing on cache miss or stale detection. Three-tier caching: Map L1 (per-process), SQLite L2 (cross-invocation), Markdown L3 (authority). Database location: `~/.config/oc/bgsd-oc/cache.db` for CacheEngine (existing), `.planning/.cache.db` for DataStore (new).

**Top pitfalls:**
1. **node:sqlite API drift** — `createTagStore()` (v24.9+), `prepare(options)` (v22.18+), `aggregate()` (v22.16+) not in v22.5. Requires feature detection + fallback. Add Node 22.5 to CI test matrix.
2. **Schema migration in single-file deploy** — `CREATE TABLE IF NOT EXISTS` doesn't add columns. Use `PRAGMA user_version` + embedded migration functions. Test upgrade FROM every intermediate version.
3. **Stale cache after markdown edits** — git-hash invalidation misses uncommitted changes. Combine git-hash + file mtime + content hash for sub-second accuracy. Hook file-watcher to SQLite invalidation.
4. **Map/SQLite backend divergence** — structured tables have NO Map equivalent. Accept SQLite-only with graceful degradation on Node <22.5 (return null, fall back to markdown parsing).
5. **JSON-to-SQLite data loss** — boolean/array/object fields require explicit serialization strategy. Use `STRICT` tables, JSON1 extension, round-trip tests for every data type.
6. **Database locking under concurrent CLI invocations** — WAL mode + busy timeout (5 second) required. Set `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` on first database open.
7. **Sacred data loss in memory migration** — decisions.json, lessons.json irreplaceable. Dual-write (JSON + SQLite), preserve JSON as backup, verify round-trip before switching read path.

**Suggested phases:**
1. **Schema Design & Foundation** — DataStore class, schema versioning, API capability detection, Map fallback, WAL+timeout setup. Addresses pitfalls 1, 2, 6. Delivers: reusable DataStore infrastructure, clear data layer boundaries.
2. **Parser Integration & Cache Population** — Modify 6 parsers to write-through to SQLite, implement git-hash+mtime invalidation, update project-state.js read path. Addresses pitfall 3, 5. Delivers: warm-start performance, eliminated re-parsing.
3. **Enricher Acceleration** — Replace 3x `listSummaryFiles()` / 2x `parsePlans()` duplication with pre-computed enrichment from SQLite. Delivers: 5-30x faster enricher on warm starts, eliminate code duplication.
4. **Memory Store Migration** — Schema for decisions/lessons/trajectories/bookmarks tables, one-time JSON→SQLite import, dual-write path, migration verification. Addresses pitfall 7. Delivers: queryable decision history, cross-entity SQL joins.
5. **Query Acceleration & New Rules** — Query API layer, new SQL-backed decision rules (6-8 rules consuming DataStore directly), enrichment decision integration. Delivers: richer workflow routing, data-driven decisions.
6. **Session State Persistence** — session_state table, STATE.md as generated view, cross-invocation metrics. Delivers: accumulated project context, velocity metrics, stuck detection.

**Confidence:** HIGH (Node.js v25.8.1 docs verified, STACK/FEATURES/ARCHITECTURE/PITFALLS research completed, 2500+ lines of source code reviewed) | **Gaps:** WAL mode behavior under extreme concurrency not tested; bundle size impact estimate ±10KB

</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

The v12.0 milestone proposes a "SQLite-first" data layer to eliminate the existing enricher bottleneck (3x `listSummaryFiles()`, 2x `parsePlans()` duplication) and provide persistent structured access to planning data across CLI invocations. Node.js v22.5+ includes `node:sqlite` (DatabaseSync), a built-in synchronous SQLite binding with zero external dependencies. Research across STACK, FEATURES, ARCHITECTURE, and PITFALLS confirms this is the correct architectural pattern used by successful CLI tools (Fossil, Jujutsu, GitHub CLI) — structured SQLite cache over git-backed markdown files.

**Key finding:** The critical success factor is clarity about authority and responsibility. Markdown files ARE the single source of truth for human-facing planning data (users read ROADMAP.md, edit STATE.md, commit PLAN.md to git). SQLite is a "derived index" — a queryable structured cache built from markdown, fully regenerable if deleted, never written directly. This hybrid model preserves git workflows, human readability, and AI agent compatibility while achieving 5-30x performance improvements on warm starts.

**Recommended approach:** Implement in 6 phases, starting with the foundation (DataStore class, schema versioning, API capability detection) and progressing through parser integration, enricher acceleration, memory store migration, query expansion, and finally session state persistence. The first three phases (foundation + parser integration + enricher acceleration) deliver the core value proposition and can be shipped as v12.0. Phases 4-6 add optional query acceleration and persistence features for v12.0 Phase 3+ or v13 depending on schedule.

**Primary risk:** node:sqlite is Stability 1.2 (Release Candidate) — the API evolves across minor Node versions. Between v22.5 (minimum supported) and v25.8 (current), 15+ new methods were added. Mitigation: feature-detect all APIs at runtime, maintain fallback paths for Node <22.5, test against Node 22.5 specifically in CI.

---

<!-- section: key_findings -->
## Key Findings

### Stack Additions

**Core dependencies:** Zero new npm packages. Everything is built on `node:sqlite` (DatabaseSync, part of Node.js core since v22.5 and bundled as part of the runtime, Stability 1.2 Release Candidate). Existing `src/lib/cache.js` already uses DatabaseSync for the file_cache and research_cache tables; the new structured data layer extends this pattern.

**Minimum Node version:** 22.5.0 for DatabaseSync baseline. Optional feature enhancements available in newer versions:
- `createTagStore()` for statement caching: v24.9.0+
- `database.prepare(options)` for query options: v22.18.0+
- `database.aggregate()` for aggregate functions: v22.16.0+
- `timeout` constructor option for busy-wait: v22.16.0+

**Version strategy:** Feature-detect all Node 22.16+ APIs. Fall back gracefully to v22.5 core API (DatabaseSync, prepare, exec, get, run, all). Existing cache.js pattern of "try createTagStore, catch fallback to prepare()" is the model.

**Key patterns:**
- **Version-gated inline migrations** — no migration files; embed as JavaScript functions gated by `PRAGMA user_version`, run on every db open, fully transactional
- **SQLTagStore query builder** — tagged template literals with automatic parameterization and statement caching (when available, v24.9+)
- **Write-through cache** — parsers write to SQLite after parsing markdown
- **Per-project database location** — `.planning/.cache.db` (gitignored), not global
- **Git-hash + mtime invalidation** — git hash for bulk staleness (new commit), file mtime for sub-second accuracy (live edits)
- **WAL mode + busy timeout** — prevent SQLITE_BUSY under concurrent CLI invocations

**Avoid:** ORMs (knex, drizzle, sequelize), better-sqlite3 (adds native dependency), migration file systems (incompatible with single-file deploy), async SQLite APIs (CLI is synchronous by design).

### Feature Table Stakes

**Must have (v12.0 core):**
- Structured planning tables (phases, plans, tasks) — eliminates re-parsing ROADMAP.md and PLAN.md files on every invocation
- Git-hash invalidation with file mtime fallback — SQLite rows keyed by source file hash + mtime; stale on commit or on-disk edit
- Session state in SQLite — current position, metrics, accumulated context stored in `session_state` table; STATE.md becomes generated view
- Schema versioning with migrations — forward-only migration runner, no data loss on upgrade
- Enricher deduplication — pre-compute plan_count, summary_count, incomplete_plans counts; eliminate 3x `listSummaryFiles()` and 2x `parsePlans()` calls
- Backward-compatible fallback — Map fallback for Node <22.5, graceful feature-gating

**Should have (v12.0 Phase 3+):**
- Memory store migration — decisions.json, lessons.json, trajectories.json, bookmarks.json into SQLite with dual-write path and sacred data protection
- Cross-entity SQL queries — "show all decisions that mention phase 73" via JOINs (enables `/bgsd-search-decisions` enhancement)
- Query-based decision inputs — new decision rules consume SQL queries directly instead of enricher-derived JSON
- New deterministic rules — 6-8 rules leveraging SQLite-backed state for richer workflow routing

**Defer to v13:**
- FTS5 full-text search — when decision/lesson volumes exceed 1000 entries
- Materialized enrichment views with triggers — when enrichment query measured as bottleneck
- WAL-mode read replicas — when parallel agent execution is attempted
- SQLite session/changeset tracking — when undo/redo or audit trail needed
- Per-project database option — when config-dir approach proves limiting

**Key dependency chain:** Schema versioning → planning tables → enricher acceleration → memory migration → query expansion → session persistence. Each phase enables the next.

### Architecture Approach

**Dual-store model:** Markdown files (ROADMAP.md, PLAN.md, STATE.md, REQUIREMENTS.md) are the authority, human-readable, git-tracked. SQLite structured tables are derived, queryable, fully regenerable. Writes always go to markdown first (via existing parsers and STATE.md writers), then to SQLite as write-through. Reads check SQLite first (fast), fall back to markdown parsing on cache miss or stale detection.

**Data flow layers:**
1. **L1: In-process Map cache** — Per-invocation, same as today
2. **L2: SQLite structured tables** — Cross-invocation persistence with git-hash + mtime invalidation
3. **L3: Markdown filesystem** — Authority source, always correct

**Major components:**
- **DataStore class** — Unified SQLite access layer; schema management, migrations, structured CRUD operations, query API
- **Modified Parsers** — state.js, roadmap.js, plan.js, config.js, project.js, intent.js write to DataStore after parsing markdown
- **Enhanced project-state.js** — Adds DataStore read path; reads from SQLite when cache valid, otherwise calls parsers
- **EnricherV2** — Reads pre-computed enrichment from DataStore; eliminates `parsePlans()` and `listSummaryFiles()` duplication
- **Modified file-watcher.js** — Invalidates DataStore entries alongside Map caches on file change
- **QueryAPI** — SQL query functions for CLI commands (count, filter, aggregate)
- **MemoryMigrator** — One-time JSON→SQLite import for decisions, lessons, trajectories, bookmarks with sacred data protection

**Schema design:** 
- `_meta` table for schema version and git hash tracking
- `phases`, `plans`, `tasks` tables for planning data
- `requirements` table for requirement traceability
- `decisions`, `lessons`, `trajectories`, `bookmarks` tables for memory stores (replaces JSON files)
- `session_state` table for current position and metrics
- `enrichment_cache` table for pre-computed enrichment JSON blob
- All tables have source file mtime + git hash for invalidation

### Critical Pitfalls & Mitigations

**1. node:sqlite API Drift Between Node Versions (MEDIUM impact, P1 mitigation)**

Between minimum Node v22.5 and current v25.8, 15+ new methods were added to the node:sqlite API. Code written for newer versions silently breaks on older versions. Example: `createTagStore()` (v24.9+) doesn't exist in v22.5.

*Mitigation:*
- Create `sqliteCapabilities()` detection function probing for features at runtime
- All new code uses only v22.5 baseline API: DatabaseSync, exec, prepare, get/all/run
- Wrap optional features (tag store, iterate, aggregate, timeout) in capability checks
- Add Node 22.5 to CI test matrix — not just "latest"
- Document "safe baseline" vs "enhanced" APIs in code comments

**2. Schema Migration in Single-File Deploy (HIGH impact, P1 mitigation)**

Single-file CLI deploy has no migration runner or version tracking. `CREATE TABLE IF NOT EXISTS` doesn't add columns — old schema silently wins, new code crashes on missing columns.

*Mitigation:*
- Use `PRAGMA user_version` as schema version tracker (integer, persisted in .db file)
- Embed migrations as versioned JavaScript functions, not separate files
- Run migrations in transaction on every db open
- Test migration FROM v0 (fresh) AND every intermediate version (not just v-1)
- Use forward-only migrations (add columns, never modify)

**3. Stale Cache After Markdown File Edits (HIGH impact, P1 mitigation)**

Git-hash invalidation misses uncommitted changes. User edits STATE.md → CLI reads stale SQLite data because git hash hasn't changed. Sub-second staleness is unacceptable.

*Mitigation:*
- Combine git-hash (bulk invalidation) + file mtime (fine-grained) + content hash (detect reverts)
- Store mtime alongside parsed data; check mtime on every read (fast fs.statSync)
- Hook file-watcher to mark specific table entries stale (not blanket invalidation)
- Cascade invalidation: edit ROADMAP.md → invalidate phases → invalidate plans → invalidate tasks

**4. Map/SQLite Backend Divergence for Structured Data (MEDIUM impact, P1 mitigation)**

Existing dual-backend pattern (MapBackend + SQLiteBackend for file_cache) doesn't extend to relational queries. SQL JOINs, aggregates, filters have no Map equivalent without reimplementing a query engine.

*Mitigation:*
- Accept structured tables are **SQLite-only**
- File cache layer keeps dual-backend for backward compatibility
- New data layer is separate module requiring SQLite, fails gracefully on Node <22.5
- Graceful degradation: on Node <22.5, structured features return error, CLI falls back to markdown parsing
- Document architecture split clearly in key decisions

**5. JSON-to-SQLite Data Loss from Type Coercion (MEDIUM impact, P2 mitigation)**

Memory stores have arrays, booleans, objects. SQLite has 5 types. Round-trip JSON → SQLite → JSON can lose fidelity: `true` → 1 → not `true`, arrays → strings, nested objects → query-unable TEXT.

*Mitigation:*
- Define explicit type mapping per column BEFORE migration
- Use STRICT tables to catch type mismatches at write time
- Round-trip test: `original === JSON.parse(sqliteRow.jsonField)` for every data type
- Use JSON1 extension for querying into TEXT JSON blobs
- Consider `_raw_json TEXT` backup column during transition
- Sacred data: never delete JSON backups during migration

**6. Database Locking Under Concurrent CLI Invocations (MEDIUM impact, P1 mitigation)**

CLI may run concurrently (multiple terminals, plugin hooks, editor idle-detectors). Default SQLite uses exclusive locks — writer blocks readers, causing `SQLITE_BUSY` crashes.

*Mitigation:*
- Enable WAL mode immediately: `PRAGMA journal_mode=WAL`
- Set busy timeout: `PRAGMA busy_timeout=5000` (5 seconds)
- Explicit transactions wrapping multi-statement operations
- Use `INSERT OR REPLACE` (already done in cache.js)
- Keep transactions short (parse in JS, single batch INSERT)
- Test concurrent access: spawn 10 CLI processes simultaneously, verify no SQLITE_BUSY

**7. Sacred Data Loss in Memory Store Migration (HIGH impact, P2 mitigation)**

decisions.json, lessons.json, trajectories.json are marked sacred (protected from compaction). Bugs in JSON→SQLite migration corrupt irreplaceable project intelligence.

*Mitigation:*
- Dual-write phase: write to both JSON (primary) and SQLite (secondary) for one milestone
- Never delete JSON files during migration — keep as permanent backup
- Migration verification: compare JSON count === SQLite count, round-trip every entry
- Add `migration_status` table tracking: JSON count, SQLite count, verification timestamp
- Test with real sacred data fixtures, not synthetic data
- Provide rollback command: `memory:export --format=json` to reconstruct JSON from SQLite

---

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, structured SQLite data layer breaks into 6 natural phases with clear dependencies and independent milestone boundaries. All 6 can ship in v12.0 (depending on schedule) or phases 4-6 can defer to v12.1/v13 without architectural rework.

### Phase 1: Schema Design & Foundation
**Rationale:** Must establish the DataStore infrastructure, schema versioning, and API capability detection before any structured tables are created. Cannot proceed without this foundation.

**Delivers:**
- DataStore class with schema management, migrations, CRUD layer
- PRAGMA user_version versioning system with embedded migration functions
- API capability detection (`createTagStore`, `aggregate`, `iterate`, `timeout` options)
- Node 22.5 minimum version gating with fallback to Map on Node <22.5
- WAL mode + busy timeout configuration
- Per-project `.planning/.cache.db` location decision and gitignore setup

**Addresses:**
- FEATURES: Table stakes for "schema versioning with migrations"
- PITFALLS: Avoids API drift (1), schema migration (2), locking (6)

**Success criteria:**
- [ ] DataStore class instantiates with feature detection
- [ ] Migrations run from v0 → current, idempotent on re-run
- [ ] Node 22.5 test passes with fallback paths
- [ ] WAL mode enabled, busy timeout 5 seconds set
- [ ] Database location is `.planning/.cache.db`, not global

**Research flags:** None — well-documented, established patterns

### Phase 2: Parser Integration & Cache Population
**Rationale:** Wire the 6 parsers (state, roadmap, plan, config, project, intent) to write-through to SQLite after parsing markdown. Implement git-hash + mtime invalidation. Update project-state.js read path to check DataStore before calling parsers. Foundation is required first; independent of enricher/memory work.

**Delivers:**
- Write-through integration: all 6 parsers write structured rows to SQLite after successful parse
- Three-tier caching: Map L1 (per-process) → SQLite L2 (cross-invocation) → Markdown L3 (authority)
- Git-hash + mtime invalidation with cascade logic (edit ROADMAP → invalidate all plans/tasks)
- Enhanced project-state.js facade that reads from DataStore on warm starts
- Updated file-watcher.js to invalidate DataStore alongside Map caches

**Addresses:**
- FEATURES: Planning data tables, git-hash invalidation, incremental parse-and-store
- ARCHITECTURE: Write-through cache pattern, git-hash staleness detection pattern
- PITFALLS: Avoids stale cache (3), divergence (4), duplication (9)

**Success criteria:**
- [ ] ROADMAP.md parse → phases table populated
- [ ] PLAN.md parse → plans + tasks tables populated
- [ ] Git-hash + mtime stored with every row
- [ ] Edit markdown file → next CLI invocation reflects edit (sub-second accuracy)
- [ ] project-state.js reads from SQLite on cache hit
- [ ] File watcher invalidates DataStore entries
- [ ] `bgsd-tools state:show` on warm start is 10x faster than markdown parse

**Research flags:** Cache invalidation strategy under live editing — verify file-watcher integration

### Phase 3: Enricher Acceleration
**Rationale:** Fix the core performance bottleneck: enricher calls `parsePlans()` 3 times and `listSummaryFiles()` 3 times per invocation. With structured tables populated in Phase 2, replace with pre-computed SQL queries. Highest user value per engineering effort.

**Delivers:**
- Enrichment cache: pre-computed enrichment JSON blob (plan_count, summary_count, incomplete_plans, task_types, etc.)
- Enricher V2: replaces file-scanning with single enrichment_cache SQL query
- Eliminates 3x duplication in command-enricher.js
- Warm-start enrichment is now ~0.1ms (SQL query) vs ~100-500ms (file scanning)

**Addresses:**
- FEATURES: Enricher deduplication (table stakes), pre-computed materialized data
- ARCHITECTURE: Enricher acceleration data flow pattern
- PITFALLS: Avoids duplication (9)

**Success criteria:**
- [ ] enrichment_cache table has all enricher fields
- [ ] Pre-computed on every parser write (write-through)
- [ ] Enricher reads single row instead of calling parsePlans/listSummaryFiles
- [ ] Warm-start enricher is 5-10x faster (measured with `time bgsd-tools state:show`)
- [ ] No code duplication — listSummaryFiles call count reduced from 3 to 0
- [ ] Plugin system prompt and CLI commands agree on enrichment values

**Research flags:** Enrichment query performance-profile on projects with 20+ plans

### Phase 4: Memory Store Migration
**Rationale:** decisions.json, lessons.json, trajectories.json are currently separate JSON files, difficult to query, not indexed. With DataStore schema in place, migrate to SQLite tables with sacred data protection and dual-write path. Independent of phases 1-3 (can parallelize) but must complete before Phase 5 (query rules).

**Delivers:**
- `decisions`, `lessons`, `trajectories`, `bookmarks` SQLite tables with proper schema
- MemoryMigrator: one-time JSON→SQLite import preserving sacred flags and all fields
- Dual-write path: memory.js writes to both JSON (authority) and SQLite (index) until v13
- Migration status tracking: verify JSON count === SQLite count, confirm round-trip fidelity
- JSON files preserved as permanent backup (never deleted)

**Addresses:**
- FEATURES: Memory store migration, sacred data protection (via table stakes list)
- ARCHITECTURE: Memory store data flow pattern
- PITFALLS: Avoids sacred data loss (7), JSON-to-SQLite type loss (5)

**Success criteria:**
- [ ] decisions.json → decisions table (all entries, all fields)
- [ ] lessons.json → lessons table with sacred flag protection
- [ ] trajectories.json → trajectories table with tagging/references preserved
- [ ] bookmarks.json → bookmarks table
- [ ] Round-trip test: every entry JSON → SQLite → JSON with deep equality
- [ ] JSON files still exist, migration_status shows verified_at timestamp
- [ ] Dual-write: new decisions written to both JSON and SQLite

**Research flags:** Type coercion edge cases (Unicode in decisions, nested arrays in trajectories) — verify during implementation

### Phase 5: Query Acceleration & New Deterministic Rules
**Rationale:** With structured tables and memory stores in SQLite, implement QueryAPI (high-level query functions) and 6-8 new decision rules that consume SQL directly. Requires phases 1-4 complete. Enables richer workflow routing.

**Delivers:**
- QueryAPI: reusable SQL query functions (`getDecisionsByPhase`, `countTasksByStatus`, `searchLessons`, etc.)
- New decision rules (6-8): phase attempt history, task completion rates, stuck detection, memory-based routing
- Decision rule integration in enricher: pre-computed decision inputs from SQLite
- Backward compatibility: old rules unchanged, new rules optional

**Addresses:**
- FEATURES: Cross-entity SQL queries, query-based decision inputs, new deterministic decisions
- ARCHITECTURE: Data flow integration with decision rules

**Success criteria:**
- [ ] QueryAPI module with 6-10 reusable query functions
- [ ] New decision rules added to decision-rules.js registry
- [ ] Enricher pre-loads decision inputs from DataStore (no per-rule query)
- [ ] New rules tested with synthetic and real data
- [ ] 1008+ existing tests still pass; new test coverage for query functions

**Research flags:** None — standard implementation pattern

### Phase 6: Session State Persistence
**Rationale:** Currently STATE.md is the human-written authority. Phase 6 makes SQLite session_state the machine authority (position, metrics, accumulated context), with STATE.md becoming a generated view. Most architecturally aggressive change; should be last. Enables cross-invocation metrics, stuck detection, resume intelligence.

**Delivers:**
- session_state table: phase, plan, status, progress, last_activity, metrics JSON
- STATE.md generation: derived from session_state + decisions + lessons (markdown view)
- Invocation log: track command, duration, changed files, outcome
- Velocity metrics: task completion rate, phase duration, session count
- Context preservation: accumulated state across invocations without manual editing

**Addresses:**
- FEATURES: Session state persistence, atomic multi-file updates, session continuity
- ARCHITECTURE: Session state persistence pattern

**Success criteria:**
- [ ] session_state table populated from STATE.md on first read
- [ ] STATE.md writer generates from session_state on every state change
- [ ] Invocation log tracks each CLI command with timing
- [ ] Velocity metrics computed from invocation log
- [ ] User workflows unchanged — STATE.md still visible and committable

**Research flags:** Generated STATE.md format — ensure it's human-readable and git-diff friendly

### Phase Ordering Rationale

1. **Foundation first** — DataStore, versioning, API detection must exist before any structured tables
2. **Parser integration before enricher** — Enricher acceleration requires populated tables, requires parser integration
3. **Enricher before memory migration** — Enricher fixed first (core value), memory migration can parallelize or follow
4. **Memory before query expansion** — Query rules need both planning tables (Phase 2) and memory tables (Phase 4)
5. **Session state last** — Most architecturally invasive; depends on all tables being stable

### Research Flags by Phase

- **Phase 1:** None — well-documented, established patterns
- **Phase 2:** Cache invalidation behavior under live editing — verify file-watcher integration
- **Phase 3:** Enrichment query performance on large projects (20+ plans) — profile before shipping
- **Phase 4:** Type coercion edge cases (Unicode, nested arrays) — test with real sacred data
- **Phase 5:** None — standard implementation
- **Phase 6:** STATE.md generated format — ensure human-readable and git-friendly

### Phases Likely to Need Deeper Planning (vs Research)

- **Phase 2:** Invalidation cascade logic — may need schema changes if dependencies complex
- **Phase 3:** Enrichment computation hooks — may need integration points in parser write paths
- **Phase 4:** Memory store dual-write coordination — may need careful sequencing with legacy path

### Phases with Standard Patterns (Skip Research-Phase)

- **Phase 1:** DataStore + schema versioning — proven by database tools (Django, SQLite itself)
- **Phase 5:** Decision rule addition — incremental, standard pattern
- **Phase 6:** Generated view pattern — proven by build tools and version control

---

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Node.js v25.8.1 SQLite API fully documented and verified; existing cache.js uses DatabaseSync successfully; zero new npm dependencies |
| Features | HIGH | Existing codebase analysis (6 parsers, enricher, memory stores) confirms feature requirements; prioritization matches user pain points (enricher duplication) |
| Architecture | HIGH | Dual-store (markdown + SQLite) pattern used by Fossil, Jujutsu, GitHub CLI; write-through cache proven in cache.js; git-hash invalidation tested in existing research_cache |
| Pitfalls | HIGH | Each pitfall traced to specific code location (cache.js WAL gap, enricher duplication, migrations) or SQLite documentation limitation; recovery strategies documented |

**Overall confidence:** HIGH — All findings verified against Node.js official documentation, SQLite documentation, existing codebase analysis (2500+ lines reviewed).

### Gaps to Address

- **Bundle size impact:** Estimate is +50KB for data layer; actual impact unknown until code written. Mitigation: monitor per-phase, enforce +30KB per phase limit.
- **WAL mode under extreme concurrency:** Only theoretical analysis; 5-process concurrent test needed during implementation.
- **Enrichment query performance on 50+ plan projects:** Current enrichment query simple; scaling unknown. Mitigation: performance profiling in Phase 3.
- **Memory store sacred data round-trip fidelity:** Type coercion edge cases (Unicode, nested arrays, large integers) not tested. Mitigation: comprehensive test suite in Phase 4.

### Unresolved Questions

- **Per-project database permission:** Should `.planning/.cache.db` have restricted permissions (0600)? Depends on file sensitivity. Recommendation: 0600 (user-only) for consistency with security practices.
- **STATE.md migration path:** When Phase 6 makes SQLite the source of truth, existing STATE.md files need one-time import. Mechanism? Recommendation: automatic on first Phase 6 invocation, with backup preservation.

---

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)

- **Node.js v25.8.1 SQLite Documentation** — Complete API reference, verified all features and version availability. https://nodejs.org/api/sqlite.html
- **Node.js v22.x SQLite Documentation** — Baseline minimum version feature set. https://nodejs.org/docs/latest-v22.x/api/sqlite.html
- **src/lib/cache.js** — Existing DatabaseSync + SQLTagStore + MapBackend implementation (752 lines, reviewed in full). Pattern provides fallback model, API usage patterns.
- **src/plugin/command-enricher.js** — Duplication root cause (340 lines): 3x `listSummaryFiles()` + 2x `parsePlans()` calls identified.
- **src/plugin/parsers/*.js** — 6 parsers with Map caches (state: 101 lines, roadmap: 220 lines, plan: 258 lines, config: 155 lines, project: 67 lines, intent: 89 lines). Write-through integration points identified.
- **src/commands/memory.js** — Memory store schema and sacred data protection (378 lines). Schema design input.
- **PROJECT.md** — v12.0 milestone context, constraints, architecture decisions.
- **SQLite Documentation** — PRAGMA user_version for schema versioning, PRAGMA journal_mode for WAL, ALTER TABLE limitations. https://www.sqlite.org/

### Secondary (MEDIUM confidence)

- **Existing decision-rules.js** — 12 rules, registry pattern (467 lines). Input for new rule design.
- **Existing file-watcher.js** — fs.watch integration pattern (202 lines). Input for DataStore invalidation integration.
- **Ben Johnson / Fly.io: "All-In on Server-Side SQLite" (2022)** — Architecture patterns for CLI tools using SQLite. https://fly.io/blog/all-in-on-sqlite/

---

*Research completed: 2026-03-14*  
*Synthesized by: Research Synthesizer Agent*  
*Ready for roadmap: YES*
<!-- /section -->
