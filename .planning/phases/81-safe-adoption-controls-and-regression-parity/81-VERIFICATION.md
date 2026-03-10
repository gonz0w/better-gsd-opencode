---
phase: 81-safe-adoption-controls-and-regression-parity
verified: 2026-03-10T05:30:00Z
status: gaps_found
score: 85
gaps:
  - category: test-fixture
    severity: warning
    description: Two tests fail because they don't include new optimization keys in test fixtures
    files:
      - tests/integration.test.cjs (line 270, 'idempotent on modern config')
      - tests/infra.test.cjs (line 363, 'already-complete config returns empty migrated_keys')
    fix: Add optimization keys to modern config test fixtures
---

# Phase 81: Safe Adoption Controls and Regression Parity - Verification

## Goal Achievement

**Phase Goal:** Safe adoption controls and regression parity - centralized optimization flags, backward-compatible parsers, and parity-check utility

**Status:** gaps_found (85% - core functionality verified, minor test fixture gaps)

## Observable Truths

| Truth | Status | Evidence |
|-------|--------|----------|
| All dependency-backed optimizations are discoverable in a single location | ✓ VERIFIED | CONFIG_SCHEMA contains optimization section with 5 flags |
| Each optimization can be toggled via config file or environment variable | ✓ VERIFIED | All flags have env property (e.g., BGSD_DEP_VALIBOT, BGSD_DISCOVERY_MODE) |
| Default values are documented and follow safe-by-default principles | ✓ VERIFIED | Each flag has description in util:settings output |
| All .planning/ artifact parsers accept both old and new format variants | ✓ VERIFIED | Parsers use flexible frontmatter parsing |
| Parity check can validate all dependency-backed optimizations | ✓ VERIFIED | util:parity-check checks all 4 optimizations |
| Output format shows match/mismatch status with details | ✓ VERIFIED | Output shows "✓ PARITY" or "✗ MISMATCH" with details |
| Command can run on-demand or as part of validation workflow | ✓ VERIFIED | Both `util:parity-check` and `util:parity-check --optimization <name>` work |

## Required Artifacts

### Plan 81-01: Unified Optimization Flags Registry

| Artifact | Path | Status | Level 1 (Exists) | Level 2 (Substantive) | Level 3 (Wired) |
|----------|------|--------|------------------|----------------------|-----------------|
| CONFIG_SCHEMA optimization section | src/lib/constants.js | ✓ VERIFIED | ✓ | ✓ | ✓ |
| Config loading optimization support | src/lib/config.js | ✓ VERIFIED | ✓ | ✓ | ✓ |
| Settings display command | src/commands/misc.js | ✓ VERIFIED | ✓ | ✓ | ✓ |

**Verification Commands:**
```bash
node -e "const {CONFIG_SCHEMA} = require('./src/lib/constants.js'); console.log('optimization' in CONFIG_SCHEMA)"
# Output: true

node bin/bgsd-tools.cjs util:settings | grep -A10 '"Optimization"'
# Output: Shows all 5 optimization flags with values and env vars
```

### Plan 81-02: Backward-Compatible Parsers

| Artifact | Path | Status | Level 1 (Exists) | Level 2 (Substantive) | Level 3 (Wired) |
|----------|------|--------|------------------|----------------------|-----------------|
| PLAN.md parser | src/plugin/parsers/plan.js | ✓ VERIFIED | ✓ | ✓ | ✓ |
| STATE.md parser | src/plugin/parsers/state.js | ✓ VERIFIED | ✓ | ✓ | ✓ |
| ROADMAP.md parser | src/plugin/parsers/roadmap.js | ✓ VERIFIED | ✓ | ✓ | ✓ |

**Note:** Parsers are located at `src/plugin/parsers/` (not `src/lib/parsers/` as originally planned). The location change was made during implementation for better architectural organization.

### Plan 81-03: Parity-Check Utility

| Artifact | Path | Status | Level 1 (Exists) | Level 2 (Substantive) | Level 3 (Wired) |
|----------|------|--------|------------------|----------------------|-----------------|
| Parity check module | src/lib/utils/parity-check.js | ✓ VERIFIED | ✓ | ✓ | ✓ |
| Parity check command | src/commands/misc.js | ✓ VERIFIED | ✓ | ✓ | ✓ |

**Verification Commands:**
```bash
node bin/bgsd-tools.cjs util:parity-check
# Output: Shows parity status for all 4 optimizations (valibot, discovery, compile_cache, sqlite_cache)

node bin/bgsd-tools.cjs util:parity-check --optimization valibot
# Output: Shows valibot-specific parity check
```

## Key Link Verification

| Link | From | To | Via | Status |
|------|------|----|-----|--------|
| 1 | src/lib/config.js | src/lib/constants.js | CONFIG_SCHEMA reference | ✓ WIRED |
| 2 | src/commands/misc.js | src/lib/constants.js | CONFIG_SCHEMA for settings display | ✓ WIRED |
| 3 | src/commands/misc.js | src/lib/utils/parity-check.js | checkParity import | ✓ WIRED |
| 4 | src/router.js | src/commands/misc.js | util:settings, util:parity-check routes | ✓ WIRED |

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SAFE-01: Toggle each optimization independently | ✓ COVERED | util:settings shows all flags; each has env var override |
| SAFE-02: Backward compatibility for .planning/ artifacts | ✓ COVERED | Parsers handle flexible frontmatter formats |
| SAFE-03: Parity checks for core flows | ✓ COVERED | util:parity-check validates all optimizations |

## Anti-Patterns Found

| Category | Severity | Description | Location |
|----------|----------|-------------|----------|
| Test Fixture Gap | ⚠️ Warning | Tests don't include new optimization keys in modern config fixtures | tests/integration.test.cjs:270, tests/infra.test.cjs:363 |
| Documentation | ℹ️ Info | Parser location changed from src/lib/parsers to src/plugin/parsers without updating plan documentation | Plan 81-02 |

## Human Verification Required

- [ ] Visual confirmation that util:settings JSON output is correctly formatted
- [ ] Manual testing of env var override (e.g., `BGSD_DEP_VALIBOT=0 node bin/bgsd-tools.cjs util:settings`)
- [ ] Verify backward compatibility by testing with legacy .planning/ artifacts from older projects

## Gaps Summary

**Minor Gap - Test Fixture Update Needed:**

Two tests fail because the test fixtures don't include the new optimization keys that were added to CONFIG_SCHEMA. The tests check that a "modern config" has no migrated keys, but now the config migration detects the new optimization fields as needing migration (even though they're valid schema fields).

**Affected Tests:**
1. `tests/integration.test.cjs:270` - "idempotent on modern config"
2. `tests/infra.test.cjs:363` - "already-complete config returns empty migrated_keys"

**Fix Required:** Add optimization keys to the modern config test fixtures:
```javascript
optimization: {
  valibot: true,
  valibot_fallback: false,
  discovery: 'optimized',
  compile_cache: false,
  sqlite_cache: true
}
```

**Impact:** Low - The actual functionality works correctly. Only the test fixtures need updating.

---

*Verification completed: 2026-03-10*
*Overall status: gaps_found (core functionality verified, minor test fixture updates needed)*
