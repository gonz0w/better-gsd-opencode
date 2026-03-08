# Feature Landscape: Agent Quality Standards & Skills Architecture

**Domain:** AI agent definitions, shared metadata, skills-based architecture
**Researched:** 2026-03-08
**Confidence:** HIGH (based on primary source analysis of 10 agents + Agent Skills specification + OpenCode docs)

## Category 1: Agent Quality Standards (Table Stakes)

Features every well-structured agent definition needs. Missing = inconsistent behavior, context waste, debugging difficulty.

### Current State Across 10 Agents

| Quality Dimension | gsd-executor | gsd-planner | gsd-verifier | gsd-debugger | gsd-roadmapper | gsd-phase-researcher | gsd-project-researcher | gsd-plan-checker | gsd-codebase-mapper | gsd-github-ci |
|---|---|---|---|---|---|---|---|---|---|---|
| **YAML frontmatter** | description, mode, color, estimated_tokens, tools | Same pattern | Same | Same | Same | Same | Same | Same | Same | Same |
| **PATH SETUP block** | Present | Present | Present | Present | Present | Present | Present | Present | **MISSING** | Present |
| **`<role>` section** | Present | Present | Present | Present | Present | Present | Present | Present | Present (no tags) | Present |
| **Mandatory Initial Read** | Present | Present | Present | Present | Present | Present | Present | Present | Present | Present |
| **`<project_context>`** | Present (skills-aware) | Present (skills-aware) | **MISSING** | **MISSING** | **MISSING** | Present (skills-aware) | **MISSING** | Present (skills-aware) | **MISSING** | **MISSING** |
| **`<execution_flow>` with steps** | Present (structured) | Present (structured) | Present (unstructured) | Present (structured) | Present (structured) | Present (structured) | Present (mixed) | Present (structured) | Present (structured) | Present (structured) |
| **`<structured_returns>`** | Present (PLAN COMPLETE) | Present (PLANNING COMPLETE) | Present (Verification Complete) | Present (ROOT CAUSE / DEBUG COMPLETE) | Present (ROADMAP CREATED) | Present (RESEARCH COMPLETE) | Present (RESEARCH COMPLETE) | Present (VERIFICATION PASSED/ISSUES FOUND) | **MISSING** (returns confirmation only) | **MISSING** |
| **`<success_criteria>` checklist** | Present (12 items) | Present (15 items) | Present (14 items) | Present (9 items) | Present (16 items) | Present (11 items) | Present (8 items) | Present (13 items) | Present (6 items) | Present (5 items) |
| **Checkpoint handling** | Full protocol + auto-mode | Detailed (planner perspective) | N/A (no checkpoints) | Present (3 types) | N/A | N/A | N/A | N/A | N/A | Partial (ad-hoc) |
| **State update protocol** | Full (advance-plan, record-metric) | Commit protocol | No commit (orchestrator handles) | Full (archive, commit) | Write files + return | Write + commit | Write + no commit | Returns issues to orchestrator | No commit | No state updates |
| **Estimated line count** | 483 | 1197 | 571 | 1216 | 655 | 518 | 637 | 655 | 770 | 409 |

### Table Stakes Features

| Feature | Why Expected | Complexity | Status |
|---------|--------------|------------|--------|
| **Consistent frontmatter schema** | Every agent needs description, mode, color, estimated_tokens, tools | Low | 9/10 consistent (codebase-mapper lacks PATH SETUP) |
| **PATH SETUP block** | Agents must resolve GSD_HOME before CLI commands | Low | 9/10 have it |
| **Mandatory Initial Read protocol** | files_to_read must be read first for context | Low | 10/10 have it |
| **`<project_context>` discovery** | Agents should check AGENTS.md and project skills | Low | 4/10 have it (executor, planner, phase-researcher, plan-checker) |
| **`<structured_returns>` to orchestrator** | Orchestrators parse structured output for decisions | Med | 8/10 have it (codebase-mapper and github-ci lack it) |
| **`<success_criteria>` checklist** | Defines what "done" means, prevents partial execution | Low | 10/10 have it, but quality varies (5-16 items) |
| **Checkpoint protocol (where applicable)** | Consistent human-in-the-loop handling | Med | Inconsistent: executor has full protocol, github-ci has ad-hoc, debugger has own variant |
| **Deviation rules (where applicable)** | Auto-fix vs ask boundaries | Med | Only executor has this; github-ci needs it |
| **Authentication gate handling** | Push/API auth failures are gates, not errors | Low | Executor + github-ci have it, but github-ci's is ad-hoc |
| **State update protocol** | Track progress, decisions, metrics | Med | Only executor has full protocol; others vary |
| **GitHub CI agent overhaul** | Currently substandard vs other 8 agents | Med | Model from gsd-executor patterns |
| **31 test failures fixed** | Test suite credibility — cannot ship with known failures | Med | 4 areas: config-migrate, compact, codebase-impact, codebase ast |

