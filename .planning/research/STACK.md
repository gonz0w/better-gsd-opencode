# Technology Stack: v8.3 Agent Quality & OpenCode Skills Architecture

**Project:** bGSD Plugin
**Researched:** 2026-03-08
**Focus:** OpenCode skills system mechanics, agent quality tooling, skills migration viability
**Overall confidence:** HIGH (verified via OpenCode official docs, Context7, opencode-skills plugin source, live system inspection)

## Executive Summary

OpenCode's native skills system (since v1.0.190) provides **lazy-loaded, on-demand instruction packages** that agents can discover and load via a built-in `skill` tool. Skills use a simple directory-per-skill layout with `SKILL.md` files containing YAML frontmatter (name + description required) and markdown instructions. The key architectural insight: **skills are progressive disclosure** — only skill names/descriptions are injected into agent system prompts; full content loads only when the agent calls `skill({ name: "..." })`.

**For bGSD**, the skills system is directly relevant for migrating shared agent metadata (references, common patterns) out of monolithic agent definitions. Currently, bGSD agents embed or inline-reference 12 reference docs and duplicated `<project_context>` blocks across 9+ agents. Skills can hold these as reusable, lazy-loaded packages.

**No new runtime dependencies required.** Skills are pure markdown files with YAML frontmatter — no code, no build tooling, no npm packages. The bGSD deploy.sh would need minor updates to copy skills directories to the host editor config.

