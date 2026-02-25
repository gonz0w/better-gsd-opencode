**Revision:** 1
**Created:** 2026-02-25
**Updated:** 2026-02-25

<objective>
A zero-dependency CLI plugin that provides structured planning, execution, and verification workflows for AI-driven software development.

The plugin turns unstructured project ideas into executable plans with traceability from intent through requirements to delivered code, optimized for single-developer + AI-assistant workflows.
</objective>

<users>
- Software developers using AI coding assistants (OpenCode, Claude Code) for project planning and execution
- Solo developers managing complex multi-phase projects with AI assistance
- The GSD plugin's own development workflow (self-referential: planning GSD improvements using GSD)
</users>

<outcomes>
- DO-01 [P1]: Every project captures why it exists and what success looks like in a structured, machine-readable format (INTENT.md)
- DO-02 [P1]: AI agents automatically see project intent in their context, aligning decisions with stated goals
- DO-03 [P1]: Work that drifts from stated intent is detected and flagged before execution (advisory, not blocking)
- DO-04 [P2]: Plans trace back to desired outcomes, creating full traceability from intent to delivered code
- DO-05 [P2]: Verification checks deliverables against desired outcomes and success criteria, not just requirements
- DO-06 [P3]: Intent evolves across milestones with tracked reasoning for changes
</outcomes>

<criteria>
- SC-01: `intent create` produces valid INTENT.md; `intent show` renders it; `intent validate` passes
- SC-02: `intent trace` shows which outcomes have plans and which have gaps
- SC-03: `intent drift` produces numeric score; init commands show drift advisory
- SC-04: All GSD workflows (research, plan, execute, verify) receive intent context automatically
- SC-05: GSD's own .planning/INTENT.md is maintained alongside its roadmap
</criteria>

<constraints>
### Technical
- C-01: Zero external dependencies — Node.js standard library only
- C-02: Single-file CLI bundle (gsd-tools.cjs) stays under 450KB
- C-03: All intent operations are advisory — never block workflow execution

### Business
- C-04: Backward compatible — projects without INTENT.md work exactly as before
- C-05: Intent system adds value without adding ceremony — no mandatory steps

### Timeline
- C-06: v3.0 milestone ships all intent features (capture, trace, validate, integrate)
</constraints>

<health>
### Quantitative
- HM-01: Bundle size ≤ 450KB after all intent features
- HM-02: All tests pass (335+ currently) with zero regressions after each phase
- HM-03: Init commands complete in <500ms even with intent parsing

### Qualitative
Intent features should feel like a natural extension of existing GSD workflows, not a bolted-on afterthought. The advisory model (warn, don't block) preserves developer flow while adding alignment awareness.
</health>
