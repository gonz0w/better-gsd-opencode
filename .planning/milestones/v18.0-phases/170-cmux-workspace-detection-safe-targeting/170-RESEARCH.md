# Phase 170: cmux Workspace Detection & Safe Targeting - Research

**Researched:** 2026-03-31
**Domain:** Plugin-side cmux detection, workspace proof, and fail-open targeting
**Confidence:** HIGH

## User Constraints

- Keep Phase 170 strictly about safe attachment and targeting. Do not broaden into user-facing sidebar UX beyond the minimum reversible proof needed to trust later writes.
- Honor the locked safety gate from `170-CONTEXT.md`: enable cmux integration only when bGSD can prove both the exact target workspace and a reachable write path for that workspace.
- Treat managed-terminal startup as the primary success path. Alongside attachment is compatibility-only because cmux access mode defaults to `cmux processes only`, which normally rejects callers not spawned inside cmux.
- Fail open quietly for normal users. Suppression reasons belong in plugin logs or `BGSD_DEBUG` diagnostics, not in new user-facing notifications.
- Keep the scope workspace-level only. Do not add per-agent pane identity, progress heuristics, or notification policy in this phase.

## Phase Requirements

- `CMUX-01` Integration turns on only when the active workspace can be targeted safely.
- `CMUX-07` Multi-workspace sessions never leak or overwrite another workspace's sidebar state.
- `CMUX-08` Non-cmux or unreachable cmux sessions keep current plugin behavior unchanged.

## Summary

Phase 170 should be planned as a plugin-local adapter phase, not a broad plugin-lifecycle rewrite. The codebase already has the right shape for this: `src/plugin/index.js` is the plugin composition root, `src/plugin/notification.js` and the event helpers already centralize later UX signals, and `src/plugin/cli-path.js` plus `src/plugin/node-runtime.js` show the established pattern for isolated runtime/CLI discovery. There is no existing cmux abstraction yet, so the safest plan is to add one small plugin-local cmux layer and keep every existing subsystem fail-open.

The most important planning decision is to separate `detection` from `proof`. `ping`, `capabilities`, env vars, and `identify` are enough to detect a reachable cmux environment and verify whether the caller is inside a managed cmux surface. They are not enough by themselves to satisfy the locked write-path gate. For Phase 170, the adapter should therefore produce a structured targeting verdict with explicit suppression reasons, and it should only report `attached` after exact workspace proof succeeds and a reversible targeted write probe succeeds for that workspace.

**Primary recommendation:** Add a new plugin-local cmux adapter with three stages: (1) detect and classify the cmux environment, (2) prove exactly one workspace target using managed-terminal env first and exact cwd matching only as a compatibility fallback, and (3) prove a reversible workspace-scoped write path before later phases are allowed to emit status/progress/log updates.

## Standard Stack

### Core
| Module | Purpose | Why It Is Standard For Phase 170 |
|--------|---------|-----------------------------------|
| `src/plugin/index.js` | Plugin composition root and lifecycle hook wiring | This is where the cmux adapter should be initialized and held without disturbing existing subsystems |
| `src/plugin/notification.js` | Existing deduped notification/logging spine | Useful as a design boundary reference, but should not become the cmux transport in this phase |
| `src/plugin/cli-path.js` | Proven CLI path resolution pattern | Shows the repo's preferred "small helper + cached resolution" style for external command discovery |
| `src/plugin/node-runtime.js` | Proven runtime probing pattern | Good model for resilient probing, caching, and explicit failure messages |
| `https://www.cmux.dev/docs/api` | Official current cmux API contract | Source of truth for env vars, access modes, `identify`, `capabilities`, `ping`, workspace listing, and sidebar commands |