### Quality Gaps Identified

**Critical gaps (gsd-github-ci):**
1. No `<structured_returns>` section — completion format exists but lacks CHECKPOINT REACHED or error structured returns
2. No `<project_context>` discovery — doesn't check project skills
3. No deviation rules — when a check fails, no framework for auto-fix vs escalate
4. No state updates — doesn't record metrics, decisions, or session info
5. Checkpoint handling is ad-hoc — inline in step descriptions rather than a consistent protocol section
6. Success criteria has only 5 items vs 9-16 for other agents
7. No `<philosophy>` section explaining operational principles

**Moderate gaps (multiple agents):**
1. `<project_context>` missing from verifier, debugger, roadmapper, project-researcher, codebase-mapper, github-ci (6/10)
2. Checkpoint protocol varies — executor uses `<checkpoint_protocol>` + `<checkpoint_return_format>`, debugger uses `<checkpoint_behavior>`, github-ci inlines it
3. No shared definition of what "structured return" means — each agent invents its own format

## Category 2: Shared Patterns (Skill Candidates)

Sections duplicated across multiple agents that could become shared skills or references, reducing per-agent context cost.

### Duplication Analysis

| Shared Pattern | Agents Using It | Lines Per Agent | Total Lines | Potential Savings |
|---|---|---|---|---|
| **PATH SETUP block** | 9/10 agents | 4 lines | ~36 lines | Eliminate entirely via skill |
| **Mandatory Initial Read** | 10/10 agents | 3 lines | ~30 lines | Standardize in skill |
| **`<project_context>` block** | 4/10 agents (varies slightly) | 10-14 lines | ~48 lines | Standardize for all 10 agents |
| **Checkpoint protocol** | 3 agents (executor, planner, debugger) | 40-90 lines each | ~180 lines | Shared reference; agents load when needed |
| **Deviation rules** | 1 agent (executor) | 62 lines | 62 lines | Skill for all executing agents |
| **Authentication gate handling** | 2 agents (executor, github-ci) | 14-20 lines each | ~34 lines | Part of checkpoint skill |
| **Commit protocol** | 2 agents (executor, debugger) | 30-35 lines each | ~65 lines | Shared reference |
| **State update commands** | 1 agent (executor) | 45 lines | 45 lines | Skill loaded by any state-updating agent |
| **Research tool strategy** | 2 agents (phase-researcher, project-researcher) | 40-50 lines each | ~90 lines | Shared skill |
| **Source hierarchy / confidence levels** | 2 agents (phase-researcher, project-researcher) | 20-30 lines each | ~50 lines | Part of research skill |
| **Goal-backward methodology** | 3 agents (planner, verifier, plan-checker) | 50-100 lines each | ~250 lines | Shared reference |

**Total duplicated content:** ~890 lines across 7,111 total lines (12.5%)

### Concrete Skill Candidates

#### Skill 1: `gsd-common` (loaded by ALL agents)
**What moves here:**
- PATH SETUP block (4 lines)
- Mandatory Initial Read protocol (3 lines)
- Project context discovery (AGENTS.md + project skills) (12 lines)

**Impact:** ~19 lines removed from each of 10 agents = ~190 lines eliminated from system prompts. Every agent gets consistent project awareness.
**Complexity:** Low
**Risk:** Low — pure deduplication

