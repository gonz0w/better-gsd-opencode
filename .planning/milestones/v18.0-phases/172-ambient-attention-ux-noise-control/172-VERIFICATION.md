---
phase: 172-ambient-attention-ux-noise-control
verified_at: 2026-03-31T19:22:44Z
status: human_needed
score: 3/3
is_re_verification: false
intent_alignment: aligned
requirements_checked:
  - CMUX-05
  - CMUX-06
  - CMUX-09
must_haves:
  truths:
    - Users see concise sidebar log entries for major lifecycle moments while routine refreshes stay silent.
    - Attention-worthy moments notify, while routine task completion stays log-only.
    - Repeated non-essential events are deduped/rate-limited so unchanged refreshes do not spam logs or notifications.
  artifacts:
    - src/plugin/cmux-attention-policy.js
    - src/plugin/cmux-targeting.js
    - src/plugin/cmux-attention-sync.js
    - src/plugin/index.js
    - tests/plugin-cmux-attention-policy.test.cjs
    - tests/plugin-cmux-targeting.test.cjs
    - tests/plugin.test.cjs
  key_links:
    - src/plugin/cmux-attention-policy.js -> src/plugin/cmux-targeting.js
    - src/plugin/index.js -> src/plugin/cmux-attention-sync.js
    - src/plugin/cmux-attention-sync.js -> src/plugin/cmux-attention-policy.js
    - src/plugin/cmux-attention-sync.js -> src/plugin/cmux-targeting.js
    - tests/plugin.test.cjs -> src/plugin/index.js
gaps: []
human_verification_required:
  - Validate live attached `cmux` UX: confirm sidebar log wording stays glanceable and notifications feel exceptional rather than distracting in a real session.
---

# Phase 172 Verification

## Intent Alignment

**Verdict:** aligned

The core expected user change landed: attached `cmux` sessions now emit concise ambient log lines for meaningful lifecycle moments, escalate checkpoints/warnings/blockers and plan/phase/workflow completion via notifications, and suppress unchanged warning/blocker churn through semantic keys plus cooldown memory. The implementation also preserves the explicit non-goal boundaries: no notification center, no preference UI, and no rewrite of Phase 170/171 targeting or trust logic.

## Goal Achievement

| Observable truth | Status | Evidence |
|---|---|---|
| Concise sidebar logs appear for meaningful lifecycle moments while routine refreshes stay silent | ✓ VERIFIED | `src/plugin/cmux-attention-sync.js` builds start/task/checkpoint/boundary candidates and emits logs only on semantic events; `tests/plugin.test.cjs:1393-1423` proves startup and routine task completion are log-only and checkpoint emits a sidebar log. |
| Attention-worthy moments notify, but routine task completion does not | ✓ VERIFIED | `src/plugin/cmux-attention-policy.js` reserves notify payloads for `checkpoint`, `waiting-input`, `blocker`, `warning`, `plan-complete`, `phase-complete`, and `workflow-complete`; `tests/plugin-cmux-attention-policy.test.cjs:53-92` and `tests/plugin.test.cjs:1428-1458` verify notify-worthy events and non-notifying routine task completion. |
| Repeated non-essential events are deduped/rate-limited to prevent spam | ✓ VERIFIED | `buildAttentionEventKey()` and `shouldEmitAttentionEvent()` in `src/plugin/cmux-attention-policy.js` create semantic keys and cooldown behavior; `createAttentionMemory()`/`syncCmuxAttention()` in `src/plugin/cmux-attention-sync.js` persist per-workspace last-emitted keys/timestamps; `tests/plugin.test.cjs:1443-1448` proves repeated unchanged warnings stay quiet. |

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Evidence |
|---|---|---|---|---|
| `src/plugin/cmux-attention-policy.js` | ✓ | ✓ | ✓ | Exports real classification/dedupe functions (`buildAttentionEventKey`, `classifyAttentionEvent`, `shouldEmitAttentionEvent`) and is consumed by `src/plugin/cmux-attention-sync.js`. |
| `src/plugin/cmux-targeting.js` | ✓ | ✓ | ✓ | Attached adapter exposes real workspace-scoped `log(...)` and `notify(...)`; suppressed adapter keeps notify inert; used by plugin startup and sync paths through `createAttachedCmuxAdapter` / `createNoopCmuxAdapter`. |
| `src/plugin/cmux-attention-sync.js` | ✓ | ✓ | ✓ | Implements stateful edge-triggered attention sync, per-workspace memory, event derivation, dedupe, and adapter writes. |
| `src/plugin/index.js` | ✓ | ✓ | ✓ | Wires `refreshCmuxAttention()` separately from `refreshCmuxSidebar()` on startup, `session.idle`, `file.watcher.updated`, and `tool.execute.after`. |
| `tests/plugin-cmux-attention-policy.test.cjs` | ✓ | ✓ | ✓ | Covers log-only vs notify-worthy classification, semantic keys, and cooldown behavior. |
| `tests/plugin-cmux-targeting.test.cjs` | ✓ | ✓ | ✓ | Covers attached workspace-scoped notify delivery plus suppressed/not-attached inert behavior. |
| `tests/plugin.test.cjs` | ✓ | ✓ | ✓ | Covers plugin-level startup/task logging, checkpoint notification, phase-complete notification, and repeated warning suppression. |

