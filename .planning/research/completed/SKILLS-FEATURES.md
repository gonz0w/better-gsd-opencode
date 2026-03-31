# Feature Landscape: Skills Integration

**Domain:** Skills-agent architecture for bGSD plugin
**Researched:** 2026-03-08

## Table Stakes

Features that must work for skills integration to be viable. Missing = migration fails.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Skills discoverable by agents | Plugin registers skills as tools — agents must see them | Low | Plugin already installed, just needs SKILL.md files |
| Skills load on-demand | Agent calls skill tool, content injected | Low | Plugin handles via message insertion pattern |
| Content survives compaction | Skills use `noReply: true` — must persist | Low | Verified in plugin source code |
| Agent stubs include fallback | Agent must function (degraded) without skill | Med | Each stub needs 2-5 line quick reference |
| deploy.sh copies skills | Skills must deploy alongside agents/workflows | Low | Additive change to existing script |
| gsd- prefix namespace | Skills must not collide with project-level skills | Low | Naming convention only |

## Differentiators

Features that make skills integration valuable beyond "just works."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| On-demand loading | Context savings — only load what's needed | Low | Core skills architecture benefit |
| Single source of truth | Update methodology in ONE place, all agents get update | Low | Eliminates cross-agent duplication |
| Selective reference loading | Skills can have `references/*.md` sub-files | Low | `mcp_read_skill_file` tool available |
| Graceful degradation | Agent works without skill (degraded quality) | Med | Requires careful stub design |
| Incremental migration | Each agent migrates independently | Low | No big-bang cutover required |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-loading skills at agent spawn | Defeats on-demand purpose, back to @-reference model | Let agents decide when to load |
| Skill dependency chains | Skill A requires Skill B = complexity explosion | Each skill self-contained |
| Dynamic skill generation | Skills from templates or CLI | Skills are static authored files |
| Skill analytics/tracking | Tracking which agents load which skills | Not needed — skills are transparent |
| Mega-skills (all-in-one) | One skill with all knowledge = same as @-reference bloat | One skill per knowledge domain |

## Feature Dependencies

```
Skill files created → Agent stubs reference skills → References cleaned up → deploy.sh updated
                        ↑ no dependency              ↑ depends on agents    ↑ independent
```

## MVP Recommendation

Prioritize:
1. Create `gsd-goal-backward` skill (highest reuse — 4 agents)
2. Create `gsd-checkpoints` skill (largest content — 746 lines)
3. Migrate `gsd-planner` as proof-of-concept (highest savings)

Defer:
- `gsd-deviation-rules` skill: Only used by executor, low reuse value
- Reference cleanup: Only after migration proven stable
- Workflow @-reference updates: Last step, lowest risk

## Sources

- OpenCode skills feature set: Context7 `/anomalyco/opencode` (HIGH)
- Plugin capabilities: Context7 `/malhashemi/opencode-skills` (HIGH)
- Current architecture analysis: Live agent files (HIGH)
