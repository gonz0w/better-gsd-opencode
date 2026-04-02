# Milestone Research Architecture: v19.1 Execution Simplicity, Speculative Decoding & JJ-First UX

**Created:** 2026-04-02

## Recommended Architecture Shape

This milestone should be treated as a cross-cutting contract milestone with three implementation lanes:

1. **JJ-first runtime and UX contracts**
   - Primary areas: command help, workflow prompts, JJ helpers, commit/status checks, trajectory naming/semantics
   - Goal: align user-facing language and health checks with the existing JJ-backed execution model

2. **Deterministic simplification pipeline**
   - Primary areas: new `simplify:` command surface, execution workflow insertion point, phase reports/handoffs, executor rules/skill
   - Goal: add measurable post-execution simplification without changing behavior

3. **Structured output contract hardening**
   - Primary areas: agent prompts, workflow output frames, shared enums, template schemas, summary/verification plan artifacts
   - Goal: increase predictable token structure so speculation-friendly inference paths have more room to win

## Dependency Guidance

- JJ-first health/vocabulary corrections should precede deeper bookmark lifecycle automation.
- Simplification analysis/reporting should precede auto-executed simplification loops.
- Template/schema hardening should precede benchmarking claims about speculative-decoding improvement.
- Shared enums/output contracts should be reused across agent and template work rather than redefined per surface.

## Recommended Phase Boundaries

- Phase group A: JJ-first terminology + detached-HEAD correctness + bookmark intel
- Phase group B: simplify file discovery/analyze/report + execution insertion + bounded refactor loop
- Phase group C: output-frame anchoring + schema hardening + template consolidation + measurement/proof