**Critical distinction:** OpenCode has three complementary extensibility systems (rules/AGENTS.md, skills, commands). bGSD already uses all three in its own way (references/, agent .md files, commands/*.md). The migration is about **restructuring existing content** into OpenCode's native skill format, not adding new technology.

## OpenCode Skills System Mechanics

### How Skills Work — The Complete Flow

**Confidence: HIGH** (verified via official docs at opencode.ai/docs/skills, Context7 /anomalyco/opencode, and /malhashemi/opencode-skills)

1. **Discovery at startup:** OpenCode scans multiple directories for `skills/*/SKILL.md` files
2. **Index injection:** Discovered skill names and descriptions are injected into the `skill` tool's description as XML, visible to all agents:
   ```xml
   <available_skills>
     <skill>
       <name>git-release</name>
       <description>Create consistent releases and changelogs</description>
     </skill>
   </available_skills>
   ```
3. **On-demand loading:** When an agent decides it needs a skill, it calls `skill({ name: "git-release" })` — this returns the full SKILL.md content
4. **No eager loading:** Full skill content is NOT loaded at startup — only metadata is indexed. This is the key token-saving feature.

### Discovery Paths (Priority Order)

OpenCode searches these paths for `skills/*/SKILL.md`:

| Priority | Path | Scope |
|----------|------|-------|
| 1 | `.opencode/skills/<name>/SKILL.md` | Project-local (OpenCode native) |
| 2 | `.agents/skills/<name>/SKILL.md` | Project-local (agent-compatible) |
| 3 | `.claude/skills/<name>/SKILL.md` | Project-local (Claude-compatible) |
| 4 | `~/.config/opencode/skills/<name>/SKILL.md` | Global (OpenCode native) |
| 5 | `~/.agents/skills/<name>/SKILL.md` | Global (agent-compatible) |
| 6 | `~/.claude/skills/<name>/SKILL.md` | Global (Claude-compatible) |

**Project-local walks up** from CWD to git worktree root, checking each directory.

**For bGSD deployment:** Global skills at `~/.config/opencode/skills/` is the correct target — bGSD is a global plugin, not project-local.

### SKILL.md Frontmatter Schema

```yaml
---
name: skill-name          # REQUIRED — 1-64 chars, lowercase alphanumeric + single hyphens
description: What it does  # REQUIRED — 1-1024 chars, specific enough for agent selection
license: MIT               # OPTIONAL
compatibility: opencode    # OPTIONAL
metadata:                  # OPTIONAL — string-to-string map only
  audience: maintainers
  workflow: github
---
```

**Validation rules:**
- `name` regex: `^[a-z0-9]+(-[a-z0-9]+)*$`
- `name` MUST match the containing directory name exactly
- `description` min length: 1 char (native), 20 chars (opencode-skills plugin legacy)
- Unknown frontmatter fields are silently ignored
- The `allowed-tools` field is parsed but NOT enforced by native OpenCode — use permissions config instead

### Skill Directory Structure

```
my-skill/
├── SKILL.md              # Required — frontmatter + markdown instructions
├── scripts/              # Optional — executable code (bash, python, etc.)
│   └── helper.sh
├── references/           # Optional — documentation to load as needed
│   └── api-docs.md
└── assets/               # Optional — templates, configs, etc.
    └── template.html
```

**Key:** When a skill is loaded, the agent receives base directory context:
```
Base directory for this skill: /path/to/skills/my-skill/
```
This enables relative path resolution for `scripts/`, `references/`, and `assets/`.

### Tool Name Generation

- Native OpenCode: single `skill` tool, takes `name` parameter
- Legacy plugin: each skill becomes `skills_<name>` with hyphens→underscores (e.g., `skills_git_release`)

### Permissions and Access Control

```json
// opencode.json — permission-based control (native v1.0.190+)
{
  "permission": {
    "skill": {
      "*": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

**Per-agent override** in opencode.json:
```json
{
  "agent": {
    "plan": {
      "permission": {
        "skill": {
          "internal-*": "allow"
        }
      }
    }
  }
}
```

**Per-agent override** in agent markdown frontmatter:
```yaml
---
permission:
  skill:
    "documents-*": "allow"
---
```

**Disabling skills entirely** for an agent:
```yaml
---
tools:
  skill: false
---
```

## OpenCode Extensibility Architecture (Three Systems)

### 1. Rules (AGENTS.md / instructions)
- **What:** Static instructions injected into ALL agent conversations at startup
- **When loaded:** Always, immediately, into system prompt
- **bGSD equivalent:** `AGENTS.md` in project root, `references/*.md` loaded by agents
- **Cost:** Full token cost always paid upfront
- **Config:** `instructions` array in opencode.json supports globs and URLs

### 2. Skills (SKILL.md)
- **What:** Modular instruction packages loaded on-demand by agents
- **When loaded:** Only when agent explicitly calls `skill()` tool
- **bGSD equivalent:** `references/*.md` (partial), shared agent patterns (duplicated)
- **Cost:** Only metadata (name+description) paid upfront; full content only when needed
- **Config:** Permission-based access control per agent

### 3. Commands (commands/*.md)
- **What:** User-invokable prompts with argument substitution
- **When loaded:** On user `/command` invocation
- **bGSD equivalent:** `commands/bgsd-*.md` (exact match — bGSD already uses this)
- **Config:** Can specify agent, model, subtask mode

### Key Insight for bGSD Migration

bGSD currently duplicates shared patterns across agent definitions:
- `<project_context>` block (skill/AGENTS.md discovery) — duplicated in 9 agents
- `PATH SETUP` block — duplicated in 10 agents
- References like RACI.md, verification-patterns.md — loaded by multiple agents

Skills can consolidate these into lazy-loaded packages:
- `gsd-project-context` skill — shared project discovery logic
- `gsd-raci` skill — RACI matrix and handoff contracts
- `gsd-verification` skill — verification patterns
- `gsd-tdd` skill — TDD execution patterns

## Recommended Stack Changes for v8.3

### No New Runtime Dependencies

| Category | Decision | Rationale |
|----------|----------|-----------|
| Skills format | SKILL.md (markdown + YAML frontmatter) | Native OpenCode format, no parsing library needed |
| Skills validation | None at build time | OpenCode validates at startup; bGSD deploy.sh can add basic checks |
| Frontmatter parsing | Not needed in gsd-tools.cjs | Skills are consumed by OpenCode, not by gsd-tools |
| Directory structure | `skills/<name>/SKILL.md` | Standard OpenCode convention |

### Deploy Infrastructure Changes

| Change | What | Why |
|--------|------|-----|
| deploy.sh update | Copy `skills/` to `~/.config/opencode/skills/` | Deploy skills alongside agents and commands |
| manifest.json update | Include `skills/*/SKILL.md` and supporting files | Track deployed skills for cleanup |
| build.cjs | No changes needed | Skills are not compiled/bundled |

### Skills to Create (Migration Candidates)

| Skill Name | Source Content | Current Location | Estimated Tokens Saved |
|------------|---------------|------------------|----------------------|
| `gsd-project-context` | `<project_context>` block | Duplicated in 9 agent .md files | ~200 tokens × 9 = 1800 |
| `gsd-raci` | RACI matrix reference | `references/RACI.md` (291 lines) | Loaded only when needed |
| `gsd-verification` | Verification patterns | `references/verification-patterns.md` | Loaded only when needed |
| `gsd-tdd` | TDD execution patterns | `references/tdd.md` | Loaded only when needed |
| `gsd-git-integration` | Git conventions | `references/git-integration.md` | Loaded only when needed |
| `gsd-ui-brand` | Formatting/branding | `references/ui-brand.md` | Loaded only when needed |
| `gsd-model-profiles` | Model selection guide | `references/model-profiles.md` + `model-profile-resolution.md` | Loaded only when needed |
| `gsd-checkpoints` | Checkpoint/trajectory | `references/checkpoints.md` | Loaded only when needed |
| `gsd-continuation` | Continuation format | `references/continuation-format.md` | Loaded only when needed |
| `gsd-questioning` | Questioning patterns | `references/questioning.md` | Loaded only when needed |

### What Cannot Be Skills

| Content | Reason |
|---------|--------|
| Agent system prompts | These ARE the agent definition — they must be in agent .md files |
| Workflow orchestration | Workflows invoke agents, not the other way around |
| CLI tool (gsd-tools.cjs) | Binary, not an instruction package |
| Commands (commands/*.md) | Already using OpenCode's native command system |
| PATH SETUP block | Must be in agent definition (needed before any tool calls) |

## Integration Points with Existing bGSD Architecture

### Agent Manifest System
bGSD agents declare what they need in their frontmatter. Skills complement this:
- **Agent frontmatter** → tool access, model, token budgets
- **Skill loading** → domain knowledge, reference documentation, patterns

### Deploy Pipeline
Current: `deploy.sh` copies agents/, commands/, bin/, references/, workflows/
New: Also copies `skills/*/` to `~/.config/opencode/skills/`

### Agent Definition Changes
Each agent currently has a `<project_context>` block instructing it to check `.agents/skills/`. This can be:
1. **Kept as-is** for project-level skills (user's project context)
2. **Supplemented** with bGSD-level skills for shared reference docs

The bGSD skills would live at the global level (`~/.config/opencode/skills/`) and provide GSD-specific knowledge. Project skills stay project-local.

### Token Budget Impact
- **Current:** References loaded eagerly by agents that declare them (~60-80K token budgets)
- **With skills:** Only skill names/descriptions in system prompt (~50 tokens per skill × 10 skills = 500 tokens)
- **Savings:** References load only when needed, not upfront. Estimated 20-40% reduction in baseline agent context for agents that load multiple references.

## Constraints and Limitations

### 1. No Conditional Skill Discovery
Skills are discovered at startup and cached. You cannot dynamically register or unregister skills mid-session. Restart required after adding/modifying skills.

### 2. Agent Must Decide to Load
Skills are **passive** — the agent must recognize it needs a skill and call `skill()`. If the description is vague, agents may not load it when they should. Good descriptions are critical.

### 3. No Skill Composition
Skills cannot import or reference other skills. Each skill is standalone. If a skill needs content from another, it must duplicate or reference the file path.

### 4. Name Uniqueness Across All Paths
Skill names must be unique across ALL discovery paths. A project-local `gsd-raci` would conflict with a global `gsd-raci`. Use a consistent prefix convention (e.g., `gsd-*` for bGSD skills).

### 5. Description Length Matters
The description is what agents see to decide whether to load a skill. Too short = missed loads. Too long = wasted tokens in every agent's system prompt. Target 50-150 characters.

### 6. File-Based Only
Skills cannot contain executable logic that OpenCode runs. They're instruction documents. Scripts in `scripts/` are referenced by the skill content but executed by the agent via bash tool, not by the skill system itself.

### 7. No Version Pinning
Skills don't have built-in versioning. The `metadata.version` field is informational only — OpenCode doesn't enforce compatibility.

### 8. Claude Code Compatibility
OpenCode reads `.claude/skills/` as a fallback path. If bGSD ever needs cross-editor compatibility, skills placed in `.agents/skills/` would be recognized by OpenCode (via the agent-compatible path).

## Alternatives Considered

| Approach | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Shared agent content | OpenCode skills | Inline in each agent .md | Duplication, token waste, maintenance burden |
| Reference loading | Skills with `references/` subdirs | Current manual `Read` tool calls | Skills provide base directory context, cleaner UX |
| Project context | Keep `<project_context>` in agents | Move to skill | Project context detection must happen at agent startup, not on-demand |
| Deploy mechanism | Extend deploy.sh | Separate skills installer | Keep single deploy pipeline |
| Skill placement | Global `~/.config/opencode/skills/` | Project-local `.opencode/skills/` | bGSD is a global plugin, not project-specific |

## Sources

- OpenCode Official Skills Docs — https://opencode.ai/docs/skills (last updated Mar 7, 2026) — **HIGH confidence**
- OpenCode Agents Docs — https://opencode.ai/docs/agents — **HIGH confidence**
- OpenCode Tools Docs — https://opencode.ai/docs/tools — **HIGH confidence**
- OpenCode Rules Docs — https://opencode.ai/docs/rules — **HIGH confidence**
- OpenCode Commands Docs — https://opencode.ai/docs/commands — **HIGH confidence**
- OpenCode Custom Tools Docs — https://opencode.ai/docs/custom-tools — **HIGH confidence**
- Context7 /anomalyco/opencode (939 snippets, High reputation) — **HIGH confidence**
- Context7 /malhashemi/opencode-skills (77 snippets, High reputation) — **HIGH confidence**
- malhashemi/opencode-skills GitHub README (archived, graduated to native) — **MEDIUM confidence** (historical, but skill format unchanged)
- Live system inspection of `~/.config/oc/` directory structure — **HIGH confidence**
- bGSD agent .md files (gsd-executor.md, gsd-planner.md, gsd-github-ci.md) — **HIGH confidence** (primary source)
- bGSD deploy.sh and plugin.js — **HIGH confidence** (primary source)

---
*Last updated: 2026-03-08*
