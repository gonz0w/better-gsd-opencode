# Research Summary: v8.3 Agent Quality & Skills

**Domain:** Agent quality standardization + OpenCode skills architecture migration
**Researched:** 2026-03-08
**Overall confidence:** HIGH

## Executive Summary

v8.3 addresses two interconnected goals: raising all 9 bGSD agents to consistent quality standards, and migrating shared agent metadata into OpenCode's native skills architecture to reduce token waste and maintenance burden.

OpenCode's skills system (native since v1.0.190) is a proven, stable mechanism for lazy-loading reusable instruction packages. Skills use a simple `SKILL.md` file with YAML frontmatter (name + description required) in a directory-per-skill layout. The system provides **progressive disclosure** — only skill metadata (50 tokens per skill) is loaded at startup; full content loads on-demand when an agent calls `skill({ name: "..." })`. This directly addresses bGSD's current problem of duplicated reference content across 9 agent definitions.

The GitHub CI agent overhaul is the most concrete quality improvement needed — it lacks structured progress tracking, proper gates, and consistent patterns found in other agents like gsd-executor and gsd-planner. The consistency audit across all 9 agents should standardize common blocks (`<project_context>`, PATH SETUP, structured returns) and identify candidates for skill extraction.

The 31 pre-existing test failures (config-migrate, compact, codebase-impact, codebase ast) represent accumulated tech debt that should be resolved to maintain test suite credibility.

## Key Findings

**Stack:** No new runtime dependencies. Skills are pure markdown — no build tooling, parsing libraries, or npm packages needed. Only deploy.sh needs updates to copy skills/ directories.

**Architecture:** Skills complement the existing agent manifest system. Agent frontmatter controls tool access and token budgets; skills provide lazy-loaded domain knowledge. The deploy pipeline extends naturally (add skills/ to manifest).

**Critical pitfall:** Skill descriptions are the sole mechanism agents use to decide whether to load a skill. Vague or over-generic descriptions cause missed loads or unnecessary loads. This is effectively a prompt engineering problem, not a code problem.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **GitHub CI Agent Overhaul** — Highest concrete impact, most well-defined scope
   - Addresses: Agent brought to standard with structured progress, gates, proper error handling
   - Avoids: Scope creep into other agents (separate consistency audit)

2. **Agent Consistency Audit** — Must happen before skills migration (identifies what's duplicated)
   - Addresses: Cataloguing common blocks, inconsistencies, duplication across 9 agents
   - Avoids: Migrating content that should actually be eliminated

3. **Skills Architecture Migration** — Convert identified shared content into OpenCode skills
   - Addresses: 12 reference docs, duplicated `<project_context>` blocks, shared patterns
   - Avoids: Over-migration (agent core logic must stay in agent definitions)

4. **Test Debt Cleanup** — Independent work, can be done in parallel or last
   - Addresses: 31 pre-existing test failures (config-migrate, compact, codebase-impact, codebase ast)
   - Avoids: Masking new breakage behind old failures

**Phase ordering rationale:**
- CI agent first — self-contained, builds confidence in the quality patterns
- Audit second — informs what content moves to skills vs. stays in agents
- Skills third — depends on audit findings for migration candidates
- Tests can run parallel to any phase (independent codebase area)

**Research flags for phases:**
- Phase 1 (CI Agent): Standard patterns, unlikely to need research — copy patterns from gsd-executor
- Phase 2 (Audit): Discovery work, findings drive later phases
- Phase 3 (Skills): Skill descriptions need careful prompt engineering — may need iteration
- Phase 4 (Tests): Standard debugging, no research needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new deps, verified via official OpenCode docs and live system |
| Skills mechanics | HIGH | Verified via Context7, official docs, plugin source, multiple concordant sources |
| Migration viability | HIGH | Skills format is simple markdown, direct mapping from existing references/ |
| Agent quality patterns | HIGH | Patterns already established in existing high-quality agents (gsd-executor, gsd-planner) |
| Token savings estimate | MEDIUM | 20-40% reduction estimated but depends on agent usage patterns |
| Description effectiveness | MEDIUM | Prompt engineering — needs empirical validation |

## Gaps to Address

- Exact token savings from skill migration (measurable only after implementation)
- Optimal skill description length and phrasing for bGSD use cases
- Whether PATH SETUP can be extracted to a skill (currently needs to run before any tool calls — timing concern)
- Integration testing for skill loading in the deploy pipeline (does deploy.sh correctly preserve skill directory structure?)
- Whether any of the 12 reference docs are actually unused and should be removed rather than migrated

---
*Last updated: 2026-03-08*
