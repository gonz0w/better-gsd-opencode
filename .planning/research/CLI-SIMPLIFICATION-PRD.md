# CLI Simplification PRD

**Project:** bGSD Plugin
**Author:** OpenCode
**Date:** 2026-03-30
**Status:** Backlog
**Target window:** Next architecture cleanup milestone after current model-config work

## Problem

The CLI has accumulated too much routing, parsing, help metadata, and cross-command behavior in a small number of oversized files.

The immediate symptom is not just maintainability pain. It is cognitive overload:
- humans have to load too much local context to safely change one command
- LLMs hit the same problem and report the code as overwhelming before they can act confidently
- behavior is represented in multiple places, so simple edits require synchronized changes across router, help, discovery, and command modules
- hidden global state and repeated hand-written flag parsing make behavior harder to predict and test

The result is a codebase that still works, but is increasingly expensive to understand, modify, and trust.

## Goal

Simplify the CLI architecture without losing capability or breaking existing workflows.

The simplified system should:
- preserve current user-facing functionality and backward compatibility
- reduce the amount of code a maintainer or LLM must load to change one command
- give the codebase one canonical source of truth for command shape, aliases, help, and dispatch
- remove hidden runtime coupling caused by globals and direct `process.argv` reads inside handlers
- make future command additions cheaper, safer, and more testable

## Non-Goals

- Removing useful commands just to make the surface look smaller
- Rewriting the product away from the current namespace-based CLI model
- Changing markdown-backed planning artifacts or the single-file bundle deployment model
- Large user-facing UX redesign beyond clarifying canonical command routes and aliases
- Solving every historical cleanup item unrelated to command-system complexity

## Primary User Need

As a maintainer or agent working in this repo, I want each command family to be easy to locate, reason about, and modify without loading thousands of unrelated lines, so that I can extend the CLI safely and keep LLM-driven work reliable.

## Why This Matters Now

Recent feedback is direct: `router.js` and related command files now feel out of control, and the LLM regularly reports that the codebase is overwhelming.

That is a product problem, not just an internal code-style problem:
- overwhelmed agents produce slower, lower-confidence work
- maintainers avoid touching risky files, which concentrates even more behavior into existing buckets
- every new command or flag increases drift risk because the command system has no single canonical definition

## Current State Audit

### Codebase scale

Current `src/` snapshot:
- 181 JavaScript files
- 73,401 lines of JavaScript
- 19 files over 1,000 lines
- 41 files over 500 lines
- the top 10 files account for roughly 29.7% of all JS LOC

This is not inherently bad, but the size is concentrated in a few command-system files that sit directly on the critical path for almost every CLI change.

### Hotspot 1: `src/router.js` is acting as a god object

Observed state:
- `src/router.js` is 1,657 lines
- it contains 48 `case` branches
- it contains 127 `indexOf('--...')` flag parses and 18 `includes('--...')` flag checks
- it mixes startup/runtime detection, output-mode setup, DB init, exact-match validation, command history, alias handling, and namespace dispatch
- it also owns command-specific argument parsing for many subcommands

Why this hurts:
- changing one command requires understanding unrelated startup and dispatch logic
- command parsing is repeated by hand, so behavior is inconsistent and value validation is weak
- the router has too many reasons to change, which makes it the highest-risk file in the CLI path

### Hotspot 2: oversized bucket modules hide subdomains inside giant files

Largest command files today:
- `src/commands/verify.js` - 3,197 lines
- `src/commands/misc.js` - 2,990 lines
- `src/commands/research.js` - 2,415 lines
- `src/commands/init.js` - 2,245 lines
- `src/commands/features.js` - 2,194 lines
- `src/commands/state.js` - 1,500 lines
- `src/commands/codebase.js` - 1,502 lines
- `src/commands/phase.js` - 1,448 lines

Why this hurts:
- these files are not single modules anymore; they are internal subsystems hidden behind one filename
- unrelated handlers share one file, so local edits drag in too much unrelated context
- review, ownership, testing, and reuse become harder because boundaries are unclear

### Hotspot 3: command metadata is split across multiple sources of truth

Command behavior and discoverability are currently spread across at least three major places:
- `src/router.js` for dispatch and parsing
- `src/lib/constants.js` for 148 `COMMAND_HELP` entries
- `src/lib/commandDiscovery.js` for aliases, categories, command trees, autocomplete, and validation hints

Why this hurts:
- every command addition or rename risks drift between execution, help, and discovery
- the system cannot reliably generate docs or validation from one canonical model
- maintainers must remember several update points for what should be one conceptual change

### Hotspot 4: hidden global state acts as an implicit control plane

Observed state:
- 61 references to `global._gsd*` across `src/`
- `src/router.js` sets output, compact, manifest, fields, defaults, and notice globals
- `src/commands/init.js` alone references `global._gsdCompactMode` 13 times and `global._gsdManifestMode` 12 times
- `src/commands/features.js` temporarily mutates output globals to measure other commands

Why this hurts:
- command behavior depends on implicit ambient state rather than explicit inputs
- tests must save and restore globals, which increases brittleness
- in-process command reuse becomes dangerous because handlers can leak mode changes

