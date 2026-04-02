# Phase 181: Workspace Root Truth & Safe Fallback - Research

**Researched:** 2026-04-01
**Domain:** JJ workspace execution proof, workspace-rooted path containment, and safe pre-work fallback
**Confidence:** HIGH

## User Constraints

- Honor the locked proof contract: parallel execution unlocks only when the intended workspace path, executor `cwd` realpath, and `jj workspace root` all match.
- If proof is missing, weak, or unavailable, downgrade to the supported sequential path **before any plan work begins**.
- While workspace mode is active, all repo-relative reads, writes, and plan-local artifacts must resolve through the assigned workspace root.
- Treat all pre-work workspace-proof and workspace-availability failures as one generic fallback case in operator-facing behavior.
- Show the operator the intended workspace, observed executor `cwd`, observed `jj workspace root`, and fallback reason.
- Do not expand scope into broader workspace UX, general multi-user coordination, or removal of sequential fallback.

## Phase Requirements

- **JJ-01:** Operator can run a workspace-targeted plan and prove the executor's working directory matches the intended `jj workspace root`.
- **JJ-03:** System can fall back to the supported sequential path when workspace pinning proof fails or workspace mode is unavailable.

## Summary

Phase 181 should be implemented as a **preflight proof gate**, not as a best-effort routing hint. Official JJ docs confirm that workspaces are real, independent working copies backed by one repo, that `jj workspace root --name <workspace>` is the authoritative way to resolve a workspace root, and that stale working copies are normal cross-workspace behavior. That means the safe contract here is to prove the execution root up front, then allow workspace mode only after runtime evidence agrees.

For this phase, the standard stack is already enough: **JJ CLI + Node stdlib + the existing OpenCode `workdir` spawn surface**. Do not add a JJ SDK, path library, or custom workspace registry. The architecture pattern is: resolve the intended workspace root canonically, spawn into that root, immediately collect proof (`process.cwd()`/realpath + `jj workspace root`), and only then let plan work begin. If any part fails, downgrade to sequential before summaries, artifacts, or repo-relative writes occur.

The main thing people get wrong in this space is trusting requested paths instead of observed paths. `path.resolve()` is not proof; symlinks, subdirectory starts, and advisory-only spawn contracts all weaken trust. The phase should therefore treat **realpath comparison plus authoritative JJ root lookup** as the unlock condition, and treat any mismatch as a normal safe-fallback branch rather than an exceptional crash.

**Primary recommendation:** Implement one reusable pre-work workspace-proof helper that returns `parallel_allowed | fallback_to_sequential` plus evidence, and require all workspace-mode repo-relative path resolution to flow through that proven root.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| JJ CLI | verified locally on `0.39.0` | Workspace creation, authoritative root lookup, stale recovery primitives | Official source of workspace truth; already exposes `workspace add`, `workspace root`, `workspace update-stale` |
| Node.js stdlib (`child_process`, `fs`, `path`, `process`) | repo engine `>=18` | Spawn with `cwd`, resolve canonical paths, read observed working directory | Already in stack; official APIs cover proof and containment needs |
| OpenCode subagent `workdir` spawn contract | current runtime | Requests workspace-targeted execution for spawned agents | Existing runtime surface; phase hardens it with runtime proof rather than trusting the request |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing bGSD workspace helpers (`src/commands/workspace.js`, `src/lib/jj-workspace.js`) | current repo | Managed workspace naming, inventory, recovery inspection | Reuse and extend for proof gathering and fallback routing |
| Existing repo test surface (`node --test`, `npm test`, `npm run build`) | current repo | Focused and broad verification | Use focused tests for proof helpers; broad regression for runtime/orchestration changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JJ CLI | Custom JS JJ wrapper/SDK | Reject: adds abstraction without improving proof authority |
| `fs.realpathSync.native()` canonical comparison | `path.resolve()` only | Reject: resolve normalizes strings but does not prove canonical filesystem target |
| Generic fallback crash/abort | Sequential downgrade before work | Reject abort-only path: violates locked safe fallback requirement |

## Architecture Patterns

### Recommended Project Structure
- Put the proof gate in one reusable runtime helper near existing workspace/orchestration code.
- Reuse that helper from execution entrypoints before any workspace-mode task starts.
- Centralize workspace-rooted path resolution so reads/writes/artifacts all consume the same proven root.

