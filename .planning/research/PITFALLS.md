# Domain Pitfalls: v8.3 Agent Quality & Skills

**Domain:** Agent quality standardization + OpenCode skills migration
**Researched:** 2026-03-08
**Confidence:** HIGH

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Skill Description Quality Determines Agent Behavior
**What goes wrong:** Skills with vague descriptions like "GSD reference document" cause agents to either never load the skill (missing needed context) or load all skills eagerly (defeating lazy loading)
**Why it happens:** Developers treat the description field as documentation rather than as a **semantic router** — it's the ONLY signal agents use to decide whether to load
**Consequences:** Token waste (unnecessary loads), missing context (skipped loads), inconsistent agent behavior
**Prevention:**
- Write descriptions as "when to use" triggers, not "what it is" summaries
- Good: `"RACI responsibility matrix mapping each GSD lifecycle step to its responsible agent, with handoff contracts"`
- Bad: `"RACI reference document for the GSD system"`
- Test: Ask "If I were an agent doing task X, would this description make me load this skill?" for each common task
**Detection:** Agent conversations where skills are loaded but not used (waste) or where agents manually Read reference files instead of using available skills (missed load)

### Pitfall 2: Over-Migrating Agent Identity Into Skills
**What goes wrong:** Moving too much of an agent's system prompt into skills strips the agent of its role identity, execution flow, and decision-making logic
**Why it happens:** Temptation to reduce agent .md file sizes by extracting "everything shared" — but role definition, structured returns, and execution flow are NOT shared, they're identity
**Consequences:** Agents lose their specialized behavior, skill loading happens at wrong times, agent quality degrades
**Prevention:**
- **NEVER move to skills:** `<role>`, `<execution_flow>`, `<structured_returns>`, `<success_criteria>`, agent-specific gates
- **Move to skills:** Reference docs, patterns used by multiple agents, lookup tables, checklists
- Test: "Would removing this section change what the agent IS vs. what the agent KNOWS?" If identity → keep inline
**Detection:** Agent starts behaving generically, fails to follow specialized execution patterns

### Pitfall 3: Breaking Deploy Pipeline for Nested Skill Directories
**What goes wrong:** deploy.sh's `dest_for_file()` function handles flat files (agents/foo.md, commands/bar.md) but skills are nested directories (skills/gsd-raci/SKILL.md). Naive extension breaks path mapping.
**Why it happens:** Existing deploy.sh uses basename extraction, which works for flat files but loses directory structure for skills
**Consequences:** Skills deploy to wrong paths, OpenCode can't discover them, silent failure
**Prevention:**
- Handle skills/ paths separately in dest_for_file() preserving the parent directory
- Test deploy to temp directory first, verify `skills/<name>/SKILL.md` structure
- Add post-deploy verification step checking skill discovery
**Detection:** `opencode` startup doesn't show skills in `<available_skills>`, agent `skill()` calls fail

## Moderate Pitfalls

### Pitfall 4: Skill Name Conflicts Across Discovery Paths
**What goes wrong:** A project-local skill named `gsd-raci` (in `.opencode/skills/gsd-raci/`) conflicts with the global bGSD skill at `~/.config/opencode/skills/gsd-raci/`
**Why it happens:** OpenCode requires unique skill names across ALL discovery paths. If a user creates a project skill with the same name, behavior is undefined (project-local wins, but global is silently shadowed)
**Prevention:**
- Use `gsd-` prefix consistently for all bGSD skills (namespace convention)
- Document that users should not create project skills with `gsd-` prefix
- Accept that project-local skills can intentionally override global ones
**Detection:** Unexpected skill content loaded, agent follows wrong instructions

### Pitfall 5: Skills Not Available After Deploy Without Restart
**What goes wrong:** After `deploy.sh` copies new skills, the currently running OpenCode session doesn't see them — skills are discovered at startup and cached
**Why it happens:** No hot-reload for skills — this is by design in OpenCode
**Prevention:**
- Document in deploy.sh output: "Restart OpenCode to activate new skills"
- deploy.sh already handles this for agent changes; same applies to skills
**Detection:** New skills don't appear in `<available_skills>`, agents can't load them