### Hotspot 5: handlers still read `process.argv` directly

Observed state:
- `src/commands/init.js` reads `process.argv` for `--refresh` and `--agent=...`
- command behavior is therefore partly controlled outside the router's parsed inputs

Why this hurts:
- command handlers are not pure with respect to their arguments
- router cleanup is harder because some parsing is secretly duplicated downstream
- reuse from tests or in-process helpers becomes less reliable

### Hotspot 6: duplicate command surfaces and duplicate implementations add noise

Examples found in the current tree:
- `util:history` and `util:examples` are implemented inline in `src/router.js` even though `src/commands/misc.js` already exports `cmdHistory` and `cmdExamples`
- cache functionality is exposed through both `util:cache` and `cache:*`
- verification behavior is split across top-level verify routes and nested `verify:verify ...` forms

Why this hurts:
- the command surface feels larger than the real capability set
- duplicate implementations drift over time
- compatibility paths are mixed with primary paths instead of being modeled clearly as aliases

### Hotspot 7: repeated compact/manifest shaping in `init.js`

Observed state:
- `src/commands/init.js` contains repeated compact-result construction for many handlers
- it has 25 `global.` references and 6 `process.argv` reads
- the same pattern repeats: build full result -> carve compact subset -> optionally attach `_manifest`

Why this hurts:
- every init command pays a boilerplate tax
- compact and verbose outputs can drift apart field-by-field
- mode handling dominates the file instead of the actual workflow-specific data gathering

### Hotspot 8: repeated filesystem and markdown matching logic is spread across modules

Examples:
- plan-file matching patterns like `f.endsWith('-PLAN.md') || f === 'PLAN.md'` appear in at least 21 places
- summary-file matching patterns are duplicated across helpers, phase, misc, verify, intent, plugin parsers, and features

Why this hurts:
- low-level conventions are not centralized
- naming-rule changes become broad search-and-edit operations
- repeated inline predicates add noise that hides business logic

### Hotspot 9: oversized constants file mixes unrelated concerns

Observed state:
- `src/lib/constants.js` is 1,977 lines
- it contains config schema, model defaults, validation lists, and a very large help-text table

Why this hurts:
- it is no longer a small shared constants module
- unrelated changes compete inside one broad file
- help text is harder to keep aligned with routing because it does not live next to command definitions

## Root Cause Summary

The main issue is not that the repo is large. The main issue is that the command system is represented imperatively and redundantly.

Today, one command may require touching:
- router dispatch
- router argument parsing
- command implementation
- help metadata
- discovery metadata
- alias handling

That architectural shape multiplies cognitive load much faster than the feature set itself.

## Product Direction

Adopt a declarative command architecture with explicit request context and smaller domain-oriented command modules.

The desired direction is:
- one canonical command registry
- one shared option parser
- one explicit `cliContext` object passed through handlers
- one top-level output boundary
- one canonical route per feature, with aliases modeled as compatibility shims
- smaller internal files aligned to subdomains rather than historical buckets

This keeps behavior stable while reducing the amount of code and hidden state involved in any one change.

## Proposed Architecture

### 1. Canonical command registry

Create one registry that defines, for each command:
- namespace
- subcommand path
- handler reference
- option schema
- aliases
- help text or help metadata
- deprecation status when relevant

The router should dispatch from this registry instead of manually encoding command knowledge in nested switch trees.

### 2. Shared option parser

Replace most ad hoc `indexOf('--flag')` logic with a small internal parser driven by the registry schema.

The parser should support:
- boolean flags
- single-value flags
- repeated values when needed
- required-flag validation
- basic type coercion for integers and booleans

This preserves current CLI semantics while removing a large amount of repetitive parsing code.

### 3. Explicit immutable `cliContext`

Build a per-invocation context object once in the router and pass it through handlers.

The context should contain:
- `cwd`
- output mode
- compact/verbose mode
- manifest mode
- requested fields
- defaults behavior
- debug/runtime notices

Handlers should stop reading `global._gsd*` and stop reading `process.argv` directly.

### 4. Split large command files into domain modules

Keep public command names stable, but reorganize internals into focused files.

Recommended internal splits:
- `src/commands/verify/` for quality, assertions, references, artifacts, search, and health validation
- `src/commands/init/` for phase bootstrap, project bootstrap, review/security/release bootstrap, and memory bootstrap
- `src/commands/misc/` for frontmatter, templates, history/examples, git helpers, recovery, and config utilities
- `src/commands/features/` for impact, trace, summaries, measurement helpers, and dependency analysis

Compatibility shims can preserve existing exports during migration.

### 5. Separate compatibility aliases from canonical routes

Model aliases in the registry rather than duplicating implementations in the router.

Principles:
- one canonical path per feature
- aliases continue to work for backward compatibility
- help and discovery surfaces teach canonical routes first
- deprecated aliases remain visible only where needed for compatibility

### 6. Move output shaping closer to a shared formatter boundary

Handlers should return structured result objects and optional formatter metadata.

