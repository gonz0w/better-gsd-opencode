# Domain Pitfalls: OpenCode Skills Integration

**Domain:** Skills-agent architecture migration
**Researched:** 2026-03-08

## Critical Pitfalls

Mistakes that cause regressions or agent degradation.

### Pitfall 1: Moving Agent Identity to Skills
**What goes wrong:** Agent's `<role>`, `<execution_flow>`, or `<structured_returns>` extracted to a skill. Agent spawns without knowing who it is or what it does. Must load a skill before it can begin — circular dependency.
**Why it happens:** Over-enthusiastic extraction. "This content exists in an agent, therefore it should be a skill."
**Consequences:** Agent produces generic/confused output. Every agent invocation has skill-loading latency. No graceful degradation.
**Prevention:** Only extract SHARED KNOWLEDGE (methodology used by 2+ agents). Agent identity stays inline. Test: "Can this agent do its job at all without this content?" If no → stays in agent.
**Detection:** Agent produces output that doesn't follow its expected structured format.

### Pitfall 2: Removing Quick Reference from Stubs
**What goes wrong:** Agent stub says "load gsd-goal-backward skill" with zero inline context. Skill loading fails silently. Agent has no idea what goal-backward methodology is.
**Why it happens:** Wanting maximum context savings. "The skill has everything, why duplicate?"
**Consequences:** Agent skips the methodology entirely. Plans without must_haves. Verification without truths. Silent quality degradation.
**Prevention:** Every stub must include 2-5 line "quick reference" summarizing the methodology. Enough for the agent to attempt the work (badly) without the skill.
**Detection:** Output missing expected sections (no must_haves in plans, no truths in verification).

### Pitfall 3: Skills Too Large (Defeating the Purpose)
**What goes wrong:** Skill SKILL.md is 500+ lines — essentially dumping the full reference into the skill. Loaded on-demand but when loaded, consumes same context.
**Why it happens:** Copy-pasting reference content verbatim into SKILL.md instead of condensing.
**Consequences:** No net context savings. Skill loads same payload as inline content. Overhead of tool call for no benefit.
**Prevention:** SKILL.md target: 100-150 lines maximum. Detailed content goes in `references/*.md` within the skill directory. Agent reads references via `mcp_read_skill_file` only when needed.
**Detection:** Skill file exceeds 200 lines. Compare total loaded content to original inline size.

## Moderate Pitfalls

### Pitfall 4: Premature Reference Deletion
**What goes wrong:** Reference file deleted before all consuming agents are migrated. Workflow still @-references a file that no longer exists.
**Prevention:** Phase 3 (cleanup) only after Phase 2 (agent migration) is COMPLETE and tested. Grep for all @-references before deleting any file. Delete one reference at a time, test between deletions.

### Pitfall 5: Skill Name Collision with Project Skills
**What goes wrong:** bGSD skill named `checkpoints` collides with a project-level skill also named `checkpoints`. Project-local overrides global. Agent loads wrong skill.
**Prevention:** Namespace all bGSD skills with `gsd-` prefix. `gsd-checkpoints`, not `checkpoints`.

### Pitfall 6: Agent Loads Skill Unnecessarily
**What goes wrong:** Agent loads 3-4 skills on every invocation "just in case," even when the task doesn't require them. Context usage matches or exceeds the inline approach.
**Prevention:** Skill descriptions must be specific about WHEN to use. Stubs must include conditional triggers ("If plan type is TDD, load gsd-tdd skill"). Don't make stubs say "always load this skill."

### Pitfall 7: deploy.sh Regression
**What goes wrong:** deploy.sh updated to copy skills but breaks existing agent/workflow deployment. Or skills not included in deploy, requiring manual copy.
**Prevention:** Test deploy.sh changes with full deployment cycle. Add skills deployment as additive step, don't restructure existing copy logic.

## Minor Pitfalls

### Pitfall 8: Inconsistent Skill Frontmatter
**What goes wrong:** SKILL.md missing required `name` or `description` field. Plugin silently ignores invalid skills. Agent can't find the skill.
**Prevention:** Validate every SKILL.md against the Zod schema (name: lowercase alphanum + hyphens, description: 20-1024 chars). Test each skill appears in `mcp_get_available_skills` output.

### Pitfall 9: Skill Content Drift
**What goes wrong:** Agent inline content updated but corresponding skill not updated (or vice versa). Agent stub references methodology that doesn't match what the skill provides.
**Prevention:** After migration, references/methodology should exist in ONE place only (the skill). Agent stubs are stable summaries that don't need updating. If skill content changes, stubs remain valid.

### Pitfall 10: Over-Testing Slows Migration
**What goes wrong:** Each skill creation requires full end-to-end testing of every workflow. Migration takes 10x longer than needed.
**Prevention:** Phase 1 (skill creation) is zero-risk — just write files, no existing behavior changes. Light testing (skill appears, loads correctly) is sufficient. Full workflow testing only in Phase 2 (agent migration).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Skill creation | Pitfall 3 (too large) | Target 100-150 lines per SKILL.md |
| Skill creation | Pitfall 8 (bad frontmatter) | Validate with plugin discovery |
| Agent migration | Pitfall 2 (no quick ref) | Always include 2-5 line summary in stub |
| Agent migration | Pitfall 1 (identity in skill) | Only extract shared methodology |
| Reference cleanup | Pitfall 4 (premature deletion) | Grep all @-references first |
| Deployment | Pitfall 7 (deploy.sh) | Additive changes only |

## Sources

- OpenCode skills validation schema: Context7 `/malhashemi/opencode-skills` (HIGH)
- Agent architecture: Live files `~/.config/oc/agents/*.md` (HIGH)
- Skills discovery: Context7 `/anomalyco/opencode` (HIGH)