### Pitfall 6: GitHub CI Agent Overhaul Breaking Existing Workflows
**What goes wrong:** Restructuring the CI agent's execution flow breaks the github-ci.md workflow that spawns it, or changes its structured return format that the workflow parses
**Why it happens:** Agent and workflow are coupled through specific tag formats, parameter names, and return structure
**Prevention:**
- Read github-ci.md workflow BEFORE modifying agent
- Preserve `<ci_parameters>` input format
- Preserve structured return format or update workflow simultaneously
- Test the full flow: `/bgsd-github-ci` → workflow → agent → result
**Detection:** CI workflow errors, missing parameters, unparseable agent returns

### Pitfall 7: Inconsistency Audit Without Clear Criteria
**What goes wrong:** The consistency audit becomes subjective opinion about "what's wrong" rather than a systematic evaluation against defined standards
**Why it happens:** No explicit criteria for what "consistent" means — each reviewer applies their own mental model
**Prevention:**
- Define audit checklist BEFORE starting:
  - Has `<role>` section with clear identity? ✓/✗
  - Has `<project_context>` block? ✓/✗ (standardized wording)
  - Has PATH SETUP block? ✓/✗
  - Has `<structured_returns>` section? ✓/✗
  - Has `<success_criteria>`? ✓/✗
  - Has estimated_tokens in frontmatter? ✓/✗
  - Has `<files_to_read>` handling? ✓/✗
- Score each agent against checklist, identify gaps
**Detection:** Audit produces vague "should be better" findings rather than specific action items

## Minor Pitfalls

### Pitfall 8: SKILL.md File Name Case Sensitivity
**What goes wrong:** File named `skill.md` or `Skill.md` instead of `SKILL.md` — OpenCode doesn't discover it
**Why it happens:** Case insensitivity on macOS hides the bug; Linux is case-sensitive
**Prevention:** Always use `SKILL.md` (all caps), add case check to deploy verification
**Detection:** Skill not appearing in available_skills on Linux deployments

### Pitfall 9: Skill Description Too Long Wastes Tokens
**What goes wrong:** Detailed 500+ character descriptions for each skill add up — 10 skills × 500 chars ≈ 1500 tokens added to EVERY agent's system prompt
**Why it happens:** Desire to be comprehensive in descriptions, not realizing every character is paid by every agent
**Prevention:** Target 50-150 character descriptions. The full SKILL.md body handles detail — the description only needs to trigger correct loading decisions
**Detection:** Monitor agent estimated_tokens after skills deployment, compare to baseline

### Pitfall 10: Reference Files Still Loaded by Agents After Skills Migration
**What goes wrong:** Agents still use `Read` tool to load reference files directly, in addition to loading them via skills — double token cost
**Why it happens:** Agent system prompts still contain instructions to "Read references/RACI.md" alongside skill availability
**Prevention:** When migrating a reference to a skill, update ALL agent definitions that reference it
- Search all agent .md files for each reference filename
- Replace `Read` instructions with skill loading guidance
**Detection:** Agent context contains same content twice (once from skill, once from Read)

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| GitHub CI overhaul | Breaking workflow-agent contract (#6) | Read workflow first, preserve interface |
| Consistency audit | Subjective criteria (#7) | Define checklist before starting |
| Skills creation | Vague descriptions (#1) | Write task-trigger descriptions, not summaries |
| Skills creation | Over-migration (#2) | Only move shared knowledge, never identity |
| Deploy pipeline | Nested directory handling (#3) | Test with temp directory, verify structure |
| Deploy pipeline | Restart requirement (#5) | Document in deploy output |
| Test debt cleanup | (Low risk) | Standard debugging, fix and verify |

## Sources

- OpenCode skills docs (discovery, validation, troubleshooting sections)
- malhashemi/opencode-skills plugin README (migration guide, known issues)
- bGSD deploy.sh source code (path handling patterns)
- bGSD agent .md files (duplication analysis)
- Reddit r/opencodeCLI skills discussion (community experience)

---
*Last updated: 2026-03-08*
