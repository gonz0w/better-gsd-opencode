---
phase: 78-file-discovery-and-ignore-optimization
plan: 01
subsystem: infra
tags: [discovery, fast-glob, ignore, codebase-intel, repo-map]

# Dependency graph
requires: []
provides:
  - "Dual-path discovery adapter with legacy and optimized engines"
  - "In-process gitignore matching and fast-glob traversal for discovery"
  - "Adapter-backed discovery wiring in codebase analysis and repo-map generation"
affects: [codebase-analysis, repo-map, scan-performance]

# Tech tracking
tech-stack:
  added: [fast-glob, ignore]
  patterns: [adapter-seam, legacy-default-cutover, shadow-compare]

key-files:
  created: [src/lib/adapters/discovery.js]
  modified: [package.json, package-lock.json, src/lib/codebase-intel.js, src/lib/ast.js]

key-decisions:
  - "Kept legacy discovery as default, with optimized traversal gated by adapter mode"
  - "Added shadow-compare hooks so optimized parity can be validated before cutover"

patterns-established:
  - "Discovery callers use adapter APIs instead of direct traversal internals"
  - "Optimized traversal performs ignore matching in-process without git subprocesses"

requirements-completed: [SCAN-01, SCAN-02, SCAN-03]
one-liner: "Discovery now runs through a dual-path adapter that supports fast-glob traversal and in-process ignore matching while preserving legacy output contracts by default."

# Metrics
duration: 6 min
completed: 2026-03-10
---

# Phase 78 Plan 01: File Discovery Adapter Summary

**Discovery now runs through a dual-path adapter that supports fast-glob traversal and in-process ignore matching while preserving legacy output contracts by default.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-10T02:20:28Z
- **Completed:** 2026-03-10T02:26:31Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added `fast-glob` and `ignore` dependencies and created a dedicated discovery adapter seam.
- Implemented optimized source-dir detection and file traversal with in-process `.gitignore` matching.
- Migrated `codebase-intel` and repo-map discovery hotspots to call the adapter while keeping legacy-safe defaults.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add optimized discovery dependencies and adapter module scaffold** - `6ce8be7` (feat)
2. **Task 2: Implement in-process ignore matching and fast traversal in adapter** - `07dbe03` (feat)
3. **Task 3: Migrate discovery call sites to adapter seam with legacy-safe default** - `307cf07` (refactor)

## Files Created/Modified
- `src/lib/adapters/discovery.js` - Dual-path discovery adapter with legacy/optimized engines and shadow compare support.
- `src/lib/codebase-intel.js` - Discovery APIs now route through adapter-backed calls with parity-safe defaults.
- `src/lib/ast.js` - Repo-map generation now uses adapter discovery helpers.
- `package.json` - Added runtime dependency declarations for discovery acceleration.
- `package-lock.json` - Locked dependency graph including new discovery libraries.

## Decisions Made
- Keep legacy mode as the default runtime behavior to preserve current command contracts.
- Expose `BGSD_DISCOVERY_MODE` and optional shadow comparison in adapter options for controlled rollout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing local install for `ignore` dependency during test execution**
- **Found during:** Task 3 verification
- **Issue:** Tests failed with `MODULE_NOT_FOUND: ignore` after adapter wiring.
- **Fix:** Installed dependencies locally via `npm install` to satisfy runtime imports.
- **Files modified:** None (workspace dependency install only)
- **Verification:** `npm run test:file -- tests/codebase.test.cjs` passed after install
- **Committed in:** `307cf07` (task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep. The fix was required to execute verification for the planned adapter migration.

## Issues Encountered
- `npm test` exhibited unrelated flaky failures in existing test suites (`tests/init.test.cjs`, `tests/intent.test.cjs`, `tests/misc.test.cjs`) due workspace baseline instability; targeted verification for discovery paths and build succeeded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Discovery hotspots are now centralized behind one adapter seam for safe optimized cutover work in Plan 02.
- Optimized engine exists and can be enabled incrementally with parity checks before default switching.

## Self-Check: PASSED
- Verified required summary and adapter files exist.
- Verified all task commit hashes are present in git history.
