# Architecture: v8.3 Agent Quality & Skills

**Domain:** OpenCode skills integration into bGSD agent architecture
**Researched:** 2026-03-08
**Overall confidence:** HIGH

## Current Architecture (Before v8.3)

### Agent Content Flow
```
Host editor config (~/.config/oc/)
├── agents/                    ← 10 agent .md files (deployed by deploy.sh)
│   ├── gsd-executor.md       ← Contains inline <project_context>, PATH SETUP, full logic
│   ├── gsd-planner.md        ← Same duplicated blocks + planning-specific logic
│   └── ... (8 more)
├── commands/                  ← 41 slash command wrappers
│   └── bgsd-*.md             ← Thin wrappers that invoke workflows/agents
└── get-shit-done/
    ├── bin/gsd-tools.cjs      ← CLI tool (single file)
    ├── workflows/*.md         ← 45 orchestration workflows
    ├── references/*.md        ← 12 shared reference docs
    └── templates/*.md         ← Document templates
```

### Content Loading (Current)
1. Agent .md file loaded as system prompt (full cost at startup)
2. Agent manually calls `Read` tool to load references/ files
3. Duplicated blocks (`<project_context>`, PATH SETUP) in every agent = wasted tokens
4. References loaded eagerly when agent decides it needs them (no lazy loading)

### Problems This Architecture Creates
- **Token waste:** 9 agents × ~200 tokens of duplicated `<project_context>` = ~1800 tokens
- **Maintenance burden:** Changing shared patterns requires updating 9+ files
- **No lazy loading:** References loaded in full even when agent only needs one section
- **Inconsistency:** Shared blocks diverge across agents over time

## Recommended Architecture (After v8.3)

### Skills-Enhanced Agent Flow
```
Host editor config (~/.config/oc/)
├── agents/                    ← 10 agent .md files (leaner, no duplicated blocks)
│   ├── gsd-executor.md       ← Core execution logic only, loads skills on demand
│   ├── gsd-planner.md        ← Core planning logic only, loads skills on demand
│   └── ... (8 more)
├── commands/                  ← 41 slash command wrappers (unchanged)
│   └── bgsd-*.md
├── skills/                    ← NEW: OpenCode-native skills
│   ├── gsd-raci/
│   │   └── SKILL.md          ← RACI matrix and handoff contracts
│   ├── gsd-verification/
│   │   └── SKILL.md          ← Verification patterns
│   ├── gsd-tdd/
│   │   └── SKILL.md          ← TDD execution patterns
│   ├── gsd-git-conventions/
│   │   └── SKILL.md          ← Git integration reference
│   ├── gsd-ui-brand/
│   │   └── SKILL.md          ← Formatting and branding patterns
│   └── gsd-model-profiles/
│       └── SKILL.md          ← Model selection guidance
└── get-shit-done/
    ├── bin/gsd-tools.cjs      ← CLI tool (unchanged)
    ├── workflows/*.md         ← 45 workflows (unchanged)
    ├── references/*.md        ← Retained for backward compat, skills reference these
    └── templates/*.md         ← Document templates (unchanged)
```

### Content Loading (New)
1. Agent .md file loaded as system prompt (leaner — no duplicated blocks)
2. OpenCode injects skill index into `skill` tool description (~50 tokens per skill)
3. Agent calls `skill({ name: "gsd-raci" })` when it needs RACI reference
4. Skill content loads on demand — full content only when needed
5. Skills can reference supporting files in their directory

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Agent .md files | Agent identity, role, execution flow, structured returns | Skills (on-demand), gsd-tools (CLI calls), workflows (spawned by) |
| Skills | Shared domain knowledge, reference documentation, patterns | Agents (loaded by), references/ (can include) |
| Workflows | Orchestration, agent spawning, user interaction | Commands (invoked by), agents (spawns), gsd-tools (data gathering) |
| Commands | User-facing entry points, argument parsing | Workflows (invokes), agents (may specify) |
| gsd-tools.cjs | Data operations, state management, git integration | Agents (called via bash), workflows (called via bash) |
| references/ | Source content for skills, backward compatibility | Skills (referenced by), agents (fallback Read) |

### Data Flow for Skill Loading

```
1. OpenCode starts → discovers skills/*/ → builds skill index
2. Agent receives system prompt + skill tool with <available_skills> in description
3. Agent encounters task needing RACI knowledge
4. Agent calls: skill({ name: "gsd-raci" })
5. OpenCode returns: SKILL.md content + base directory path
6. Agent follows RACI instructions, may Read supporting files from base dir
7. Skill content persists in conversation context for remainder of session
```

## Patterns to Follow