The top-level runner should own:
- emitting formatted vs JSON output
- applying field filtering
- handling process exit status

This makes command logic more composable and reduces hidden coupling to output globals.

### 7. Centralize small conventions and predicates

Move repeated rules into shared helpers, including:
- plan-file detection
- summary-file detection
- manifest shaping helpers
- compact-output selection helpers
- common command-history and examples handling

This removes repeated inline logic that currently obscures the real feature behavior.

## Functional Requirements

1. Existing user-facing commands continue to work during migration.
2. Every command has one canonical registry definition used for dispatch, help, and discovery.
3. Command handlers receive explicit parsed options and request context rather than reading router globals.
4. Alias behavior remains backward compatible but is represented as alias metadata, not duplicate implementations.
5. `init` workflows preserve compact and manifest outputs, but those outputs are generated through shared helpers rather than repeated per-handler boilerplate.
6. Repeated file-matching and command-surface utilities are centralized into reusable helpers.

## Quality Requirements

1. A maintainer should be able to add or modify a command by editing one primary registry entry and one focused handler module.
2. Router-specific flag parsing should shrink materially from the current 127 `indexOf('--...')` call sites.
3. No command handler should read `process.argv` directly after migration.
4. No command handler should depend on `global._gsd*` for core behavior after migration.
5. Help and discovery output should be derivable from the same metadata used for dispatch.
6. Canonical command routing and alias behavior should be covered by tests.

## Proposed Delivery Plan

### Phase A - Establish the command registry

- define the registry shape
- move existing command metadata into registry entries
- generate exact-match validation and command discovery from the registry
- keep existing handlers unchanged where possible

Why first:
- it reduces drift without forcing a full rewrite
- it creates the backbone for the remaining refactors

### Phase B - Introduce shared option parsing

- add a schema-driven parser used by registry entries
- migrate high-churn router branches first
- validate required values centrally instead of silently passing `undefined`

Why second:
- it removes a large amount of repeated router code quickly
- it standardizes CLI behavior before handlers are split

### Phase C - Replace globals with `cliContext`

- build context once in the router
- pass context to handlers and output helpers
- remove `process.argv` reads from command modules
- migrate output/compact/manifest behavior to explicit options

Why third:
- it removes hidden coupling and makes subsequent file splits mechanical rather than risky

### Phase D - Split oversized modules

- break up `verify.js`, `misc.js`, `init.js`, and `features.js` into focused submodules
- keep temporary barrel exports for compatibility during rollout
- align files to subdomains, not historical catch-all buckets

Why fourth:
- once routing and context are explicit, file moves are safer and easier to review

### Phase E - Canonicalize duplicate surfaces

- route duplicate command shapes through one canonical implementation
- keep aliases where needed
- remove inline duplicate implementations from `src/router.js`
- move help/examples/history handling fully into dedicated command modules

### Phase F - Cleanup and verification

- centralize repeated predicates and manifest helpers
- prune outdated compatibility scaffolding where safe
- add focused tests for router, parser, aliases, and compact/manifest shaping
- update architecture docs so the new command model is the documented default

## Success Metrics

The work should be considered successful when most of the following are true:
- `src/router.js` is primarily startup + registry dispatch, not command-specific parsing
- router flag parsing drops substantially from current levels
- the largest bucket modules are split into smaller domain files
- help, discovery, and exact-match validation all read from the same registry data
- there are zero direct `process.argv` reads in command handlers
- there are zero core-behavior dependencies on `global._gsd*` in command handlers
- a new command can be added with a small, well-bounded change set
- LLMs can work on one command family without loading several thousand unrelated lines

## Risks

### Backward-compatibility risk

If aliases and nested command forms are collapsed too aggressively, existing workflows or docs may break.

Mitigation:
- keep aliases in the registry as first-class compatibility data
- migrate help surfaces before removing old routes
- add regression tests around canonical and alias forms

### Incremental migration risk

For a period of time, old and new routing patterns may coexist.

Mitigation:
- migrate namespace-by-namespace
- prefer compatibility shims over big-bang rewrites
- use clear completion criteria for each phase

### Test gap risk

The current router already has weak coverage for unusual flag combinations and missing values.

Mitigation:
- add parser tests as part of Phase B
- add registry/alias tests as part of Phase A
- add compact/manifest output tests as part of Phase C and D

## Recommended First Slice

The best first slice is not splitting files immediately.

The best first slice is:
1. introduce the registry
2. make help/discovery derive from it
3. move a small but representative namespace onto shared option parsing

That produces immediate simplification without a risky all-at-once rewrite, and it creates the foundation needed to safely break up `router.js`, `init.js`, `misc.js`, and `verify.js` afterward.

## Repo Evidence Summary

Key files informing this PRD:
- `src/router.js`
- `src/commands/init.js`
- `src/commands/misc.js`
- `src/commands/verify.js`
- `src/commands/features.js`
- `src/lib/constants.js`
- `src/lib/commandDiscovery.js`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONCERNS.md`

This proposal is intentionally functionality-preserving. The goal is not to make bGSD smaller by deleting features. The goal is to make the same capability legible, explicit, and maintainable again.