### Supporting
| Module | Purpose | When To Use |
|--------|---------|-------------|
| `src/plugin/project-state.js` | Stable project cwd/phase facade | Reuse only if the adapter needs project-root context; do not expand it into cmux state storage |
| `src/plugin/file-watcher.js` | Existing self-write-safe watcher pattern | Reference only; do not couple cmux attachment to planning-file watch churn |
| `src/plugin/idle-validator.js` | Existing idle-time auto-fix flow | Reference only; later phases may emit cmux status from idle outcomes, but Phase 170 should stay transport-only |
| `src/plugin/stuck-detector.js` | Existing warning source for later phases | Reference only |
| `src/plugin/advisory-guardrails.js` | Existing quiet-by-default advisory pattern | Reuse its quiet/logged suppression style, not its implementation |
| `src/commands/workspace.js` | Existing path normalization and JJ workspace-root ideas | Useful for exact-path proof semantics, but do not import CJS command code directly into plugin ESM |
| `src/lib/jj-workspace.js` | JJ workspace inspection logic | Out of scope for cmux targeting; only a reminder that workspace recovery is already CLI-side |

### cmux facts that matter for planning
- `CMUX_WORKSPACE_ID` and `CMUX_SURFACE_ID` are auto-set in managed cmux terminals.
- `ping` proves cmux is responsive, but not that the caller can target the correct workspace.
- `capabilities --json` exposes available methods and current access mode.
- Access mode defaults to `cmux processes only`; `allowAll` is required for most alongside, non-managed callers.
- Global targeting flags exist for CLI commands: `--workspace`, `--surface`, `--window`, and `--json`.
- `sidebar-state --workspace <id>` exposes sidebar metadata including `cwd`, making exact cwd-based fallback targeting possible.
- `set-status`, `clear-status`, `set-progress`, `clear-progress`, and `log` are workspace-targeted sidebar writes. For Phase 170 they are transport/proof primitives, not the shipped UX surface.

## Architecture Patterns

### Recommended Project Structure
- Add a new plugin-local module such as `src/plugin/cmux-cli.js` to resolve and run the `cmux` CLI with JSON output, structured errors, and optional target flags.
- Add a second module such as `src/plugin/cmux-targeting.js` to own environment classification, exact workspace proof, write-path proof, and suppression reasons.
- Extend `src/plugin/index.js` to initialize the adapter once per plugin session and expose an inert no-op adapter when proof fails.
- Do not thread cmux logic into `src/plugin/project-state.js`, `src/plugin/file-watcher.js`, `src/plugin/idle-validator.js`, `src/plugin/stuck-detector.js`, or `src/plugin/advisory-guardrails.js` yet. Those stay event sources for later phases.
- Keep any JJ/cwd comparison helper plugin-local unless there is a clear need to share it with CLI CJS code in the same phase.

### Pattern 1: Detect, Then Prove, Then Attach
Use a three-step gate:
1. `detect`: CLI exists, `ping` succeeds, `capabilities` are readable, and required sidebar methods are available.
2. `prove-target`: exactly one workspace is proven either by managed-terminal env plus `identify`, or by exact cwd match via `sidebar-state` in compatibility mode.
3. `prove-write-path`: perform a reversible targeted sidebar write probe for that exact workspace, then cache the result for the session.

If any step fails, return a suppressed/no-op adapter with a machine-readable reason.

### Pattern 2: Managed-Terminal Proof Is the Gold Path
Prefer this proof chain:
- `CMUX_WORKSPACE_ID` present
- `CMUX_SURFACE_ID` present
- `ping` succeeds
- `capabilities` reports access mode not `off`
- `identify --json` returns the same workspace and surface ids as the env

This is the safest Phase 170 path because it depends on signals cmux itself injects into managed terminals.

### Pattern 3: Alongside Proof Must Be Exact And Conservative
Only attempt compatibility fallback when all of these are true:
- managed-terminal proof is unavailable
- cmux is reachable
- access mode allows the caller (`allowAll` in practice for non-managed callers)
- exact normalized cwd matching produces one and only one workspace candidate

If zero matches, more than one match, or conflicting ids appear, suppress writes. Do not choose a best guess.

### Pattern 4: Session-Sticky Attachment State
Compute attachment once at plugin startup or first cmux use and cache the verdict for the session. Managed-terminal env and access mode normally do not change mid-session, and repeated probing would add noise without meaningfully improving correctness.