#### Skill 2: `gsd-checkpoints` (loaded by executor, planner, debugger, github-ci)
**What moves here:**
- Checkpoint types (human-verify, decision, human-action)
- Checkpoint return format template
- Auto-mode detection and handling
- Authentication gate protocol

**Impact:** ~120 lines removed from system prompts of agents that use checkpoints. Currently 180+ lines of overlapping checkpoint content.
**Complexity:** Medium — checkpoint handling varies slightly per agent
**Risk:** Medium — agents currently customize checkpoint behavior

#### Skill 3: `gsd-execution` (loaded by executor, github-ci)
**What moves here:**
- Deviation rules (auto-fix framework)
- Commit protocol (type selection, staging, format)
- State update commands

**Impact:** ~140 lines available as on-demand reference. GitHub CI agent gains deviation framework it currently lacks.
**Complexity:** Medium
**Risk:** Low — executor already references external checkpoints.md

#### Skill 4: `gsd-research` (loaded by phase-researcher, project-researcher)
**What moves here:**
- Tool priority (Context7 -> Official Docs -> WebSearch)
- Source hierarchy and confidence levels
- Verification protocol for web findings
- Research pitfalls

**Impact:** ~100 lines deduplicated. Both researchers get identical methodology.
**Complexity:** Low
**Risk:** Low — pure methodology deduplication

#### Skill 5: `gsd-goal-backward` (loaded by planner, verifier, plan-checker)
**What moves here:**
- Goal-backward methodology (truths -> artifacts -> wiring -> key links)
- Must-haves format
- Common failures in goal-backward analysis

**Impact:** ~150 lines deduplicated. Consistent methodology across plan creation, plan checking, and verification.
**Complexity:** Low
**Risk:** Low — already used identically by all three agents

### Pattern: What DOESN'T Move to Skills

Agent-specific behavior must stay in the agent definition:
- Role description and core responsibilities
- Execution flow (step-by-step process specific to this agent)
- Structured return formats (agent-specific output shapes)
- Success criteria (agent-specific completion definition)
- Domain philosophy (e.g., debugger's scientific method, planner's "plans are prompts")

**Principle:** Skills hold shared operational knowledge. Agent definitions hold identity and specialized behavior.

## Category 3: Skills Architecture Features

Features of the OpenCode skills system and Agent Skills specification relevant to the bGSD migration.

### How Skills Work (Three-Level Progressive Disclosure)

| Level | When Loaded | Token Cost | Content |
|-------|------------|------------|---------|
| **Level 1: Metadata** | At startup, always | ~100 tokens per skill | `name` + `description` from YAML frontmatter |
| **Level 2: Instructions** | When skill activated | <5000 tokens recommended | Full SKILL.md body |
| **Level 3: References** | On demand during execution | Varies | Files in `scripts/`, `references/`, `assets/` |

**Key insight:** Level 1 costs ~100 tokens per skill. With 5 GSD skills, that's ~500 tokens always-on overhead. The instructions (Level 2) only load when the agent decides the skill is relevant. This is the context reduction mechanism.

### OpenCode Skills Implementation

From Context7 analysis of `/malhashemi/opencode-skills`:

**Discovery locations (checked in order):**
1. `$XDG_CONFIG_HOME/<app>/skills/` — Global config skills
2. `~/.opencode/skills/` — User global skills
3. `<project>/.opencode/skills/` — Project-local skills

**For bGSD:** Skills would live in `~/.config/oc/skills/gsd-*/SKILL.md` (global) or optionally in project `.opencode/skills/` for project-specific overrides.

**Registration mechanism:** Each skill is registered as a dynamic tool. When called, it:
1. Sends a "loading" message via `noReply: true` prompt
2. Injects skill content + base directory path into conversation
3. Agent can then reference files relative to skill base dir

**Permission model:**
```json
{
  "permission": {
    "skill": {
      "*": "allow",
      "gsd-*": "allow"
    }
  }
}
```

### Agent Skills Specification (agentskills.io)

The Agent Skills Standard (open spec by Anthropic, adopted by 30+ tools) defines:

| Feature | Spec Requirement | bGSD Implication |
|---------|-----------------|------------------|
| `SKILL.md` required | Every skill must have one | Each gsd-* skill needs a SKILL.md |
| `name` field | lowercase alphanumeric + hyphens, max 64 chars | `gsd-common`, `gsd-checkpoints`, etc. |
| `description` field | Max 1024 chars, must say what + when | Critical for triggering — description determines if agent loads skill |
| Progressive disclosure | 3 levels: metadata -> instructions -> references | References dir for detailed docs (checkpoints.md, etc.) |
| `allowed-tools` | Optional, experimental | Could restrict which tools a skill can invoke |
| Directory structure | `SKILL.md` + optional `scripts/`, `references/`, `assets/` | References for existing .md files that agents currently @-reference |

### Table Stakes vs Differentiators for Skills Migration

| Feature | Category | Why |
|---------|----------|-----|
| SKILL.md with frontmatter for each shared pattern | Table Stakes | Without this, skills aren't discoverable |
| Progressive disclosure (metadata -> body -> references) | Table Stakes | Core value proposition — context reduction |
| Description quality (triggers correctly) | Table Stakes | Bad descriptions = skills never load or always load |
| Relative file references from skill base dir | Table Stakes | Skills reference detailed docs without hardcoded paths |
| `references/` directory for detailed docs | Table Stakes | Move existing @-referenced .md files here |
| Skills in deploy.sh pipeline | Table Stakes | Skills must deploy alongside agents and commands |
| Permission configuration in opencode.json | Differentiator | Fine-grained control, but all gsd-* skills should be allowed |
| Cross-platform portability (agentskills.io spec) | Differentiator | Nice-to-have but not required for internal use |
| Project-local skill overrides | Differentiator | Could customize GSD behavior per-project |
| Skill versioning via metadata | Differentiator | Future-proofing for skill updates |

## Category 4: Context Reduction Analysis

Concrete token savings from skills migration.

### Current Agent Context Costs

| Agent | Lines | Est. Tokens (~4 tokens/line avg) | Shared Content (lines) | Unique Content (lines) |
|-------|-------|----------------------------------|----------------------|----------------------|
| gsd-executor | 483 | ~8K | ~135 | ~348 |
| gsd-planner | 1197 | ~20K | ~200 | ~997 |
| gsd-verifier | 571 | ~10K | ~65 | ~506 |
| gsd-debugger | 1216 | ~20K | ~75 | ~1141 |
| gsd-roadmapper | 655 | ~11K | ~35 | ~620 |
| gsd-phase-researcher | 518 | ~9K | ~120 | ~398 |
| gsd-project-researcher | 637 | ~11K | ~110 | ~527 |
| gsd-plan-checker | 655 | ~11K | ~100 | ~555 |
| gsd-codebase-mapper | 770 | ~13K | ~25 | ~745 |
| gsd-github-ci | 409 | ~4K | ~25 | ~384 |

### Projected Savings

**With skills (5 skills, ~100 tokens metadata each = 500 tokens always-on):**

When an agent loads, it pays:
- ~500 tokens for skill metadata (Level 1, all skills)
- Agent system prompt (reduced by shared content removal)
- Skills loaded on-demand (Level 2, only relevant ones)

**Net impact per agent spawn:**

| Agent | Current | After Dedup | Skills Loaded On-Demand | Net Change |
|-------|---------|-------------|-------------------------|------------|
| gsd-executor | ~8K | ~5.5K | common + checkpoints + execution (~2K) | ~7.5K (-6%) |
| gsd-planner | ~20K | ~17K | common + goal-backward + checkpoints (~1.5K) | ~18.5K (-7.5%) |
| gsd-github-ci | ~4K | ~3.5K | common + checkpoints + execution (~2K) | ~5.5K (+37% quality gain) |
| gsd-verifier | ~10K | ~9.5K | common + goal-backward (~1K) | ~10.5K (~same) |
| gsd-debugger | ~20K | ~19.5K | common + checkpoints (~1K) | ~20.5K (~same) |

**Key insight:** The primary value of skills is NOT token reduction (savings are modest 5-10%). The primary value is:
1. **Consistency** — all agents get identical shared methodology
2. **Quality uplift** — agents missing patterns (github-ci) gain them automatically
3. **Maintainability** — change checkpoint protocol once, all agents get it
4. **Progressive disclosure** — detailed references loaded only when needed, not baked into system prompt

