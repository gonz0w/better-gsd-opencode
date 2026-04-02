# Milestone Research Summary: v19.1 Execution Simplicity, Speculative Decoding & JJ-First UX

**Created:** 2026-04-02
**Scope:** Milestone-level planning synthesis from approved EDD inputs plus current-source validation
**Confidence:** HIGH for JJ bookmark/detached-HEAD guidance, MEDIUM for speculative-decoding optimization impact in this repo, MEDIUM for simplification-sequencing details

## Executive Summary

This milestone combines three tightly related improvement streams: phase-output simplification, speculative-decoding-friendly contract hardening, and JJ-first bookmark/workspace UX normalization. The supplied EDDs are internally consistent: all three favor deterministic contracts over extra agent complexity, and all three are safer when delivered across multiple phases instead of as one repo-wide rewrite.

The best milestone shape is to land JJ-first correctness and vocabulary cleanup early, then add deterministic simplification analysis and reporting around execution, and finally tighten agent/workflow/template output contracts once the artifact shapes are stable. That sequencing reduces the risk of building new behavior on top of incorrect Git-era assumptions or unstable document schemas.

## Primary Recommendation

Create a multi-phase milestone that first fixes JJ-first bookmark/health semantics, then adds the simplify analysis + refactor loop, then hardens structured output contracts for speculative-decoding efficiency and measurable token-latency gains.

## Key Findings

### 1. JJ bookmarks are the right local branch abstraction

- Jujutsu official docs define bookmarks as named pointers to revisions and explicitly state there is no active/current/checked-out bookmark.
- Jujutsu Git-compatibility docs explicitly say colocated workspaces commonly leave Git in detached HEAD because JJ does not use Git's current-branch model.
- Therefore detached HEAD must not be treated as a generic failure in JJ-backed repos, and local user-facing language should prefer bookmark/workspace terminology.

### 2. Simplification belongs between execution aggregation and verification

- The simplify EDD proposes a deterministic CLI analyzer plus a refactor-only executor loop.
- This placement avoids verifying pre-simplified code and then changing it afterward.
- The safest early slice is analysis/reporting/handoff first, followed by auto-generated simplification plans and bounded execution loops.

### 3. Speculative decoding gains depend on predictable output frames, not just better models

- The speculative decoding EDD correctly targets structural tokens, enum values, stable key ordering, and preamble suppression as high-probability opportunities.
- Current vLLM documentation confirms speculative decoding works best for latency-focused, medium-to-low-QPS scenarios and that gains vary by model family, hardware, and sampling configuration.
- Milestone scope should therefore focus on making bGSD outputs more structurally predictable and benchmarkable, not claiming guaranteed throughput gains from prompt changes alone.

## Recommended Milestone Categories

1. **JJ-First UX & Bookmark Handling**
2. **Simplification Engine**
3. **Speculative-Decoding Readiness**

## Sequencing Guidance

1. Fix incorrect JJ/Git mental-model mismatches first.
2. Add simplification analysis/reporting before auto-executed simplification loops.
3. Tighten templates and structured output contracts after milestone artifact shapes are stable.
4. Keep benchmark/proof tasks close to speculative-decoding contract changes so benefit claims stay evidence-backed.

## Sources

### Primary
- `.planning/research/SIMPLIFY-EDD.md`
- `.planning/research/SPECULATIVE-DECODING-EDD.md`
- `.planning/research/JJ-FIRST-UX-EDD.md`
- https://jj-vcs.github.io/jj/latest/bookmarks/
- https://jj-vcs.github.io/jj/latest/git-compatibility/
- https://docs.vllm.ai/en/latest/features/speculative_decoding/

### Important caveats

- Simplification thresholds and scoring should be treated as milestone-level defaults until validated against this repo's real codebase patterns.
- Speculative-decoding improvements need repo-local measurements; structural tightening alone is not proof of user-visible speedup.
