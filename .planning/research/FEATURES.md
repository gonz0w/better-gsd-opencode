# Milestone Research Features: v19.1 Execution Simplicity, Speculative Decoding & JJ-First UX

**Created:** 2026-04-02

## JJ-First UX & Bookmark Handling

### Table Stakes
- User-facing docs, workflows, and help use **bookmark** and **workspace** as the canonical local vocabulary
- JJ-backed repos treat detached Git HEAD as informational/expected instead of a generic failure
- Runtime can inspect bookmark state without relying on `git branch` or checked-out-branch assumptions

### Differentiators
- Logical branch abstraction is explicitly mapped to bookmark locally and remote branch only for Git interop
- Trajectory, commit, and recovery surfaces become internally consistent with the JJ-first execution model
- Operators get clearer health diagnostics from `jj status`, bookmark state, and workspace proof instead of Git-era warnings

## Simplification Engine

### Table Stakes
- bGSD can identify files changed in a phase and analyze only simplification targets
- CLI reports structured simplification opportunities with ranked severity/scores
- Phase execution can emit simplification reports and verification handoff artifacts

### Differentiators
- Auto-generated simplification plans create a bounded refactor-only follow-up loop before verification
- Simplification opportunities include duplication, dead code, cognitive/structural complexity, and clarity issues
- Before/after reporting makes simplification measurable instead of purely stylistic

## Speculative-Decoding Readiness

### Table Stakes
- Agent responses begin with stable, required output frames instead of conversational preambles
- Shared enums and schema ordering reduce output variance in plan/summary/verification artifacts
- Template branching is reduced where one canonical shape is sufficient

### Differentiators
- Inter-agent communication surfaces become predictably structured enough to benchmark speculation benefits
- Research-heavy agents and workflow files gain anchored output contracts instead of free-form framing
- Model-profile and benchmark guidance can tie structural changes to measurable latency/token-efficiency outcomes
