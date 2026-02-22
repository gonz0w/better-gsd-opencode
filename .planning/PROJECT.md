# GSD Plugin Performance & Quality Improvement

## What This Is

A zero-dependency, single-file Node.js CLI built from 15 organized `src/` modules via esbuild, producing `bin/gsd-tools.cjs`. It provides structured data operations for AI-driven project planning workflows. v1.0 established the test suite, module split, and observability layer. v1.1 added context reduction across all workflow layers (46.7% CLI output reduction, 54.6% workflow compression, 67% reference file reduction) and resolved all remaining tech debt.

## Core Value

Every improvement must make the plugin more reliable and faster for developers using GSD to plan and execute real projects — no regressions, no breaking changes.

## Current State: v1.1 Shipped

**Shipped:** 2026-02-22
**Milestones completed:** v1.0 (Performance & Quality), v1.1 (Context Reduction & Tech Debt)
**Total phases:** 9 (Phases 1-9) | **Total plans:** 24

All requirements validated. No known tech debt. 202 tests passing. Ready for next milestone.

## Requirements

### Validated

- ✓ 79 CLI commands with JSON-over-stdout interface — existing
- ✓ Zero-dependency single-file architecture — existing
- ✓ Markdown parsing with 309+ regex patterns — existing
- ✓ YAML frontmatter extraction and reconstruction — existing
- ✓ Git integration (commit, diff, log) via execSync — existing
- ✓ State management (STATE.md read/write/patch) — existing
- ✓ Roadmap analysis and phase management — existing
- ✓ Milestone detection with 5-strategy fallback — existing
- ✓ 19 test suites covering core parsing and state — existing
- ✓ Workflow orchestration via markdown prompts — existing
- ✓ Deploy script for live install — existing
- ✓ 15 feature commands (session-diff through quick-summary) — existing but unwired
- ✓ In-memory file cache to eliminate repeated reads — v1.0
- ✓ esbuild bundler pipeline with src/ module split — v1.0
- ✓ Debug logging (GSD_DEBUG) across all 96 catch blocks — v1.0
- ✓ Single CONFIG_SCHEMA constant (eliminated 3-way config drift) — v1.0
- ✓ Round-trip tests for 8 state mutation commands — v1.0
- ✓ Frontmatter round-trip tests (13 edge cases) — v1.0
- ✓ 11 slash commands wiring unwired features — v1.0
- ✓ Workflow integrations (validate-deps, search-lessons, context-budget) — v1.0
- ✓ package.json with engines, test/build scripts — v1.0
- ✓ Shell injection sanitization (sanitizeShellArg) — v1.0
- ✓ Temp file cleanup on exit — v1.0
- ✓ AGENTS.md line count fix — v1.0
- ✓ Parallel execution ASCII visualization — v1.0
- ✓ Per-command --help support (44 entries) — v1.0 + v1.1
- ✓ Config migration command — v1.0
- ✓ Batch grep in cmdCodebaseImpact() — v1.0
- ✓ Configurable context window size — v1.0
- ✓ Accurate BPE token estimation via tokenx — v1.1
- ✓ --fields flag for selective JSON output — v1.1
- ✓ Workflow baseline measurement (43 invocations) — v1.1
- ✓ Before/after token comparison — v1.1
- ✓ --compact flag (46.7% avg init output reduction) — v1.1
- ✓ --manifest flag (opt-in context loading guidance) — v1.1
- ✓ extract-sections CLI (dual-boundary parsing) — v1.1
- ✓ Top 8 workflow compression (54.6% avg reduction) — v1.1
- ✓ Research template summary/detail tiers — v1.1
- ✓ 202 tests passing (zero failures) — v1.1
- ✓ Complete --help coverage (44 commands) — v1.1
- ✓ Plan templates (execute, tdd, discovery) — v1.1

### Out of Scope

- Async I/O rewrite — Synchronous I/O is appropriate for CLI tool, not a real bottleneck
- npm package publishing — This is a plugin deployed via file copy, not a library
- Markdown AST parser — Would add heavy dependencies, regex approach is workable with better tests
- Multi-process file locking — Only one AI session runs per project, race conditions are theoretical
- Full argument parsing library (commander/yargs) — Manual router is well-suited to subcommand-heavy pattern
- ESM output format — CJS avoids __dirname/require rewriting, keep CJS
- RAG / vector search — Wrong architecture for a CLI tool
- LLM-based summarization — Deterministic compression outperforms (JetBrains NeurIPS 2025)

## Context

Shipped v1.0 + v1.1. 202 tests, 15 src/ modules, esbuild bundler.
Tech stack: Node.js 18+, node:test, esbuild, tokenx (bundled), zero runtime dependencies.
Source split into `src/lib/` (7 modules) and `src/commands/` (7 modules) + router + index.
Deploy pipeline: `npm run build` → esbuild bundle → `deploy.sh` with smoke test and rollback.

No known tech debt.

## Constraints

- **Backward compatibility**: All regex/parser changes must accept both old and new formats
- **No breaking changes**: Existing ROADMAP.md, STATE.md, PLAN.md files must keep working
- **Single-file deploy**: `deploy.sh` must continue to work — bundle to single file if splitting source
- **Node.js 18+**: Minimum version (for fetch, node:test) — formalized in package.json
- **Test against real project**: Always test against `/mnt/raid/DEV/event-pipeline/.planning/`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Allow dev dependencies via bundler | Enables esbuild, proper test tooling while keeping single-file deploy | Good — esbuild bundles 15 modules to single file in <500ms |
| In-memory Map cache over lru-cache | CLI is short-lived process (<5s); plain Map needs no eviction | Good — simpler, zero dependency |
| Extend existing test file | `bin/gsd-tools.test.cjs` already has patterns; adding to it is simpler than new test infrastructure | Good — 202 tests in single file |
| Debug logging over error throwing for catches | Most silent catches are "optional data" patterns; throwing would break workflows | Good — 96 catch blocks instrumented, zero behavioral change when GSD_DEBUG unset |
| Strip-shebang esbuild plugin | Monolith has shebang that breaks bundling; plugin strips on input, banner adds on output | Good — clean build pipeline |
| 15-module split (6 lib + 7 commands + router + index) | Logical grouping by domain, strict dependency direction | Good — maintainable, no circular imports |
| Config migration with .bak backup | Safe upgrade path for existing configs | Good — only creates backup when changes needed |
| Batch grep: fixed-string vs regex split | Different grep flags needed; 1-2 calls max regardless of pattern count | Good — eliminates per-pattern spawn overhead |
| tokenx for token estimation | 4.5KB bundled, ~96% accuracy, zero deps, ESM→CJS via esbuild | Good — replaced broken lines*4 heuristic |
| Split --compact/--manifest flags | Field reduction separate from guidance; eliminates manifest overhead from default path | Good — 46.7% avg reduction without manifest bloat |
| HTML comment section markers | Invisible to markdown rendering, machine-parseable | Good — dual-boundary parsing for headers + markers |
| Prose tightening over structural changes | AI agents don't need persuasion; imperative instructions are sufficient | Good — 54.6% avg workflow compression |

---
*Last updated: 2026-02-22 after v1.1 milestone completion*