### Pattern 5: Inert Adapter Boundary
Later phases should call a uniform adapter API regardless of attachment state. When proof fails, methods like `setStatus`, `clearStatus`, `setProgress`, `clearProgress`, and `log` should be inert no-ops that return a suppressed result instead of throwing.

### Anti-Patterns To Avoid
- Treating `ping` alone as proof of safe targeting
- Attaching when `list-workspaces` returns multiple reachable candidates and proof is incomplete
- Falling back from a conflicting managed-terminal id to cwd heuristics in the same session
- Importing CLI CJS modules directly into plugin ESM to reuse one helper
- Emitting user-facing notifications when cmux attach fails
- Letting later status/progress work decide targeting logic independently instead of reusing one Phase 170 gate

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| cmux reachability | Ad hoc shell strings scattered through plugin hooks | One small `cmux` runner module with structured command results | Keeps fail-open behavior and testability consistent |
| target resolution | Heuristic guessing from project name, git branch, or partial cwd match | Exact env proof first, exact normalized cwd match second, otherwise suppress | This is the only shape that satisfies `CMUX-07` safely |
| access control inference | Custom assumptions about who can call cmux | `capabilities` access mode plus real command success/failure | Official API already defines access mode semantics |
| write safety | Assuming a targetable workspace is also writable | A reversible targeted write probe before attachment is marked usable | The phase's proof gate explicitly requires reachable write path proof |
| plugin integration | Touching every existing plugin subsystem now | A single inert adapter boundary in `src/plugin/index.js` | Keeps Phase 170 small and makes later phases additive |
| shared workspace helpers | Pulling `src/commands/workspace.js` into plugin | Recreate only the exact path-normalization and JJ-root logic needed in plugin ESM | Avoids cross-module format and runtime coupling |

## Common Pitfalls

### Pitfall 1: Confusing "reachable cmux" with "safe target"
**What goes wrong:** `ping` and `list-workspaces` work, so the plugin assumes attachment is safe.
**Why it happens:** The environment feels healthy, and the API is responsive.
**How to avoid it:** Require exact workspace proof before any write-capable state is enabled.
**Warning signs:** Plans mention `ping` and `capabilities` but never mention `identify`, exact cwd match, or ambiguity suppression.

### Pitfall 2: Alongside mode becomes a heuristic trap
**What goes wrong:** The plan tries to make alongside startup "smart" by matching project names, git branches, or nearest paths.
**Why it happens:** Managed-terminal env is unavailable outside cmux-managed shells.
**How to avoid it:** Keep alongside support compatibility-only and exact-match only.
**Warning signs:** Any fallback based on substring paths, branch names, or choosing the first reachable workspace.

### Pitfall 3: Access mode is ignored
**What goes wrong:** The plugin keeps trying writes from a non-managed process while cmux is in `cmux processes only` mode.
**Why it happens:** The CLI is installed and `ping` works locally, so it looks usable.
**How to avoid it:** Read `capabilities` and treat non-managed callers in `cmux processes only` as suppressed unless managed-terminal proof exists.
**Warning signs:** Plans that describe alongside support without mentioning `allowAll`.

### Pitfall 4: Write-path proof creates visible churn
**What goes wrong:** The proof mechanism uses normal sidebar updates that users see as flicker or noise.
**Why it happens:** A real write is the easiest way to prove reachability.
**How to avoid it:** Use a reserved reversible probe key, perform the probe once per session, clear immediately, and keep the behavior behind the attachment gate only.
**Warning signs:** Repeated probes on every event or using log/notification commands as the proof mechanism.

### Pitfall 5: Existing plugin systems get prematurely cmux-aware
**What goes wrong:** `idle-validator`, `stuck-detector`, or `notification` starts owning cmux concerns before the transport layer is stable.
**Why it happens:** Those modules already emit the kinds of signals later phases will mirror.
**How to avoid it:** Keep Phase 170 focused on attachment state and no-op transport only.
**Warning signs:** Plans that touch five or more existing plugin subsystems for this phase.