## Category 5: GitHub CI Agent Quality Gap Analysis

Detailed comparison of gsd-github-ci vs the quality standard set by gsd-executor.

### What gsd-executor Has That gsd-github-ci Lacks

| Feature | gsd-executor | gsd-github-ci | Impact of Gap |
|---------|-------------|---------------|---------------|
| `<project_context>` | Reads AGENTS.md, checks project skills | Only reads AGENTS.md (line 54), no skills | CI fixes may violate project conventions |
| `<deviation_rules>` | 4 rules with clear auto-fix vs escalate boundaries | None — all fix decisions are ad-hoc | No framework for "should I fix this or escalate?" |
| `<authentication_gates>` | Full protocol with indicator list + checkpoint format | Partial — only git push auth, not API auth | API auth failures (gh auth) not properly handled |
| `<checkpoint_protocol>` | Structured section with auto-mode handling | Inline in step descriptions | Inconsistent checkpoint behavior |
| `<checkpoint_return_format>` | Standard template with progress table | Ad-hoc markdown in each step | Continuation agents can't parse reliably |
| `<auto_mode_detection>` | Checks `workflow.auto_advance` config | None | Can't auto-advance past human-verify checkpoints |
| `<continuation_handling>` | Explicit protocol for resumed agents | None | If context resets mid-CI, can't resume |
| `<self_check>` | Verifies claims before proceeding | None | May report success when merge actually failed |
| `<state_updates>` | Full state management (advance-plan, metrics, decisions) | None | CI results not tracked in project state |
| `<summary_creation>` | Creates SUMMARY.md with deviations, metrics | None | No execution record persisted |
| `<philosophy>` | Operational principles section | None | No guiding principles for edge cases |
| **Structured returns** | `## PLAN COMPLETE` with commits, duration | `## CI COMPLETE` exists but no BLOCKED/CHECKPOINT returns | Orchestrator can't handle CI failures gracefully |
| **Success criteria depth** | 12 items covering all lifecycle phases | 5 items covering only happy path | Edge cases (timeout, partial merge, auth failure) not covered |

### What gsd-github-ci Does Well

1. **Clear step structure** — parse_input -> push -> PR -> checks -> analyze -> fix -> merge is logical
2. **Alert classification matrix** — severity + context -> true/false positive is well-designed
3. **Iteration limit** — MAX_FIX_ITERATIONS prevents infinite loops
4. **False positive dismissal** — structured API calls with reasoning
5. **Merge fallback** — tries --auto first, then direct merge

### Recommended Quality Standard Template

Based on analysis of all 10 agents, the quality standard every agent should meet:

```
YAML frontmatter:
  - description (descriptive, action-oriented)
  - mode: subagent
  - color (unique per agent)
  - estimated_tokens (commented, realistic)
  - tools (minimal required set)

Structural sections (in order):
  1. PATH SETUP block (or loaded via gsd-common skill)
  2. <role> with core responsibilities + Mandatory Initial Read
  3. <project_context> (or loaded via gsd-common skill)
  4. <philosophy> (if agent has domain-specific principles)
  5. <execution_flow> with named <step> elements
  6. <structured_returns> with all return types (success, blocked, error)
  7. <success_criteria> checklist (8+ items covering edge cases)

Optional sections (by agent type):
  - <checkpoint_protocol> (agents that interact with users)
  - <deviation_rules> (agents that execute/modify code)
  - <authentication_gates> (agents that call external APIs)
  - <state_updates> (agents that modify .planning/ state)
```

## Feature Dependencies

