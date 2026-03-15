# Plan 03 Summary — Integration Test Suite

**Phase:** 0125-core-tools-integration  
**Plan:** 03  
**Status:** complete  
**Completed:** 2026-03-15

## What Was Built

### Task 1: Config toggles and ripgrep integration tests (24 tests)
Created `tests/cli-tools-integration.test.cjs` with:

**Config toggle tests (9 tests):**
- CONFIG_SCHEMA has tools_ripgrep/fd/jq with boolean type and default true
- Nested section config (`tools.ripgrep`, `tools.fd`, `tools.jq`)
- isToolEnabled returns boolean for all three tools
- isToolEnabled is exported from fallback.js
- withToolFallback goes to fallback for unknown/disabled tools
- isToolEnabled returns false for completely unknown tool

**Ripgrep integration tests (8 tests):**
- Returns { success, usedFallback, result } shape
- Match objects have path, lineNumber, line, offset, _raw properties
- No matches returns empty array (not error) — fixed exit code 1 handling in ripgrep.js
- parseRipgrepJson handles empty/null/undefined input gracefully
- parseRipgrepJson handles valid JSON Lines output
- parseRipgrepJson skips non-match type JSON lines
- maxCount limits results
- ignoreCase flag works

**Output parity tests (4 tests):**
- searchRipgrep result shape identical whether CLI or fallback
- findFiles result shape identical
- transformJson result shape identical

Also fixed a pre-existing bug in `ripgrep.js`: added proper exit code 1 handling (no matches is not an error).

### Task 2: fd, jq, and graceful degradation tests (24 more tests)

**fd integration tests (9 tests):**
- findFiles returns { success, usedFallback, result } shape
- Results are arrays of file path strings
- findByExtension returns only .js files
- findDirectories returns directories
- Results don't include .git or node_modules
- walkSourceFiles returns array of relative paths
- getSourceDirs returns array including 'src'
- Discovery works when fd unavailable (fallback to fast-glob/legacy)

**jq integration tests (11 tests):**
- .key property access, .[0] index access, keys, length
- select() filter works
- pipe chain works  
- compact option returns single-line JSON
- Unknown filter doesn't crash (graceful)
- FILTER_PRESETS has corrected keys mapping ('keys' not '.[]')
- FILTER_PRESETS.values is not '.[]'
- getFilterPresets returns copy of presets

**Graceful degradation tests (4 tests):**
- searchRipgrep returns success: true even on fallback path
- usedFallback is boolean in all tool wrapper results
- No user-visible error messages in fallback path (silent degradation)
- isToolEnabled works without error when config present

## Key Files Modified
- `tests/cli-tools-integration.test.cjs` — 48 integration tests (new file)
- `src/lib/cli-tools/ripgrep.js` — fixed exit code 1 handling for no-match case
- `src/lib/deps.js` — fixed ripgrep pre-filter pattern (non-anchored require match)

## Verification Results
- `npm test`: 1397 tests pass, 0 failures (1350 baseline + 47 new)
- `npm run build`: Build succeeds
- Integration test file exists: `tests/cli-tools-integration.test.cjs`
- 48 tests covering all 4 requirements: TOOL-01, TOOL-02, TOOL-03, TOOL-DEGR-01
- Tests pass regardless of CLI tool availability (self-contained)

## Self-Check: PASSED
All must_haves satisfied:
- Integration tests verify ripgrep, fd, and jq work when tools available ✓
- Integration tests verify graceful fallback when tools unavailable ✓
- Config toggle tests confirm tools_ripgrep=false causes skip ✓
- Output parity tests confirm identical shapes from CLI and fallback paths ✓
- All integration tests pass regardless of installed CLI tools ✓
