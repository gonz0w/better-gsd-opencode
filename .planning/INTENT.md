**Revision:** 8
**Created:** 2026-02-25
**Updated:** 2026-03-02

<objective>
An intelligent agent orchestration engine for building large-scale software. Provides structured planning, execution, verification, specialized agent coordination, and structured exploration — turning unstructured project ideas into executable plans with traceability from intent through requirements to delivered code. Optimized for minimal context loading, fast execution, and clean agent boundaries — each agent does one thing well with exactly the context it needs.
</objective>

<users>
- Software developers using AI coding assistants (OpenCode) for project planning and execution
- Solo developers managing complex multi-phase projects with AI assistance
- The GSD plugin's own development workflow (self-referential: planning GSD improvements using GSD)
</users>

<outcomes>
- DO-20 [P2]: Commands that are slow get profiled and optimized — measurable latency improvement where it matters
- DO-21 [P1]: Developer can checkpoint code state and decision context at any named point during execution
- DO-22 [P1]: Developer can pivot to a different approach with recorded reasoning, rewinding to a prior checkpoint
- DO-23 [P1]: Multiple attempts at the same task/plan/phase can be compared on outcome metrics (tests, complexity, LOC)
- DO-24 [P1]: Winning approach can be merged back while alternatives are archived as named branches
- DO-25 [P1]: Decision journal captures all trajectories — what was tried, why it was abandoned, what was chosen — consumable by agents and humans
- DO-26 [P2]: Trajectory exploration works at task, plan, and phase levels with appropriate granularity at each
</outcomes>

<criteria>
- SC-01: `intent create` produces valid INTENT.md; `intent show` renders it; `intent validate` passes
- SC-02: `intent trace` shows which outcomes have plans and which have gaps
- SC-03: `intent drift` produces numeric score; init commands show drift advisory
- SC-04: All GSD workflows (research, plan, execute, verify) receive intent context automatically
- SC-05: GSD's own .planning/INTENT.md is maintained alongside its roadmap
- SC-14: `trajectory checkpoint` creates named snapshot with code state + decision context
- SC-15: `trajectory pivot` records abandonment reason, rewinds code to checkpoint, writes context bridge file
- SC-16: `trajectory compare` shows outcome metrics (tests, complexity, LOC) across all attempts
- SC-17: `trajectory choose` merges winner and archives alternatives as named git branches
- SC-18: Decision journal entries are auto-injected into agent context during execution to prevent dead-end re-exploration
</criteria>

<constraints>
### Technical
- C-03: All operations are advisory — never block workflow execution

### Business
- C-04: Backward compatible — projects without codebase analysis work exactly as before
- C-05: Analysis adds value without adding ceremony — no mandatory steps

</constraints>

<health>
### Quantitative
- HM-02: All tests pass (669 currently) with zero regressions after each phase
- HM-03: Init commands complete in <500ms even with analysis context injection
- HM-04: Agent context load is measurably reduced vs v6.0 baselines (tokens per agent invocation)

### Qualitative
Orchestration should feel invisible — the right agent gets the right task with the right context, and the developer only sees results. Agent coordination overhead should decrease, not increase, as more specialized roles are added.
</health>

<history>
### v7.1 — 2026-03-02
- **Modified** objective: An intelligent agent orchestration engine for building large-scale software. Provides structured planning, execution, verification, specialized agent coordination, and structured exploration — turning unstructured project ideas into executable plans with traceability from intent through requirements to delivered code. Optimized for minimal context loading, fast execution, and clean agent boundaries — each agent does one thing well with exactly the context it needs.
  - Reason: Milestone v8.0: Added performance and agent architecture focus

</history>