### Pitfall 6: CJS/ESM reuse pressure expands scope
**What goes wrong:** The phase grows because plugin code tries to share too much with `src/commands/workspace.js` or `src/lib/jj-workspace.js`.
**Why it happens:** Those files already contain useful workspace-path logic.
**How to avoid it:** Reuse only the behavior pattern; if sharing is needed, extract a tiny neutral helper, not the command modules.
**Warning signs:** Planning tasks about refactoring all workspace code into one shared package.

## Code Examples

Verified patterns from current project code and official cmux docs.

### Recommended targeting verdict shape
```javascript
{
  available: true,
  attached: false,
  workspaceId: null,
  surfaceId: null,
  mode: 'managed' | 'alongside' | 'none',
  suppressionReason: 'missing-env' | 'ambiguous-cwd' | 'access-mode-blocked' | 'write-probe-failed' | null,
  writeProven: false,
}
```

### Managed-terminal proof flow
```javascript
const workspaceId = process.env.CMUX_WORKSPACE_ID;
const surfaceId = process.env.CMUX_SURFACE_ID;

if (!workspaceId || !surfaceId) return suppress('missing-env');

const caps = await cmux.json(['capabilities', '--json']);
if (!caps.ok || caps.result?.access_mode === 'off') return suppress('access-mode-blocked');

const identify = await cmux.json(['identify', '--json']);
if (!identify.ok) return suppress('identify-failed');

if (identify.result?.workspace?.id !== workspaceId) return suppress('workspace-mismatch');
if (identify.result?.surface?.id !== surfaceId) return suppress('surface-mismatch');

return proveWritePath(workspaceId);
```

### Compatibility-only alongside proof
```javascript
const workspaces = await cmux.json(['list-workspaces', '--json']);
const matches = [];

for (const workspace of workspaces.result?.workspaces || []) {
  const sidebar = await cmux.json(['sidebar-state', '--json', '--workspace', workspace.id]);
  if (!sidebar.ok) continue;
  if (normalizePath(sidebar.result?.cwd) === normalizePath(projectRoot)) {
    matches.push(workspace.id);
  }
}

if (matches.length !== 1) return suppress('ambiguous-cwd');
return proveWritePath(matches[0]);
```

### Reversible write-path proof
```javascript
const probeKey = `bgsd-target-probe-${process.pid}`;

await cmux.run(['set-status', probeKey, 'sync', '--workspace', workspaceId]);
const sidebar = await cmux.json(['sidebar-state', '--json', '--workspace', workspaceId]);
await cmux.run(['clear-status', probeKey, '--workspace', workspaceId]);

const visible = (sidebar.result?.status || []).some((entry) => entry.key === probeKey);
if (!visible) return suppress('write-probe-failed');

return attach(workspaceId);
```

## Recommended Plan Slices

### Slice 1: Add a plugin-local cmux runner and targeting verdict contract
**Goal:** Create the narrow transport and result shape every later slice can depend on.

Likely modules:
- new `src/plugin/cmux-cli.js`
- new `src/plugin/cmux-targeting.js`
- `src/plugin/index.js`

Likely tests:
- new `tests/plugin-cmux-targeting.test.cjs`
- extend `tests/plugin.test.cjs`

Done when:
- cmux CLI presence, `ping`, `capabilities`, JSON parsing, and suppression reasons are covered.
- plugin startup can hold an inert adapter without changing non-cmux behavior.

### Slice 2: Implement exact workspace proof with managed-terminal-first and conservative alongside fallback
**Goal:** Prove exactly one target workspace or suppress.

Likely modules:
- `src/plugin/cmux-targeting.js`
- `src/plugin/index.js`
- optionally a tiny new path helper if exact cwd normalization or JJ workspace-root lookup is needed

Reference-only modules:
- `src/commands/workspace.js`
- `src/lib/jj-workspace.js`

Likely tests:
- managed env id matches `identify`
- managed env id mismatch suppresses
- unique exact cwd match in `allowAll` attaches
- zero matches suppress
- multiple matches suppress
- managed proof conflict does not fall back to alongside heuristics

Done when:
- the adapter can only produce one exact workspace target or an explicit suppression reason.

### Slice 3: Add reversible write-path proof and inert write methods for later phases
**Goal:** Finish the strict attachment gate without shipping the later UX policy.