### Pattern 1: Preflight Workspace Proof Gate
1. Resolve the **intended** workspace root with `jj workspace root --name <workspace>` and canonicalize it with `fs.realpathSync.native()`.
2. Spawn the executor with `cwd` set to that intended root.
3. Before plan work starts, collect **observed** evidence from inside the runtime:
   - observed executor `process.cwd()`
   - canonical realpath of that cwd
   - `jj workspace root` from that cwd
4. Compare canonical paths.
5. Only if all three agree, mark `parallel_allowed: true`; otherwise emit a fallback record and switch to sequential.

### Pattern 2: Proven-Root Path Containment
- After proof passes, derive repo-relative paths from the proven workspace root, not from ambient `process.cwd()` elsewhere.
- Route summary/artifact output through a single workspace-root join helper.
- Do not let any workspace-mode code write plan-local outputs until proof status is known.

### Pattern 3: Capability Degrade, Not Error Escalation
- Workspace mode is an optimization path with a proof requirement.
- Missing JJ, missing workspace root, mismatched cwd, subdirectory start, or failed proof all converge to one operator-visible outcome: **fallback to sequential before work**.
- Preserve detailed evidence internally and in operator messaging, but do not split behavior branches unnecessarily.

### Anti-Patterns to Avoid
- Trusting the requested `workdir` without collecting observed runtime evidence.
- Comparing uncanonicalized paths only.
- Allowing a workspace-targeted run to start from a child directory and still count as “proven”.
- Letting repo-relative writes happen before proof completes.
- Building a parallel-only path that blocks supported sequential execution when proof is missing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workspace truth | Custom workspace registry or metadata file | `jj workspace root --name <workspace>` | JJ already owns workspace identity and root resolution |
| Canonical path proof | String normalization-only logic | `fs.realpathSync.native()` | Canonical filesystem target matters for trust |
| Spawn-root trust | Prompt-only or config-only “intended path” evidence | Runtime-observed `process.cwd()` + JJ root check | Requested path is advisory unless proven |
| Stale workspace semantics | Custom stale heuristics | `jj workspace update-stale` and JJ stale model | Official recovery surface already exists |
| Fallback routing | Multiple user-visible failure taxonomies | One generic sequential fallback path with evidence | Matches locked decision and reduces branching |

## Common Pitfalls

### Pitfall 1: Requested path is mistaken for actual execution root
**What goes wrong:** The orchestrator says “run in workspace X”, but the executor actually runs from the parent checkout or a child directory.
**Why it happens:** Spawn APIs often accept `cwd`, but that is not the same as proving the child runtime actually observed and used the intended root.
**How to avoid:** Require post-spawn evidence from inside the runtime before any plan work begins.
**Warning signs:** Artifacts appear under the main checkout; `process.cwd()` and `jj workspace root` disagree; subdirectory starts appear “successful”.

### Pitfall 2: Path comparisons ignore canonicalization
**What goes wrong:** Equivalent-looking paths compare unequal or unsafe-looking paths compare equal incorrectly.
**Why it happens:** `path.resolve()` normalizes strings but does not resolve symlinks to canonical filesystem targets.
**How to avoid:** Canonicalize intended, observed cwd, and observed JJ root with `fs.realpathSync.native()` before comparing.
**Warning signs:** Intermittent mismatches around symlinked base paths or nested invocation points.

### Pitfall 3: Workspace-targeted writes happen before proof status is known
**What goes wrong:** Summary or artifact files are written into the wrong checkout before fallback occurs.
**Why it happens:** Proof logic runs too late, after normal repo-relative helpers already started working.
**How to avoid:** Make proof gate the first runtime step and block path-using helpers behind it.
**Warning signs:** Partial workspace artifacts exist even when the run reports a fallback.

### Pitfall 4: Subdirectory starts are treated as “good enough”
**What goes wrong:** A run launched inside the right workspace but not at the workspace root is treated as fully pinned.
**Why it happens:** Teams conflate “inside correct workspace” with “root-pinned and containment-safe”.
**How to avoid:** Keep the strict triple-match contract; subdirectory start downgrades to sequential.
**Warning signs:** `jj workspace root` matches intended workspace but `process.cwd()` realpath does not.

