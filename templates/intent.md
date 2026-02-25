# INTENT.md Reference

Reference for `.planning/INTENT.md` — project-level intent capture. One per project, lives alongside ROADMAP.md and STATE.md.

## Structure

INTENT.md uses XML-tagged sections in narrative order. No preamble — file starts with metadata then `<objective>`.

**Metadata (top of file):**
```
**Revision:** N
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD
```

**Sections (in order):**

| Tag | Purpose | ID Format |
|-----|---------|-----------|
| `<objective>` | What this project does and why | None |
| `<users>` | Target audience descriptions | None |
| `<outcomes>` | Desired outcomes with priorities | `DO-XX [PX]:` |
| `<criteria>` | Launch gates / success criteria | `SC-XX:` |
| `<constraints>` | Technical, business, timeline limits | `C-XX:` |
| `<health>` | Quantitative metrics + qualitative principles | `HM-XX:` (quantitative only) |

## Section Details

### `<objective>`
Single statement on first line: what the project does and why. Remaining lines elaborate (2-3 sentences max).

Good: `A zero-dependency CLI that provides structured data operations for AI-driven project planning workflows.`
Bad: `Make a good tool.`

### `<users>`
Bullet list of audience segments, one per line. Brief descriptions.

Good: `- Software developers using AI coding assistants for project management`
Bad: `- Everyone`

### `<outcomes>`
Bullet list with IDs and priorities. Format: `- DO-XX [PX]: description`

Priorities: P1 (Critical), P2 (Important), P3 (Nice-to-have).

Good: `- DO-01 [P1]: Every project captures why it exists in a machine-readable format`
Bad: `- Make it work well`

### `<criteria>`
Bullet list of launch gates. Format: `- SC-XX: measurable gate`

Good: `- SC-01: Running intent create produces a valid INTENT.md with all sections`
Bad: `- SC-01: It should be good`

### `<constraints>`
Sub-headers `### Technical`, `### Business`, `### Timeline` inside the tag. Items: `- C-XX: constraint`

### `<health>`
Sub-header `### Quantitative` with items `- HM-XX: metric`. Sub-header `### Qualitative` with prose (no IDs).

## Rules

1. **Revision auto-increment:** Every update increments the revision number
2. **ID gap preservation:** When items are removed, remaining IDs are NOT renumbered — gaps remain to preserve external references
3. **No preamble:** Actual INTENT.md files start with metadata then `<objective>` — no "how to use" header
4. **All sections required:** A valid INTENT.md has all 6 XML-tagged sections

## Example 1: CLI Tool

```markdown
**Revision:** 1
**Created:** 2026-01-15
**Updated:** 2026-01-15

<objective>
A database backup CLI that automates PostgreSQL backup, rotation, and restore for teams running self-hosted infrastructure.

Reduces manual backup toil from hours/week to zero. Targets DevOps engineers who need reliable, auditable backups without managed-service lock-in.
</objective>

<users>
- DevOps engineers managing self-hosted PostgreSQL clusters
- Developers who need local database snapshots for testing
- CI/CD pipelines requiring pre-migration backup steps
</users>

<outcomes>
- DO-01 [P1]: Full and incremental backups complete without manual intervention
- DO-02 [P1]: Restore from any backup point within retention window succeeds
- DO-03 [P2]: Backup status visible in monitoring dashboards via structured output
- DO-04 [P3]: Backup files are encrypted at rest with configurable key management
</outcomes>

<criteria>
- SC-01: Backup and restore round-trip preserves all data (zero data loss)
- SC-02: Incremental backup completes in under 60 seconds for databases under 10GB
- SC-03: CLI exit codes enable CI/CD pipeline integration (0=success, 1=failure)
</criteria>

<constraints>
### Technical
- C-01: Zero runtime dependencies beyond Node.js 18+ and pg_dump
- C-02: Single binary distribution via npm

### Business
- C-03: Must work with PostgreSQL 12-16

### Timeline
- C-04: MVP (backup + restore) by end of Q1
</constraints>

<health>
### Quantitative
- HM-01: Backup success rate >99.9%
- HM-02: Mean restore time <5 minutes for 10GB database

### Qualitative
Backups should be invisible when working — zero manual steps in the happy path. Failures should be loud, specific, and actionable.
</health>
```

## Example 2: Web Application

```markdown
**Revision:** 3
**Created:** 2026-01-10
**Updated:** 2026-02-20

<objective>
A team knowledge base that captures decisions, context, and rationale so institutional knowledge survives team changes.

Most project knowledge lives in people's heads or scattered Slack threads. This app makes decisions discoverable, traceable, and permanent.
</objective>

<users>
- Engineering teams (5-50 people) making architectural decisions
- Product managers tracking why features were scoped a certain way
- New team members onboarding who need historical context
</users>

<outcomes>
- DO-01 [P1]: Teams can record decisions with structured context (problem, options, choice, rationale)
- DO-02 [P1]: Any team member can search and find relevant past decisions in under 30 seconds
- DO-04 [P2]: Decisions link to related code changes and documents
- DO-05 [P2]: Teams receive alerts when related decisions may conflict
- DO-06 [P3]: Decision templates enforce consistent structure across teams
</outcomes>

<criteria>
- SC-01: Search returns relevant decisions within 2 seconds for databases with 1000+ entries
- SC-02: Decision creation takes under 3 minutes with guided flow
- SC-03: All decisions have required fields: problem statement, chosen option, rationale
</criteria>

<constraints>
### Technical
- C-01: Self-hostable on standard cloud infrastructure (Docker + PostgreSQL)
- C-02: API-first design — all features accessible via REST API
- C-03: SSO integration via SAML/OIDC for enterprise customers

### Business
- C-04: Free tier supports teams up to 10 members
- C-05: No vendor lock-in — data exportable in standard formats

### Timeline
- C-06: Public beta by end of Q2
</constraints>

<health>
### Quantitative
- HM-01: Decision search latency p95 <2s
- HM-02: Monthly active decision creators >60% of team members
- HM-03: New member onboarding time reduced by 40%

### Qualitative
Recording a decision should feel like writing a commit message — fast, natural, and part of the workflow. The app should never feel like extra paperwork.
</health>
```

Note: Example 2 has an ID gap (DO-03 removed) — this is intentional and correct per the gap preservation rule.