Likely modules:
- `src/plugin/cmux-targeting.js`
- `src/plugin/index.js`
- possibly `src/plugin/logger.js` or `src/plugin/debug-contract.js` only if extra suppression diagnostics are needed

Likely tests:
- write probe success marks adapter attached
- write probe failure suppresses silently
- probe is targeted with `--workspace`
- probe runs once per session, not on every event
- non-cmux plugin tool flows remain unchanged (`tests/plugin-progress-contract.test.cjs` should stay green)

Done when:
- the adapter exposes inert `setStatus`/`clearStatus`/`setProgress`/`clearProgress`/`log` methods that later phases can call safely.

## Verification Targets

### Must-prove behaviors
- Starting OpenCode inside a managed cmux terminal with matching `CMUX_WORKSPACE_ID` and `CMUX_SURFACE_ID` produces one attached workspace target.
- A non-cmux session produces a suppressed adapter and no user-visible behavior change.
- An unreachable cmux CLI or socket produces a suppressed adapter and no thrown plugin errors.
- Multiple reachable workspaces with no exact proof produce suppression, not best-guess attachment.
- A conflicting managed-terminal id and cwd match still suppresses; env proof wins over heuristics.
- Attachment is not considered usable until the reversible targeted write probe succeeds.

### Regression surfaces that should likely change
- `src/plugin/index.js` and `tests/plugin.test.cjs` for plugin composition and fail-open behavior
- new `src/plugin/cmux-cli.js` / `src/plugin/cmux-targeting.js` plus new focused tests

### Regression surfaces that should likely stay mostly unchanged
- `src/plugin/project-state.js`
- `src/plugin/notification.js`
- `src/plugin/file-watcher.js`
- `src/plugin/idle-validator.js`
- `src/plugin/stuck-detector.js`
- `src/plugin/advisory-guardrails.js`
- `tests/workspace.test.cjs`

If planning expects broad changes in those modules, the phase is probably over-scoped.

## Open Planning Risks

- The official docs define the commands and flags, but they do not specify the exact JSON payload shapes for `identify`, `capabilities`, `list-workspaces`, or `sidebar-state`. The plan should budget one thin discovery/test step to lock the real JSON field names before implementation hardens around them.
- Write-path proof likely requires a reversible sidebar write. That is the right safety model, but the plan should explicitly account for one-time probe visibility/flicker risk and keep the probe key reserved and immediately cleared.
- Exact alongside fallback depends on `sidebar-state` returning a reliable `cwd` and on that cwd being unique after normalization. If real cmux output is looser than the docs imply, the safe answer is to suppress alongside attachment rather than expand heuristics.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/170-cmux-workspace-detection-safe-targeting/170-CONTEXT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/MILESTONE-INTENT.md`
- `.planning/research/CMUX-FIRST-UX-PRD.md`
- `.planning/research/CMUX-FIRST-UX-BACKLOG.md`
- `src/plugin/index.js`
- `src/plugin/project-state.js`
- `src/plugin/notification.js`
- `src/plugin/cli-path.js`
- `src/plugin/node-runtime.js`
- `src/plugin/file-watcher.js`
- `src/plugin/idle-validator.js`
- `src/plugin/stuck-detector.js`
- `src/plugin/advisory-guardrails.js`
- `src/commands/workspace.js`
- `src/lib/jj-workspace.js`
- `tests/plugin.test.cjs`
- `tests/workspace.test.cjs`
- `tests/plugin-progress-contract.test.cjs`
- Official cmux API docs: `https://www.cmux.dev/docs/api`

### Secondary (MEDIUM confidence)
- Existing plugin patterns inferred from `src/plugin/tool-availability.js` and `src/plugin/tools/bgsd-progress.js`

## Metadata

**Confidence breakdown:** plugin integration boundaries: HIGH. Managed-terminal-first proof model: HIGH. Access-mode implications for alongside support: HIGH. Real cmux JSON field names: MEDIUM until captured in tests. Probe visibility risk: MEDIUM.

**Research date:** 2026-03-31

**Valid until:** 2026-04-30 or until cmux changes its CLI/API targeting contract.