### Pitfall 5: Fallback is treated as failure instead of safe behavior
**What goes wrong:** Operators see missing workspace proof as a crash or blocked execution.
**Why it happens:** Parallel mode and supported execution get coupled too tightly.
**How to avoid:** Model fallback as the supported path when proof is absent; emit explicit reason and continue sequentially.
**Warning signs:** Run aborts without starting sequential work; operator cannot tell whether work was skipped or safely downgraded.

## Code Examples

Verified patterns from official sources.

### Example 1: Canonical intended root lookup
```js
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

function canonicalWorkspaceRoot(repoCwd, workspaceName) {
  const root = execFileSync('jj', ['workspace', 'root', '--name', workspaceName], {
    cwd: repoCwd,
    encoding: 'utf8',
    stdio: 'pipe',
  }).trim();
  return fs.realpathSync.native(root);
}
```

### Example 2: Pre-work proof contract
```js
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

function collectWorkspaceProof(intendedRoot) {
  const observedCwd = fs.realpathSync.native(process.cwd());
  const observedJjRoot = fs.realpathSync.native(
    execFileSync('jj', ['workspace', 'root'], {
      cwd: intendedRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim()
  );

  return {
    intendedRoot,
    observedCwd,
    observedJjRoot,
    parallelAllowed: intendedRoot === observedCwd && observedCwd === observedJjRoot,
  };
}
```

### Example 3: Safe fallback shape
```js
function chooseExecutionMode(proof) {
  if (proof.parallelAllowed) {
    return { mode: 'workspace-parallel', fallbackReason: null };
  }
  return {
    mode: 'sequential',
    fallbackReason: 'workspace proof missing or mismatched before work start',
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prompt/advisory workspace targeting | Runtime proof gate with observed evidence | Current JJ workspace hardening era / v19.0 milestone direction | Makes “workspace mode” trustworthy instead of descriptive only |
| `path.resolve()`-style normalization as confidence signal | Canonical realpath comparison | Longstanding Node best practice; still current | Avoids symlink/alias ambiguity in root proof |
| Treat stale workspaces as exceptional edge cases | Model stale working copies as normal JJ behavior with explicit recovery | Current JJ docs | Prevents hidden corruption and supports honest fallback/recovery semantics |
| Abort when workspace mode is imperfect | Degrade to sequential before work | Locked phase decision | Preserves supported execution while hardening parallel mode |

## Open Questions

1. Where should the runtime proof helper live so both workflow entrypoints and lower-level path helpers can reuse it without duplicating evidence gathering?
2. What is the smallest shared proof artifact shape that later phases can reuse for reconcile/finalize observability?
3. Should the operator-facing pre-work message be emitted by the CLI command layer, workflow layer, or both?

## Sources

### Primary (HIGH confidence)
- Jujutsu working copy/workspaces docs: https://docs.jj-vcs.dev/latest/working-copy/
- Jujutsu local CLI help verified on `jj 0.39.0`: `jj help workspace root`, `jj help workspace add`, `jj help workspace update-stale`
- Node.js docs via Context7: `/websites/nodejs_latest-v22_x_api` for `child_process.spawn/execFileSync cwd`, `process.cwd()`, `fs.realpathSync.native()`
- OpenCode Agents docs: https://opencode.ai/docs/agents/

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md`
- `.planning/MILESTONE-INTENT.md`
- `.planning/ROADMAP.md`
- `.planning/research/JJ-WORKSPACE-PARALLEL-EXECUTION-BACKLOG.md`
- Existing repo implementation surfaces: `src/commands/workspace.js`, `src/lib/jj-workspace.js`, `workflows/execute-phase.md`

### Tertiary (LOW confidence)
- Brave search results for community-reported stale-working-copy pain points and architecture references

## Metadata

**Confidence breakdown:** HIGH for JJ workspace/root/stale semantics, Node cwd/realpath proof primitives, and the fallback-first architecture recommendation. MEDIUM for exact OpenCode runtime guarantees around subagent `workdir` enforcement, because repo-local backlog evidence says the request may be advisory without additional runtime proof.

**Research date:** 2026-04-01
**Valid until:** Revalidate when upgrading JJ major/minor behavior, changing OpenCode subagent spawn semantics, or redesigning workspace execution entrypoints.
