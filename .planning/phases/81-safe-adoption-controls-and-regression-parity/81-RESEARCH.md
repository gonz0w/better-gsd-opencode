# Phase 81: Safe Adoption Controls and Regression Parity - Research

**Researched:** 2026-03-10
**Domain:** Configuration Management, Backward Compatibility, Testing Infrastructure
**Confidence:** HIGH

## Summary

Phase 81 consolidates safety controls for dependency-backed optimizations delivered in Phases 77-80. The phase ensures each optimization (valibot validation, optimized discovery, compile-cache, SQLite statement caching) can be toggled independently, maintains backward compatibility with existing `.planning/` artifacts, and provides validation infrastructure for parity checking.

**Primary recommendation:** Implement a unified flags registry in CONFIG_SCHEMA that exposes all dependency-backed optimizations as first-class config options, with environment variable fallbacks, and expand the existing diagnoseParity pattern into a general `bgsd-tools util:parity-check` command.

---

## Phase Requirements

### SAFE-01: Independent Toggle Control
Maintainer can toggle each dependency-backed optimization independently using explicit config/env flags.

**Current State:**
- `BGSD_DEP_VALIBOT` / `BGSD_DEP_VALIBOT_FALLBACK` — validation engine toggle (flags.js:20-21)
- `BGSD_DISCOVERY_MODE=legacy|optimized` — file discovery toggle (discovery.js:10)
- `BGSD_COMPILE_CACHE=0|1` — compile-cache toggle (runtime-capabilities.js:91)
- `BGSD_SQLITE_STATEMENT_CACHE=0|1` — statement cache toggle (cache.js:46)

**Gap:** No unified registry; each flag is ad-hoc. Users cannot discover all toggles in one place.

### SAFE-02: Backward Compatibility for .planning/ Artifacts
User can rely on backward compatibility for existing `.planning/` artifacts after dependency migrations.

**Current State:**
- Parser implementations in `src/plugin/parsers/` accept both old and new formats
- Phase 77 ensured valibot/zod fallback preserves output contracts
- Phase 78 verified discovery outputs match legacy behavior

**Gap:** No explicit backward-compatibility contract in config/schema. Need formal guarantee.

### SAFE-03: Parity Validation Infrastructure
Maintainer can validate each dependency adoption with parity checks and no functional regressions in core flows.

**Current State:**
- `discovery.diagnoseParity()` in discovery.js:424-458 provides structured mismatch detection
- Test suite validates core flows via `npm test`

**Gap:** No general-purpose parity-check command; each optimization validates differently or not at all.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js env vars | N/A | Toggle flags | Universal mechanism across all optimizations |
| CONFIG_SCHEMA | N/A | Config registry | Single source of truth for user-facing options |
| node:sqlite | v22.5+ | Statement caching | Built-in, no external deps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| normalizeFlag() | flags.js:4-17 | Flag parsing | Consistent boolean interpretation |
| diagnoseParity() | discovery.js:424 | Mismatch detection | Foundation for generalized parity |
| runtime-capabilities.js | N/A | Capability detection | Graceful fallback on older runtimes |

---

## Architecture Patterns

### Recommended: Unified Flags Registry

Extend CONFIG_SCHEMA in `src/lib/constants.js` with an `optimizations` section:

```javascript
const CONFIG_SCHEMA = {
  // ... existing fields ...
  
  // ─── Dependency-Backed Optimizations ───
  optimization: {
    valibot:           { type: 'boolean', default: true,  env: 'BGSD_DEP_VALIBOT', description: 'Use valibot for schema validation' },
    valibot_fallback: { type: 'boolean', default: false, env: 'BGSD_DEP_VALIBOT_FALLBACK', description: 'Force zod fallback for validation' },
    discovery:         { type: 'string',  default: 'optimized', env: 'BGSD_DISCOVERY_MODE', values: ['optimized', 'legacy'], description: 'File discovery mode' },
    compile_cache:     { type: 'boolean', default: false, env: 'BGSD_COMPILE_CACHE', description: 'Enable Node.js compile-cache' },
    sqlite_cache:     { type: 'boolean', default: true,  env: 'BGSD_SQLITE_STATEMENT_CACHE', description: 'SQLite statement caching' },
  },
};
```

