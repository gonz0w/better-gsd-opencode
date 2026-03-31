# Phase 173 Milestone Audit

## Method and Scope

This is the canonical six-pass milestone audit for Phase 173. It is the only findings ledger for this phase and is intended to stay execution-first: later cleanup plans should lift finding IDs from this file instead of rebuilding separate review notes.

### Locked review method

- **six-pass coverage:** dead-code, duplication, simplification, concurrency, error-handling, hygiene.
- **evidence policy:** prefer repo-local audit artifacts (`audit:dead-code`, `audit:exports`, `audit:circular`, `audit:commands`) plus direct source reads and hotspot counts; tool output can nominate candidates but does not become truth without file-backed notes.
- **hybrid classification model:** each finding records `action_bucket` plus explicit `confidence` so proven delete candidates stay distinct from proof-needed suspects.
- **pass-tag dedupe rule:** each cleanup unit appears once in the ledger with merged `pass_tags`; repeated per-pass hotspot sections are intentionally forbidden.
- **stable `finding_id` convention:** use `AUD-###` identifiers in milestone order and keep the ID stable even if confidence, notes, or sequencing guidance changes later.
- **stage-gate handling:** `recommended_stage_gate` is reserved for plan 02 sequencing work; task 01 only locks the column and placeholder usage.

### Evidence inputs used by this audit

- `package.json` audit scripts: `audit:dead-code`, `audit:exports`, `audit:circular`, `audit:commands`
- Locked phase context: `173-CONTEXT.md`, `173-RESEARCH.md`, roadmap, requirements, intent docs
- Direct source inspection of router, command, output, and plugin hotspot files named in the plan

## Canonical Findings Ledger

| finding_id | hotspot | files | pass_tags | action_bucket | confidence | blast_radius | evidence_strength | sequencing_dependency | recommended_stage_gate | notes |
|------------|---------|-------|-----------|---------------|------------|--------------|-------------------|-----------------------|------------------------|-------|
| AUD-001..TBD | Rows populated in task 02 | `.planning/milestones/v18.1-phases/173-simplification-audit-safe-sequencing/173-MILESTONE-AUDIT.md` | dead-code, duplication, simplification, concurrency, error-handling, hygiene | TBD | TBD | TBD | Schema locked in task 01 | Depends on evidence synthesis in task 02 | Placeholder — assign in 173-02 | One canonical ledger only; no duplicate per-pass sections |
