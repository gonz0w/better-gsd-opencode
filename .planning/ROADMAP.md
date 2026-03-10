# Roadmap: bGSD Plugin v9.2 CLI Tool Integrations & Runtime Modernization

## Overview

This milestone expands CLI tool integrations for faster operations and explores Bun runtime for significant startup improvements.

## Milestones

- ⏳ **v9.2 CLI Tool Integrations & Runtime Modernization** - Phases 82+ (planned)
- ✅ **v9.1 Performance Acceleration** - Phases 77-81 (completed 2026-03-10) — see `.planning/milestones/v9.1-ROADMAP.md`
- ✅ Previous milestones shipped - see `.planning/MILESTONES.md`

## Phases

<details>
<summary>✅ Phase 77-81: v9.1 Performance Acceleration (archived)</summary>

- Phase 77: Validation Engine Modernization — valibot with zod fallback, 34.48% improvement
- Phase 78: File Discovery and Ignore Optimization — fast-glob, no subprocess overhead
- Phase 79: Startup Compile-Cache Acceleration — warm starts 76-102ms faster
- Phase 80: SQLite Statement Cache Acceleration — p50 ~43% faster, p99 ~22% faster
- Phase 81: Safe Adoption Controls — optimization flags, parity-check, backward compatibility

See `.planning/milestones/v9.1-ROADMAP.md` for full details.

</details>

## v9.2 Scope (Draft)

### CLI Tool Integrations

- **Search/Grep**: ripgrep (rg), ugrep integration
- **File Discovery**: fd integration
- **Fuzzy Finding**: fzf integration
- **Output**: bat for syntax-highlighted output
- **Git Tools**: gh CLI, lazygit integration
- **Data Processing**: jq, yq integration

### Runtime Modernization

- Explore Bun runtime for 3-5x faster startup
- Evaluate pnpm for faster package installation

### Benchmarking

- Competitive plugin benchmark adapter

---

## Progress

| Milestone | Status |
|-----------|--------|
| v9.1 Performance Acceleration | ✅ Complete |
| v9.2 CLI Tool Integrations | ⏳ Planned |

---

*See `.planning/milestones/v9.1-ROADMAP.md` for v9.1 archive.*
