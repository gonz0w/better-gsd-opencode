# Architecture: OpenCode Skills Integration with bGSD Agent System

**Domain:** Skills-agent architecture integration
**Researched:** 2026-03-08
**Overall confidence:** HIGH (verified against OpenCode source, Context7, and live installation)

---

## Current State Analysis

### Agent Architecture (9 agents)

The bGSD system has 9 specialized agents defined in `~/.config/oc/agents/*.md`:

| Agent | Lines | Role | @-References |
|-------|-------|------|-------------|
| gsd-planner | 1197 | Creates PLAN.md files | execute-plan.md, summary.md template |
| gsd-debugger | 1216 | Bug investigation | None (self-contained) |
| gsd-codebase-mapper | 770 | Codebase analysis | None (self-contained) |
| gsd-roadmapper | 655 | Creates ROADMAP.md | None (self-contained) |
| gsd-plan-checker | 655 | Validates plans | None (self-contained) |
| gsd-project-researcher | 637 | Domain research | None (self-contained) |
| gsd-verifier | 571 | Phase verification | None (self-contained) |
| gsd-phase-researcher | 518 | Phase research | None (self-contained) |
| gsd-executor | 483 | Executes plans | checkpoints.md, summary.md template |
| gsd-github-ci | 409 | CI/CD automation | None (self-contained) |

**Total agent system prompt lines:** 7,145

### Reference Files (12 files)

Shared knowledge loaded via `@`-references by agents and workflows:

| Reference | Lines | Consumers |
|-----------|-------|-----------|
| checkpoints.md | 746 | gsd-executor, execute-plan workflow |
| verification-patterns.md | 612 | gsd-verifier (conceptually — inline in agent) |
| tdd.md | 340 | execute-plan workflow |
| RACI.md | 291 | Architectural reference (not runtime) |
| continuation-format.md | 254 | resume-project workflow |
| git-integration.md | 248 | Commit conventions reference |
| ui-brand.md | 238 | Formatting conventions |
| questioning.md | 145 | Interaction patterns |
| model-profiles.md | 90 | Model selection |
| reviewer-agent.md | 89 | Post-execution review |
| phase-argument-parsing.md | 61 | Workflow utility |
| model-profile-resolution.md | 34 | Workflow utility |

**Total reference lines:** 3,148

### Current @-Reference Usage

**In agent definitions (direct @-references):**
- `gsd-executor.md` → `checkpoints.md`, `summary.md` template (2 refs)
- `gsd-planner.md` → `execute-plan.md` workflow, `summary.md` template (2 refs)
- All other agents: Zero @-references (fully self-contained)

**In workflows (orchestrator-level @-references):**
- `execute-plan.md` → `tdd.md` (1 ref)
- `research-phase.md` → `model-profile-resolution.md`, `phase-argument-parsing.md` (2 refs)
- `verify-work.md` → `UAT.md` template (1 ref)
- `resume-project.md` → `continuation-format.md` (1 ref)
- `execute-phase.md` → `execute-plan.md`, `summary.md` template (2 refs)

### Existing Project-Level Skills Pattern

Four agents (gsd-executor, gsd-planner, gsd-phase-researcher, gsd-plan-checker) already contain a `<project_context>` section checking `.agents/skills/` for project-level skills. This is for TARGET PROJECTS (projects being built by bGSD), not for bGSD's own skills:

