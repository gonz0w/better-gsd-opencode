# Codebase Concerns

**Analysis Date:** 2026-04-06

## Tech Debt

### Scaffold Template Markers

**Location:** `src/commands/scaffold.js` (lines 198-524), `src/lib/scaffold.js` (lines 105-131)

**Issue:** Extensive use of TODO markers as LLM fill templates in scaffold generation. While intentional for the data/judgment separation pattern, this creates a large surface area of placeholder text that must be maintained and kept consistent with actual template usage.

**Files:**
- `src/commands/scaffold.js` - 40+ TODO markers (lines 267-524)
- `src/lib/scaffold.js` - 3 TODO checks for detecting filled sections (lines 105-131)

**Impact:** High maintenance burden. Any template change requires updating both the scaffold generator and all verification tests that check for these markers.

**Fix approach:** Document the intentional use of TODO markers as a design pattern rather than tech debt. Consider creating a constant file for marker strings to centralize management.

### Console Logging in CLI Output

**Location:** `src/commands/skills.js` (24 console statements), `src/commands/agent.js` (5 console statements)

**Issue:** Heavy use of `console.log()` for CLI output throughout command implementations. While appropriate for user-facing messages, this pattern is inconsistent with error handling which uses `console.error()`.

**Files:**
- `src/commands/skills.js` - 24 console statements (lines 269-920)
- `src/commands/agent.js` - 5 console statements (lines 927-1172)
- `src/commands/runtime.js` - 4 console statements (lines 57-179)

**Impact:** No blocking issues, but creates inconsistency in output handling. Debug-style logging could accidentally be left in production code.

**Fix approach:** Establish a logging convention: use `console.log()` for user-facing CLI output, `console.error()` for errors and warnings. Consider creating a simple logger wrapper for consistency.

## Known Bugs

### None Detected

No known bugs identified during this analysis. The codebase appears stable with no obvious runtime issues.

## Security Considerations

### Skill Installation Validation

**Location:** `src/commands/skills.js` (lines 406-823)

**Risk:** Skills are installed from external sources with pattern validation. While dangerous patterns are checked before installation, the validation logic itself could have gaps.

**Current mitigation:** Pattern-based scanning blocks installation of files matching dangerous signatures (lines 722-768).

**Recommendations:**
1. Consider adding a whitelist approach for allowed file types in skills
2. Add logging for blocked installations to track attempted malicious installs
3. Document the exact patterns being checked for audit purposes

### Git Diff Execution Without Timeout

**Location:** `src/lib/review/readiness.js` (lines 154-171)

**Risk:** `execGit()` calls for diff operations could hang on large repositories or corrupted git state without explicit timeout handling.

**Current mitigation:** The `runNpmScript()` function uses a 120-second timeout, but `evaluateTodoDiff()` does not propagate this protection.

**Recommendations:**
1. Add timeout parameter to `execGit()` calls in diff evaluation functions
2. Handle git errors more gracefully with specific error messages for common failure modes

## Performance Bottlenecks

### File System Scanning in Report Discovery

**Location:** `src/lib/review/readiness.js` (lines 88-104)

**Problem:** The `findReportPath()` function performs recursive directory scanning to locate report files, which could be slow on large workspaces with many phase directories.

**Cause:** Iterates through all phase directories and checks for multiple candidate filenames per directory.

**Improvement path:**
1. Cache the result of report discovery based on `.planning/phases/` modification time
2. Consider using a manifest file that tracks known report locations
3. Add early-exit logic if common report paths are found first

### JSON Parsing Without Error Boundaries

**Location:** `src/lib/review/readiness.js` (lines 38-44, 106-116)

**Problem:** Multiple functions parse JSON with try/catch that silently returns null, potentially masking corruption issues.

**Impact:** Silent failures make it harder to detect when report files become corrupted or malformed.

**Improvement path:**
1. Log warnings when JSON parsing fails for expected report files
2. Add validation schema checking before parsing (e.g., verify file structure exists)
3. Consider using a JSON parser with better error messages

## Fragile Areas

### Report Format Assumptions

**Location:** `src/lib/review/readiness.js` (lines 106-116, 118-151)

**Files:** `src/lib/review/readiness.js`

**Why fragile:** The `extractOpenFindingCount()` function assumes specific JSON structures in review/security reports. If report formats change or add new fields, the extraction logic may fail silently.

**Test coverage:** Tests verify basic functionality but don't cover all possible report format variations.

**Mitigation:** Add integration tests with sample report files covering various formats to ensure robustness.

### Git Diff Parsing Dependencies

**Location:** `src/lib/review/readiness.js` (lines 153-172)

**Files:** `src/lib/review/readiness.js`

**Why fragile:** The TODO detection relies on parsing git diff output with regex patterns. Changes to git configuration or diff format could break the detection logic.

**Test coverage:** Tests exist but may not cover all edge cases (e.g., binary files, large diffs, special characters).

## Dependencies at Risk

### No External Runtime Dependencies

The CLI tool (`bin/bgsd-tools.cjs`) is a single-file Node.js application with zero runtime dependencies beyond the standard library. This is a strength rather than a concern.

### Development Dependencies

**Location:** `package.json`

**Risk:** The project has 179 packages in `node_modules`. While most are development/testing tools, any security vulnerabilities in these should be monitored via regular audits.

**Migration plan:** Run `npm audit` regularly and update dependencies quarterly. Consider using `npm audit fix` for non-breaking updates.

## Test Coverage Gaps

### Error Handling Paths

**Untested area:** Many functions have try/catch blocks but the error paths are not explicitly tested.

**What's not tested:**
- JSON parsing failures in report files (`readJson()`)
- Git command failures beyond exit code checks (`evaluateTodoDiff()`, `evaluateChangelog()`)
- Edge cases in diff parsing (empty diffs, binary files, special characters)

**Risk:** Silent failures could mask underlying issues when reports are corrupted or git state is unusual.

**Priority:** Medium - these are defensive patterns that work but lack explicit verification.

### Report Format Variations

**Untested area:** The `extractOpenFindingCount()` function supports multiple report formats, but not all variations are tested.

**What's not tested:**
- Reports with nested summary structures
- Reports using non-standard field names
- Empty or partially populated reports

**Risk:** New report formats from security tools may not be properly parsed, leading to false pass/fail results.

**Priority:** High - incorrect readiness assessment could allow problematic code through review gates.

---

*Concerns audit: 2026-04-06*