**Artifact-helper note:** `verify:verify artifacts` reported contains-pattern mismatches for both plans because plan metadata uses prose/comma-separated `contains` strings rather than stable exact verifier tokens. Manual code inspection plus targeted tests confirmed the shipped artifacts are substantive and wired.

## Key Link Verification

| Link | Status | Evidence |
|---|---|---|
| `cmux-attention-policy.js` → `cmux-targeting.js` | WIRED | Policy output is consumed by `syncCmuxAttention()`, which calls adapter `log(...)` and `notify(...)` through the trusted targeting boundary. Helper: verified. |
| `index.js` → `cmux-attention-sync.js` | WIRED | `refreshCmuxAttention()` imports and calls `syncCmuxAttention()` separately from sidebar refresh on all intended lifecycle hooks. Helper: verified. |
| `cmux-attention-sync.js` → `cmux-attention-policy.js` | WIRED | `syncCmuxAttention()` imports `shouldEmitAttentionEvent()` and uses its event decisions before any write. Helper: verified. |
| `cmux-attention-sync.js` → `cmux-targeting.js` | WIRED | Sync writes only through adapter `log(...)` and `notify(...)`, preserving attached/suppressed trust gating from targeting. Helper: verified. |
| `tests/plugin.test.cjs` → `index.js` | WIRED | Integration tests instantiate `BgsdPlugin`, drive startup/hook refreshes, and assert emitted log/notify behavior end-to-end. |

## Requirements Coverage

| Requirement | Coverage | Evidence |
|---|---|---|
| `CMUX-05` concise sidebar log entries for major lifecycle moments | Covered | Startup/task/checkpoint/phase-complete log paths exist in `src/plugin/cmux-attention-sync.js` and are exercised by `tests/plugin.test.cjs:1393-1458`. |
| `CMUX-06` notifications for attention-worthy moments | Covered | Notify payloads exist only for attention-worthy kinds in `src/plugin/cmux-attention-policy.js`; checkpoint and phase-complete notification behavior is validated in `tests/plugin.test.cjs`. |
| `CMUX-09` deduped/rate-limited low-noise behavior | Covered | Semantic keys and cooldown logic live in `src/plugin/cmux-attention-policy.js`; per-workspace memory suppression lives in `src/plugin/cmux-attention-sync.js`; unchanged warning suppression is validated in `tests/plugin.test.cjs:1443-1448`. |

Plan frontmatter requirement IDs (`172-01-PLAN.md`, `172-02-PLAN.md`) match `/Users/cam/DEV/bgsd-oc/.planning/REQUIREMENTS.md` for `CMUX-05`, `CMUX-06`, and `CMUX-09`.

## Anti-Patterns Found

| Severity | Finding | Status |
|---|---|---|
| ℹ️ Info | No TODO/FIXME/placeholder patterns were found in the touched source or focused test files. | Clear |
| ℹ️ Info | Plan artifact metadata `contains` fields are overly literal for helper matching, causing automated artifact-helper false negatives despite real implementation. | Warning to planner metadata quality, not a shipped-code blocker |

## Human Verification Required

1. Validate with a live attached `cmux` workspace that the sidebar copy remains glanceable in real usage.
2. Validate that notifications for checkpoints/warnings/completion boundaries feel exceptional rather than spammy in a real operator session.

## Gaps Summary

Automated verification found no shipped-code gaps blocking the phase goal. Focused tests passed, the bundle rebuilt successfully, and the built `plugin.js` contains the new attention-sync runtime surface. Remaining follow-up is human UX validation of real `cmux` behavior and notification feel.

## Verification Evidence

- `npm run test:file -- tests/plugin-cmux-targeting.test.cjs tests/plugin-cmux-attention-policy.test.cjs` ✅
- `node --test --test-force-exit --test-name-pattern "Plugin cmux attention sync" tests/plugin.test.cjs` ✅
- `npm run build` ✅
- Built runtime check: `plugin.js` contains `createAttentionMemory`, `syncCmuxAttention`, and `refreshCmuxAttention` hook wiring.