```markdown
<project_context>
**Project skills:** Check `.agents/skills/` directory if it exists:
1. List available skills (subdirectories)
2. Read `SKILL.md` for each skill (lightweight index ~130 lines)
3. Load specific `rules/*.md` files as needed
4. Do NOT load full `AGENTS.md` files (100KB+ context cost)
</project_context>
```

This is a consumer-side pattern — the agents know how to READ skills from target projects. What we're building now is the PROVIDER side — making bGSD's own shared knowledge available AS skills.

### Shared Patterns Across Agents (Duplication Candidates)

**Duplicated verbatim across 4+ agents:**
1. PATH SETUP block (9/9 agents)
2. `<project_context>` skills loading (4/9 agents)
3. "Mandatory Initial Read" instruction (9/9 agents)
4. `GSD_HOME` resolution pattern (9/9 agents)

**Conceptually duplicated (each agent re-implements):**
1. Goal-backward methodology (planner, verifier, plan-checker, roadmapper — 4 agents)
2. Commit conventions (executor, github-ci — 2 agents, plus git-integration.md reference)
3. Deviation rules (executor only — but large, could be skill)
4. Checkpoint protocols (executor + planner — overlapping but different perspectives)

---

## OpenCode Skills Architecture

### How Skills Work (HIGH confidence — verified via Context7 + official docs)

**Discovery locations (priority order):**
1. `~/.config/opencode/skills/*/SKILL.md` — XDG global config
2. `~/.opencode/skills/*/SKILL.md` — Global fallback
3. `.opencode/skills/*/SKILL.md` — Project-local (overrides global)
4. `.agents/skills/*/SKILL.md` — Project-local (alternative path)
5. `.claude/skills/*/SKILL.md` — Claude Code compatibility

**Skill structure:**
```
skills/
  my-skill/
    SKILL.md              # Required — YAML frontmatter + instructions
    scripts/              # Optional — executable scripts
    references/           # Optional — supporting documentation
    assets/               # Optional — other files
```

**SKILL.md frontmatter (required fields):**
```yaml
---
name: my-skill              # lowercase alphanumeric + hyphens
description: Description    # 20-1024 chars, used for agent discovery
license: MIT                # optional
allowed-tools: [...]        # optional — restrict tool access
metadata:                   # optional — string→string map
  audience: developers
---
```

**How agents interact with skills:**
1. Agent sees list of available skill names + descriptions (lightweight)
2. Agent decides which skill is relevant to current task
3. Agent calls `skill({ name: "my-skill" })` tool to load it
4. Skill content is injected into conversation via **message insertion** (not tool response)
5. `noReply: true` ensures skill content persists through context compaction

**Key insight: Skills are ON-DEMAND.** Unlike @-references which are loaded at agent spawn time (adding to initial context), skills are loaded WHEN NEEDED. This is a significant architectural advantage for context efficiency.

### The opencode-agent-skills Plugin

The `opencode-agent-skills` plugin (registered in `opencode.json`) handles:
1. Scanning discovery directories at startup
2. Validating SKILL.md frontmatter against Zod schema
3. Registering each skill as a callable tool
4. Using message insertion (`noReply: true`) for content delivery
5. Providing base directory context for relative paths within skills

### Skills vs Agents vs References: Conceptual Model

| Mechanism | Loaded When | Context Cost | Persistence | Use For |
|-----------|-------------|-------------|-------------|---------|
| Agent definition | Agent spawned | Always (full prompt) | Full session | Core identity, execution flow |
| @-reference | Agent spawned (if referenced) | Always (appended) | Full session | Fixed dependencies |
| Skill | Agent calls tool | On-demand | Survives compaction | Shared knowledge, reusable patterns |
| Reference file | Workflow references it | Varies by orchestrator | Session-dependent | Workflow configuration |

---

## Integration Model: Skills as Shared Agent Knowledge

### Architecture Decision: What Moves to Skills vs What Stays

**Stays in agent definitions:**
- Role identity (`<role>` section)
- Execution flow (`<execution_flow>` section)
- Structured returns (`<structured_returns>` section)
- Success criteria (`<success_criteria>` section)
- Agent-specific formats (PLAN.md format in planner, VERIFICATION.md in verifier)

**Reason:** These define WHO the agent is and HOW it operates. They're identity, not knowledge. Removing them would require the agent to load a skill before it can function at all.

**Moves to skills (shared knowledge):**
- Goal-backward methodology (used by 4 agents)
- Checkpoint protocols (used by 2 agents + 1 workflow)
- Verification patterns (used by 1 agent but logically shared)
- TDD execution patterns (used by 1 workflow, 1 agent)
- Git/commit conventions (used by 2 agents)
- Deviation rules (large block in executor, could be skill)

**Reason:** These are knowledge domains multiple agents access. As skills, they're loaded on-demand, reducing initial context and enabling updates in one place.

**Stays as references (workflow configuration):**
- model-profiles.md (34+90 lines — tiny, workflow-specific)
- model-profile-resolution.md (34 lines — workflow utility)
- phase-argument-parsing.md (61 lines — workflow utility)
- continuation-format.md (254 lines — session-specific)
- RACI.md (291 lines — architectural documentation, not runtime)

**Reason:** These are either too small to justify skill overhead, too workflow-specific, or architectural documentation rather than reusable knowledge.

### Proposed Skills Architecture

```
~/.config/oc/skills/
├── gsd-goal-backward/
│   ├── SKILL.md           # Goal-backward methodology
│   └── references/
│       └── examples.md    # Detailed examples
├── gsd-checkpoints/
│   ├── SKILL.md           # Checkpoint protocols
│   └── references/
│       └── automation.md  # Automation-first patterns
├── gsd-verification/
│   ├── SKILL.md           # Verification patterns
│   └── references/
│       └── stub-detection.md  # Stub detection patterns
├── gsd-tdd/
│   ├── SKILL.md           # TDD execution patterns
│   └── references/
│       └── red-green-refactor.md  # Cycle details
├── gsd-git-conventions/
│   ├── SKILL.md           # Commit formats and conventions
│   └── references/
│       └── commit-formats.md  # Full format reference
└── gsd-deviation-rules/
    ├── SKILL.md           # Executor deviation rules
    └── references/
        └── examples.md    # Edge case examples