### Pattern 1: Skill as Reference Wrapper
**What:** Wrap existing reference .md content in a SKILL.md with good frontmatter
**When:** Reference doc is used by multiple agents, doesn't need to load at startup

```markdown
---
name: gsd-raci
description: RACI responsibility matrix mapping each GSD lifecycle step to its responsible agent, with handoff contracts between agents
---

# RACI Matrix & Handoff Contracts

Load the full RACI matrix from the reference document:

Read `references/RACI.md` from the GSD_HOME directory for the complete matrix.

## Quick Reference

| Step | Responsible | Accountable |
|------|------------|-------------|
| plan-creation | gsd-planner | /bgsd-plan-phase |
| task-execution | gsd-executor | /bgsd-execute-phase |
| phase-verification | gsd-verifier | /bgsd-verify-work |

## When to Use

Use this skill when you need to:
- Determine which agent is responsible for a lifecycle step
- Understand handoff contracts between agents
- Validate that your work stays within your R/A boundaries
```

### Pattern 2: Skill with Inline Content
**What:** Skill contains all content inline (no external file references)
**When:** Content is short (<500 lines) and self-contained

```markdown
---
name: gsd-verification
description: Verification patterns for checking completed work against phase requirements, including test gating and regression detection
---

# Verification Patterns

## Test Gating
[inline content from verification-patterns.md]

## Regression Detection
[inline content]
```

### Pattern 3: Agent References Skill Instead of Duplicating
**What:** Agent definition mentions skill availability instead of embedding content
**When:** Content was previously duplicated in `<project_context>` or similar blocks

```markdown
<!-- BEFORE: in every agent definition -->
<project_context>
Before executing, discover project context:
**Project instructions:** Read `./AGENTS.md` if it exists...
**Project skills:** Check `.agents/skills/` directory if it exists...
</project_context>

<!-- AFTER: simplified, skill handles the details -->
<project_context>
Before executing, discover project context:
**Project instructions:** Read `./AGENTS.md` if it exists in the working directory.
**Project skills:** Use the `skill` tool if project-specific skills are available.
</project_context>
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Over-Migration
**What:** Moving agent core logic (execution flow, structured returns) into skills
**Why bad:** Agent identity and role must be in the agent definition — skills are supplementary knowledge, not the agent itself
**Instead:** Only migrate shared/reference content that multiple agents use

### Anti-Pattern 2: Skills as Eager-Load Replacements
**What:** Agent immediately calls `skill()` for every skill at startup
**Why bad:** Defeats the purpose of lazy loading — same token cost as inline
**Instead:** Trust the agent to load skills when it encounters relevant tasks

### Anti-Pattern 3: Vague Skill Descriptions
**What:** `description: "GSD reference document"` — too generic for agent decision-making
**Why bad:** Agent can't determine when to load, may load unnecessarily or miss loading
**Instead:** Specific, task-oriented descriptions: `"RACI responsibility matrix mapping each GSD lifecycle step to its responsible agent"`

### Anti-Pattern 4: Giant Skills
**What:** Cramming multiple reference docs into one skill (>1000 lines)
**Why bad:** Full content loads when any part is needed — no partial loading
**Instead:** One skill per logical domain — RACI, verification, TDD, git, etc.

## Deploy Pipeline Changes

### Current manifest.json Structure
```json
{
  "files": [
    "bin/gsd-tools.cjs",
    "agents/gsd-executor.md",
    "commands/bgsd-execute-phase.md",
    "workflows/execute-phase.md",
    "references/RACI.md",
    "templates/PLAN.md"
  ]
}
```

### Updated manifest.json Structure
```json
{
  "files": [
    "bin/gsd-tools.cjs",
    "agents/gsd-executor.md",
    "commands/bgsd-execute-phase.md",
    "workflows/execute-phase.md",
    "references/RACI.md",
    "templates/PLAN.md",
    "skills/gsd-raci/SKILL.md",
    "skills/gsd-verification/SKILL.md"
  ]
}
```

### deploy.sh Changes
```bash
# New: Skills directory deployment
SKILL_DIR="$HOME/.config/opencode/skills"
# ... in dest_for_file():
skills/gsd-*.md) echo "$SKILL_DIR/$(dirname "$file" | sed 's|^skills/||')/$(basename "$file")" ;;
```

Note: The `dest_for_file()` function needs to handle the nested directory structure — skills deploy as `skills/<name>/SKILL.md`, not flat files.

## Sources

- OpenCode official docs (skills, agents, rules, commands, tools, custom-tools)
- bGSD agent .md files, deploy.sh, plugin.js, manifest system
- Context7 /anomalyco/opencode, /malhashemi/opencode-skills
- Live system inspection of ~/.config/oc/ directory layout

---
*Last updated: 2026-03-08*