### Anti-Patterns to Avoid
- Hardcoding flags in multiple places — use single registry
- Assuming runtime capability without checking — always fallback
- Breaking existing `.planning/` contracts — maintain parser parity

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flag parsing | Custom normalization | normalizeFlag() from flags.js | Already handles 1/0/true/false/yes/no/on/off |
| Capability detection | Ad-hoc version checks | runtime-capabilities.js | Centralized Node version logic |
| Parity checking | Per-feature implementations | Extend diagnoseParity() | Proven pattern from Phase 78 |

---

## Common Pitfalls

### Pitfall 1: Inconsistent Flag Defaults
**What goes wrong:** Different defaults per optimization cause unpredictable behavior.
**Why it happens:** Each optimization added independently with different defaults.
**How to avoid:** Centralize in CONFIG_SCHEMA with documented defaults.
**Warning signs:** Users report "it worked before" after upgrading.

### Pitfall 2: Missing Fallback Paths
**What goes wrong:** Optimization fails on older runtime with no graceful degradation.
**Why it happens:** Runtime capability not checked before enabling optimization.
**How to avoid:** Follow Phase 79 pattern — check capability, default to safe path.
**Warning signs:** Errors on Node <22.5 for SQLite features.

### Pitfall 3: Parser Drift
**What goes wrong:** New parser accepts format that old parser rejected, or vice versa.
**Why it happens:** Separate validation paths without parity testing.
**How to avoid:** Run both parsers on same input during development; verify outputs match.

---

## Code Examples

### Example 1: Reading Unified Optimization Flags

```javascript
import { CONFIG_SCHEMA } from './lib/constants.js';

function getOptimizationFlag(key, env = process.env) {
  const def = CONFIG_SCHEMA.optimization?.[key];
  if (!def) return null;
  
  // Check env var first
  if (env[def.env] !== undefined) {
    return normalizeFlag(env[def.env]);
  }
  return def.default;
}
```

### Example 2: Generalized Parity Check Command

```javascript
// New command: bgsd-tools util:parity-check [--optimization <name>]
// Outputs: { valibot: { match: true }, discovery: { match: true, onlyLegacy: [], onlyOptimized: [] }, ... }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc env flags | CONFIG_SCHEMA with optimization section | This phase | Single source of truth |
| No parity command | diagnoseParity() generalized | This phase | Validates all optimizations |
| Per-feature fallback | Unified capability detection | Phases 77-80 | Consistent behavior |

---

## Open Questions

1. **Q:** Should optimization flags be in `.planning/config.json` or only env vars?
   - **A:** Both — env var for runtime override, config for persistent preference

2. **Q:** How to test backward compatibility of `.planning/` artifacts?
   - **A:** Add integration test that parses all artifact types with both old and new parsers

3. **Q:** Should parity checks run automatically on every execution?
   - **A:** No — too expensive. Run on-demand via `bgsd-tools util:parity-check` or explicit `/bgsd-validate-deps`

---

## Sources

### Primary (HIGH confidence)
- `src/lib/constants.js` — CONFIG_SCHEMA structure
- `src/plugin/validation/flags.js` — normalizeFlag implementation
- `src/lib/adapters/discovery.js` — diagnoseParity implementation (lines 424-458)
- `src/lib/runtime-capabilities.js` — capability detection pattern

### Secondary (MEDIUM confidence)
- Phase 78 RESEARCH.md — discovery optimization context
- Phase 80 RESEARCH.md — SQLite statement cache context

### Tertiary (LOW confidence)
- Node.js documentation for statement caching APIs

---

## Metadata

**Confidence breakdown:** HIGH for current state analysis, MEDIUM for recommended patterns
**Research date:** 2026-03-10
**Valid until:** Phase 81 completion