```

### SKILL.md Content Strategy

Each skill SKILL.md should be a **lightweight index** (~100-150 lines) that:
1. States WHAT this skill covers
2. States WHEN to use it
3. Provides the CORE rules/patterns (condensed)
4. Points to `references/*.md` for DETAILED examples

**Example: gsd-goal-backward/SKILL.md**
```yaml
---
name: gsd-goal-backward
description: Goal-backward methodology for deriving success criteria from outcomes. Used by planners, verifiers, and checkers to ensure work achieves goals not just completes tasks.
metadata:
  audience: gsd-agents
  domain: planning
---
```

```markdown
## What This Skill Provides

Goal-backward methodology: Start from outcomes, derive what must be TRUE,
then verify those truths exist.

## When To Use

- Planning phases (derive must_haves from phase goals)
- Verifying phases (check truths against codebase)
- Checking plans (verify plans will achieve goals)
- Creating roadmaps (derive success criteria per phase)

## Core Process

### Step 1: State the Goal (Outcome, Not Task)
- Good: "Users can securely access their accounts"
- Bad: "Build authentication"

### Step 2: Derive Observable Truths (2-7)
"What must be TRUE for this goal to be achieved?"
Each truth verifiable by a human using the application.

### Step 3: Derive Required Artifacts
For each truth: "What must EXIST?" → specific file paths

### Step 4: Derive Required Wiring
For each artifact: "What must be CONNECTED?"

### Step 5: Identify Key Links
"Where is this most likely to break?"

## Output Format

[condensed must_haves YAML format]

## Detailed Examples

See `references/examples.md` for worked examples.
```

### How Agents Reference Skills (Integration Points)

**Current model (inline in agent):**
```markdown
<goal_backward>
[400+ lines of methodology]
</goal_backward>
```

**New model (skill reference in agent):**
```markdown
<goal_backward>
For goal-backward methodology, load the `gsd-goal-backward` skill.

Quick reference: State goal → Derive truths → Derive artifacts → Derive wiring → Identify key links.

**Output format:**
```yaml
must_haves:
  truths: [...]
  artifacts: [...]
  key_links: [...]
```
</goal_backward>
```

**Key principle:** Agent retains a 3-5 line STUB that tells it a skill exists and gives minimal context. The skill provides the full methodology when loaded on-demand.

### Context Savings Estimate

| Content | Current (inline) | As Skill (stub) | Savings |
|---------|-----------------|-----------------|---------|
| Goal-backward (planner) | ~100 lines | ~5 lines | ~95 lines |
| Goal-backward (verifier) | ~50 lines | ~5 lines | ~45 lines |
| Goal-backward (roadmapper) | ~60 lines | ~5 lines | ~55 lines |
| Goal-backward (plan-checker) | ~30 lines | ~5 lines | ~25 lines |
| Checkpoints (executor) | ~90 lines inline + 746 @ref | ~5 lines | ~85 lines + remove @ref |
| Verification patterns | 612 lines ref | ~5 lines | ~607 lines (already @ref) |
| TDD (workflow ref) | 340 lines | ~5 lines | ~335 lines |
| Deviation rules (executor) | ~70 lines | ~5 lines | ~65 lines |

**Total estimated reduction:** ~700-900 lines across agents, plus 1,700+ lines of references that become on-demand skills instead of always-loaded @-references.

**More importantly:** Context cost shifts from ALWAYS LOADED to ON-DEMAND. An executor that doesn't hit a checkpoint never loads checkpoint knowledge. A planner working on simple CRUD never loads TDD knowledge.

---

## Component Boundaries

### What Changes

| Component | Change | Impact |
|-----------|--------|--------|
| `~/.config/oc/skills/` | New: 6 skill directories | New files |
| Agent definitions (9) | Modified: Replace inline blocks with skill stubs | Smaller agents |
| Reference files (12) | Some migrated to skills, some stay | Fewer references |
| opencode.json | No change (plugin already registered) | None |
| bgsd.js plugin | No change | None |
| gsd-tools.cjs | No change (skills are editor-level, not CLI-level) | None |
| Workflows | Modified: Replace some @-references with skill stubs | Smaller workflows |
| RACI.md | No change (handoff contracts unchanged) | None |

### What Does NOT Change

1. **RACI matrix** — Agent responsibilities unchanged
2. **Handoff contracts** — Artifacts passed between agents unchanged (PLAN.md, SUMMARY.md, VERIFICATION.md formats stay exactly the same)
3. **gsd-tools.cjs** — CLI tool has no skills concept; skills are at the editor/agent level
4. **Agent frontmatter** — Mode, tools, color, description unchanged
5. **Execution flows** — Step sequences within agents unchanged
6. **deploy.sh** — Skills deploy separately from CLI tool

### Data Flow With Skills

```
Before:
  Agent spawned → Full prompt loaded (role + methodology + formats + flows)
                → @-references appended (checkpoints.md, etc.)
                → All context consumed from line 1

After:
  Agent spawned → Lean prompt loaded (role + stubs + formats + flows)
                → During execution: skill("gsd-checkpoints") called when needed
                → Skill content injected via message insertion
                → Context consumed only when relevant
```

---

## Migration Strategy

### Principle: Incremental, Not Big-Bang

Each skill migration is independent. Agent with skill stub + skill file = working system. Agent without skill stub (unchanged) = also working system. No migration creates a dependency on another migration.

### Phase 1: Create Skills (No Agent Changes)

Create all 6 skills in `~/.config/oc/skills/`. At this point, skills exist but agents don't reference them. Skills are visible in the tool list but unused. This is a zero-risk operation.

**Build order:**
1. `gsd-goal-backward` — Highest reuse (4 agents)
2. `gsd-checkpoints` — Largest reference file (746 lines)
3. `gsd-verification` — Second largest reference (612 lines)
4. `gsd-tdd` — Third largest reference (340 lines)
5. `gsd-git-conventions` — Moderate size (248 lines)
6. `gsd-deviation-rules` — Executor-specific but large

**For each skill:**
1. Extract content from current agent/reference source
2. Write SKILL.md (condensed ~100-150 lines)
3. Move detailed content to `references/*.md` within skill
4. Test: Verify skill appears in agent tool list
5. Test: Verify `skill({ name: "gsd-xxx" })` loads content correctly

### Phase 2: Agent Slim-Down (One Agent at a Time)

Replace inline methodology blocks with skill stubs. Each agent is migrated independently.

**Build order (by impact / number of skills consumed):**
1. `gsd-planner` (1197 lines) — Uses goal-backward, checkpoints, TDD → highest savings
2. `gsd-executor` (483 lines) — Uses checkpoints, deviation-rules, git-conventions
3. `gsd-verifier` (571 lines) — Uses goal-backward, verification patterns
4. `gsd-plan-checker` (655 lines) — Uses goal-backward
5. `gsd-roadmapper` (655 lines) — Uses goal-backward (less)
6. `gsd-phase-researcher` (518 lines) — Minimal overlap
7. `gsd-project-researcher` (637 lines) — Minimal overlap (this agent)
8. `gsd-debugger` (1216 lines) — Mostly self-contained
9. `gsd-github-ci` (409 lines) — Uses git-conventions

**For each agent:**
1. Identify which skills the agent could use
2. Replace inline block with 3-5 line stub + skill name
3. Test: Run a representative workflow that uses this agent
4. Verify: Agent loads skill when encountering relevant task
5. Verify: Agent behavior unchanged (output quality same)

### Phase 3: Reference File Cleanup

After skills are stable, clean up reference files that were fully migrated:

| Reference | Disposition |
|-----------|------------|
| checkpoints.md | → `gsd-checkpoints` skill. Delete reference. |
| verification-patterns.md | → `gsd-verification` skill. Delete reference. |
| tdd.md | → `gsd-tdd` skill. Delete reference. |
| git-integration.md | → `gsd-git-conventions` skill. Delete reference. |
| RACI.md | KEEP — architectural documentation, not runtime |
| model-profiles.md | KEEP — workflow utility, too small for skill |
| model-profile-resolution.md | KEEP — workflow utility, tiny |
| phase-argument-parsing.md | KEEP — workflow utility, tiny |
| continuation-format.md | KEEP — session-specific, not shared knowledge |
| questioning.md | KEEP — small, agent-specific |
| reviewer-agent.md | KEEP — small, agent-specific |
| ui-brand.md | KEEP — formatting conventions, agent-specific |

**Net result:** 4 references → skills (1,946 lines), 8 references stay (1,202 lines)

### Phase 4: Workflow Updates

Update workflows that @-reference migrated files:

| Workflow | Current @-ref | New Approach |
|----------|--------------|-------------|
| execute-plan.md | `@tdd.md` | Skill stub: "Load gsd-tdd skill if plan type is tdd" |
| execute-phase.md | `@execute-plan.md`, `@summary.md` | Keep (these are workflows/templates, not knowledge) |
| research-phase.md | `@model-profile-resolution.md` | Keep (stays as reference) |
| verify-work.md | `@UAT.md` | Keep (template, not knowledge) |

---

## Deployment Considerations

### Skills Source Location in Dev Workspace

Skills are authored in the bGSD dev workspace (`/mnt/raid/DEV/bgsd-oc/`) alongside agents and references:

```
bgsd-oc/
├── skills/                    # NEW — skill source files
│   ├── gsd-goal-backward/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── gsd-checkpoints/
│   │   ├── SKILL.md
│   │   └── references/
│   └── ...
├── commands/                  # existing
├── workflows/                 # existing
├── references/                # existing (some migrate out)
└── deploy.sh                  # updated to copy skills/
```

### deploy.sh Updates

```bash
# Add to deploy.sh after existing copies:
SKILLS_SRC="$SCRIPT_DIR/skills"
SKILLS_DST="$HOME/.config/oc/skills"

if [ -d "$SKILLS_SRC" ]; then
  cp -r "$SKILLS_SRC"/* "$SKILLS_DST/"
  echo "Deployed $(ls -d "$SKILLS_SRC"/*/ | wc -l) skills"
