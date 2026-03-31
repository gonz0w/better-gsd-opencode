# Research Summary: OpenCode Skills Integration

**Domain:** Skills-agent architecture integration for bGSD plugin
**Researched:** 2026-03-08
**Overall confidence:** HIGH

## Executive Summary

OpenCode skills are an on-demand knowledge loading mechanism that registers shared instruction bundles as callable tools. The `opencode-agent-skills` plugin (already installed and registered in `opencode.json`) scans `~/.config/oc/skills/` for `SKILL.md` files, validates them, and makes each one callable via `skill({ name: "..." })`. Skills use the message insertion pattern (`noReply: true`) to inject content into conversations, which critically means skill content SURVIVES context compaction — a significant advantage over @-references.

The bGSD system currently has 9 agents totaling 7,145 lines of system prompts and 12 reference files totaling 3,148 lines. Significant knowledge is duplicated across agents (goal-backward methodology in 4 agents, checkpoint protocols in 2 agents + 1 workflow). By extracting 6 shared knowledge domains into skills, we can reduce agent prompt sizes by 700-900 lines while shifting ~1,700 lines of always-loaded @-references to on-demand loading.

The migration path is incremental: create skills first (zero risk, additive only), then slim agents one at a time (each independently testable), then clean up migrated references. No big-bang cutover. Agent identity sections (role, execution flow, structured returns, success criteria) stay in agent definitions — only shared METHODOLOGY moves to skills.

The `opencode-agent-skills` plugin is already configured but the `~/.config/oc/skills/` directory is empty. All infrastructure is in place; we just need to write skill files and update agent definitions.

## Key Findings

**Stack:** OpenCode skills plugin already installed (`opencode-agent-skills` in `opencode.json`). No new dependencies needed.
**Architecture:** 6 skills extract shared knowledge, agents keep identity. Skills loaded on-demand via tool call, not at spawn time.
**Critical pitfall:** Agent stubs must include 3-5 line "quick reference" — if skill loading fails, agent must degrade gracefully, not break.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Skills Creation** - Create all 6 skill files (parallelizable)
   - Addresses: Shared knowledge extraction, skill SKILL.md + references
   - Avoids: No agent changes = zero regression risk

2. **Agent Slim-Down** - Replace inline methodology with skill stubs in agents
   - Addresses: Agent context reduction, on-demand loading
   - Avoids: Risk 3 (agent doesn't load) — mitigated by testing each agent independently

3. **Cleanup & Deploy** - Remove migrated references, update workflows, update deploy.sh
   - Addresses: Clean architecture, no dead references
   - Avoids: Premature cleanup — only after skills proven stable

**Phase ordering rationale:**
- Skills must exist before agents can reference them (Phase 1 → Phase 2)
- References can only be removed after agents stop referencing them (Phase 2 → Phase 3)
- Each phase is independently shippable — can stop after Phase 1 if viability unclear

**Research flags for phases:**
- Phase 1: Standard patterns, unlikely to need research
- Phase 2: MEDIUM risk — needs testing that agents actually load skills when expected (Risk 3)
- Phase 3: Standard patterns, unlikely to need research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Skills architecture | HIGH | Verified via Context7 + live plugin source |
| Integration model | HIGH | Skills plugin already installed, just needs content |
| Migration strategy | HIGH | Incremental approach, each step reversible |
| Context savings | MEDIUM | Estimated from line counts; actual token savings depend on tokenization |
| Agent behavior after migration | MEDIUM | Requires testing — agents may not always load skills when needed |

## Gaps to Address

- Testing methodology for validating skill-augmented agents produce equivalent output
- Whether `mcp_use_skill` / `mcp_skill` tools need explicit declaration in agent frontmatter (likely not — they're global)
- Skill content quality validation (no automated way to verify skill is "good enough")
- Long-session behavior: does skill content survive multiple compactions?