```
Agent Quality Audit ──────────────────────────────────────────┐
  │                                                            │
  ├── Define quality standard template                         │
  │     └── Requires: analysis of all 10 agents (DONE)         │
  │                                                            │
  ├── GitHub CI agent overhaul                                 │
  │     └── Requires: quality standard template                │
  │     └── Requires: deviation rules framework                │
  │     └── Requires: checkpoint protocol                      │
  │                                                            │
  ├── Consistency audit (all 9 agents)                         │
  │     └── Requires: quality standard template                │
  │                                                            │
  └── Skills migration ──────────────────────────────────────┐ │
        │                                                    │ │
        ├── Create gsd-common skill                          │ │
        │     └── Requires: PATH SETUP, initial read,        │ │
        │         project_context standardized                │ │
        │                                                    │ │
        ├── Create gsd-checkpoints skill                     │ │
        │     └── Requires: checkpoint protocol unified      │ │
        │                                                    │ │
        ├── Create gsd-execution skill                       │ │
        │     └── Requires: deviation rules, commit protocol │ │
        │                                                    │ │
        ├── Create gsd-research skill                        │ │
        │     └── Requires: tool strategy unified            │ │
        │                                                    │ │
        └── Create gsd-goal-backward skill                   │ │
              └── Requires: methodology unified              │ │
                                                             │ │
        Update all 10 agent definitions ─────────────────────┘ │
              └── Requires: all skills created                 │
              └── Requires: consistency audit complete ─────────┘

Test debt (independent):
  31 test failures → Fix config-migrate, compact, codebase-impact, codebase ast
```

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Dynamic skill loading based on task classification | Over-engineering — all GSD skills are always relevant | Static skill list per agent; OpenCode handles discovery |
| Custom skill loader in gsd-tools.cjs | OpenCode's native skill tool handles this | Use the built-in `skill` tool |
| Skill versioning system | Skills change with bGSD versions; no independent lifecycle | Use git versioning of the bGSD repo |
| Cross-platform skill portability | bGSD is OpenCode-specific; agentskills.io portability unnecessary | Follow spec for compatibility, but don't optimize for it |
| Skill permission granularity per agent | All GSD agents should access all GSD skills | Use `"gsd-*": "allow"` globally |
| Automated skill generation | Skills are curated shared methodology, not generated artifacts | Author skills manually based on duplication analysis |
| Per-project skill overrides for GSD methodology | Project skills are for project conventions, not GSD behavior | Keep GSD skills global; project skills separate |
| Moving PATH SETUP to skills | Needed before any tool calls, must be in system prompt | Keep inline in agent definitions |
| Moving agent core logic to skills | Agent identity, role, execution flow must stay in agent .md | Only move shared/reference content |
| New agent roles | Agent cap at 9 is a design decision | Improve existing agents, don't add new ones |

## MVP Recommendation

### Phase 1: Agent Quality (must do first)
1. Define quality standard template from analysis above
2. Overhaul gsd-github-ci to standard (biggest gap)
3. Light audit of remaining 8 agents for critical gaps (`<project_context>`, `<structured_returns>`)

### Phase 2: Skills Architecture (after quality)
1. Create `gsd-common` skill (universal, lowest risk)
2. Create `gsd-checkpoints` skill (benefits 4 agents)
3. Create `gsd-goal-backward` skill (benefits 3 agents)
4. Update agent definitions to reference skills instead of inline content
5. Update deploy.sh to include skills directory
6. Validate: deploy, test each agent, confirm behavior unchanged

### Phase 3: Test Debt (independent)
- Fix 31 pre-existing test failures across 4 areas

### Deferred
- `gsd-execution` skill (benefits 2 agents — lower priority)
- `gsd-research` skill (benefits 2 agents — lower priority)
- Token budget recalculation (measure after skills deployed)
- Project-local skill overrides

## Sources

### Primary (HIGH confidence)
- Context7: `/anomalyco/opencode` — agents, skills, permissions documentation
- Context7: `/malhashemi/opencode-skills` — OpenCode Skills plugin implementation
- agentskills.io/specification — Agent Skills open standard specification
- Direct analysis of 10 agent .md files in `/home/cam/.config/oc/agents/`

### Secondary (MEDIUM confidence)
- anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills — Anthropic engineering blog
- benjamin-abt.com/blog/2026/02/12/agent-skills-standard-github-copilot — Agent Skills quality analysis
- andriifurmanets.com/blogs/ai-agents-2026-practical-architecture-tools-memory-evals-guardrails — Production agent architecture patterns

### Tertiary (LOW confidence)
- Various Medium/blog posts on Agent Skills specification (confirmed against primary sources)

---
*Last updated: 2026-03-08*