fi
```

---

## Risk Assessment

### Risk 1: Skill Loading Failure
**Impact:** Agent doesn't get methodology, produces lower-quality output
**Mitigation:** Agent stubs include 3-5 line "quick reference" so agent isn't completely blind. Skill loading failure = degraded mode, not broken mode.
**Probability:** LOW — plugin is stable, skills are static files

### Risk 2: Context Compaction Removes Skill Content
**Impact:** Long sessions lose skill knowledge
**Mitigation:** Skills use `noReply: true` message insertion which PERSISTS through compaction (this is an explicit design goal of the message insertion pattern). Verified in plugin source.
**Probability:** LOW

### Risk 3: Agent Doesn't Load Skill When Needed
**Impact:** Agent skips skill because it doesn't recognize the need
**Mitigation:** Stubs explicitly state WHEN to load. Example: "When encountering checkpoint task, load gsd-checkpoints skill." Descriptions are specific enough for agent to match.
**Probability:** MEDIUM — requires testing. Agent may not always recognize need.

### Risk 4: Multiple Skills Loaded = Context Bloat
**Impact:** Agent loads too many skills, using more context than inline approach
**Mitigation:** Skills are ~100-150 lines (condensed), not full inline size. Even loading 3 skills = 300-450 lines < current inline total. Also, loaded ON-DEMAND (not all at once).
**Probability:** LOW

### Risk 5: Deploy Pipeline Complexity
**Impact:** Skills need separate deployment path from CLI
**Mitigation:** Skills are in `~/.config/oc/skills/` (global config). Already managed by deploy.sh pattern. Add skills directory to deploy targets.
**Probability:** LOW

---

## Build Order Summary

| Order | Component | Dependencies | Risk | Est. Effort |
|-------|-----------|-------------|------|------------|
| 1 | Create `gsd-goal-backward` skill | None | LOW | Small |
| 2 | Create `gsd-checkpoints` skill | None | LOW | Small |
| 3 | Create `gsd-verification` skill | None | LOW | Small |
| 4 | Create `gsd-tdd` skill | None | LOW | Small |
| 5 | Create `gsd-git-conventions` skill | None | LOW | Small |
| 6 | Create `gsd-deviation-rules` skill | None | LOW | Small |
| 7 | Slim gsd-planner (3 skill refs) | Skills 1, 2, 4 | MEDIUM | Medium |
| 8 | Slim gsd-executor (3 skill refs) | Skills 2, 5, 6 | MEDIUM | Medium |
| 9 | Slim gsd-verifier (2 skill refs) | Skills 1, 3 | MEDIUM | Small |
| 10 | Slim gsd-plan-checker (1 skill ref) | Skill 1 | LOW | Small |
| 11 | Slim remaining agents (4 agents) | Various | LOW | Small |
| 12 | Clean up migrated references | Steps 7-11 | LOW | Small |
| 13 | Update affected workflows | Step 12 | LOW | Small |
| 14 | Update deploy.sh for skills | None | LOW | Small |

**Steps 1-6 are parallelizable** (no dependencies between skills).
**Steps 7-11 are parallelizable** (no dependencies between agents, only on skills).
**Steps 12-14 are sequential** (cleanup after migration stable).

---

## Anti-Patterns to Avoid

### 1. Don't Move Agent Identity to Skills
**Wrong:** Making a "gsd-planner-role" skill that contains the planner's `<role>` section
**Right:** Role stays in agent, shared METHODOLOGY becomes a skill

### 2. Don't Create Skills for Tiny References
**Wrong:** Making a skill for `model-profile-resolution.md` (34 lines)
**Right:** Keep tiny references as references. Skill overhead (discovery, tool call, injection) exceeds value.

### 3. Don't Force All Agents to Use Skills
**Wrong:** "Every agent MUST load at least one skill"
**Right:** `gsd-debugger` is self-contained at 1,216 lines — it has no shared methodology to extract

### 4. Don't Remove Quick Reference from Agent Stubs
**Wrong:** Agent stub says only "load gsd-goal-backward skill"
**Right:** Agent stub includes 2-3 line summary so agent can make do if skill loading fails

### 5. Don't Create One Mega-Skill
**Wrong:** "gsd-shared-knowledge" skill with all references merged
**Right:** One skill per knowledge domain. Agent loads only what it needs.

---

## Open Questions

1. **Skill naming convention:** Should skills use `gsd-` prefix to namespace them, or is that unnecessary since they're in global config? Recommendation: YES prefix — prevents collision with project-local skills.

2. **Skills tool declaration in agent frontmatter:** Agents currently don't declare skill tools in their YAML frontmatter. The `opencode-agent-skills` plugin makes `mcp_skill`, `mcp_use_skill`, `mcp_get_available_skills`, and `mcp_read_skill_file` tools available globally. No agent frontmatter changes needed.

3. **Testing skills:** How to validate skill content quality? Run a test workflow with skill-stub agent and compare output to inline-agent output. Requires manual comparison initially.

4. **Skill versioning:** Skills are static files with no version tracking. Consider adding `version` to SKILL.md metadata for future change tracking.

---

## Sources

- OpenCode skills architecture: Context7 `/anomalyco/opencode` (HIGH confidence)
- opencode-agent-skills plugin: Context7 `/malhashemi/opencode-skills` (HIGH confidence)
- Current agent system: Live files at `~/.config/oc/agents/*.md` (HIGH confidence)
- Current reference system: Live files at `~/.config/oc/get-shit-done/references/*.md` (HIGH confidence)
- RACI matrix: `~/.config/oc/get-shit-done/references/RACI.md` (HIGH confidence)
- Plugin source: `~/.config/oc/plugins/bgsd.js` (HIGH confidence)
- opencode.json configuration: `~/.config/oc/opencode.json` (HIGH confidence)
