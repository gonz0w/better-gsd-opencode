<overview>
Anti-pattern detection rules for TDD execution. Used by `tdd detect-antipattern` CLI command and by the executor during RED/GREEN/REFACTOR phases.

These patterns indicate violations of TDD discipline. The detect-antipattern command checks for them automatically; the executor should also be aware of them for self-monitoring.
</overview>

<antipattern name="pre-test-code">
## 1. Pre-Test Code (RED Phase Violation)

**Pattern:** Source files (non-test, non-config) modified before RED gate passes.

**Why it's bad:** Defeats the purpose of TDD. If you write implementation before defining behavior via a test, you're not doing test-driven development — you're doing test-after development. The test won't meaningfully drive your design because the design already exists.

**When detected:** `tdd detect-antipattern --phase red` checks the file list for non-test file modifications.

**Detection rule:** Any file not matching `*.test.*`, `*.spec.*`, `__tests__/*`, `tests/*`, or config files (`*.config.*`, `package.json`, `tsconfig.json`) modified during RED phase.

**Fix:**
1. Delete the implementation code
2. Write the test first — describe what the code should do
3. Verify the test fails (RED gate)
4. Only then write the implementation (GREEN phase)

**Severity:** Blocking — STOP and fix before proceeding through the RED gate.
</antipattern>

<antipattern name="yagni-violations">
## 2. YAGNI Violations (GREEN Phase)

**Pattern:** Implementation code far exceeds what the tests require. Heuristic: implementation LOC > 5× test LOC.

**Why it's bad:** TDD GREEN means "minimal code to pass the test." Extra code is untested code that's likely wrong, adds maintenance burden, and obscures the code that actually matters. If you need the extra code, write a test for it first — that's the whole point of TDD.

**When detected:** `tdd detect-antipattern --phase green` compares implementation LOC to test LOC.

**Detection rule:** If modified implementation file line count exceeds 5× the test file line count, flag for review.

**Fix:**
1. Remove code that isn't exercised by any test
2. If you need the removed functionality, start a new RED phase for it
3. Keep GREEN implementations as small as possible

**Severity:** Warning — review and justify, or remove excess code.
</antipattern>

<antipattern name="over-mocking">
## 3. Over-Mocking

**Pattern:** More than 5 mock/stub calls in a single test file.

**Why it's bad:** Tests become brittle — they break when implementation details change, even if behavior is correct. Over-mocked tests test the mocking framework, not your code. They also hide integration bugs because the real code paths aren't exercised.

**When detected:** `tdd detect-antipattern` counts mock patterns in test files.

**Detection rule:** Count occurrences of `jest.mock`, `vi.mock`, `sinon.stub`, `sinon.mock`, `.mockImplementation`, `.mockReturnValue`, `jest.spyOn`, `vi.spyOn`, and similar patterns. If count > 5 in a single test file, flag.

**Fix:**
1. Test with real implementations wherever possible
2. Mock only external services (HTTP APIs, databases, file system I/O)
3. If you need many mocks, your code may have too many dependencies — consider refactoring the implementation
4. Prefer dependency injection over mocking — pass the real thing in tests

**Severity:** Warning — review mock necessity. Acceptable if testing code with many external dependencies.
</antipattern>

<antipattern name="test-modification-in-green">
## 4. Test Modification in GREEN Phase

**Pattern:** Test file changed during GREEN phase.

**Why it's bad:** The test defines the contract; the implementation fulfills it. Modifying the test during GREEN is "moving the goalposts" — you're changing what success looks like to match what you built, instead of building what the test requires.

**When detected:** `tdd detect-antipattern --phase green` checks the file list for test file modifications.

**Detection rule:** Any file matching `*.test.*`, `*.spec.*`, `__tests__/*`, or `tests/*` modified during GREEN phase.

**Exception:** Fixing a genuine test bug (typo in expected value, wrong assertion method, incorrect import). This must be documented as a deviation (Rule 1 - Bug).

**Fix:**
1. Revert test changes
2. Make the implementation match the original test expectations
3. If the test truly has a bug: fix it, document as deviation, then continue GREEN

**Severity:** Blocking — STOP and investigate. Either revert test changes or document the exception.
</antipattern>

<antipattern name="implementation-before-test">
## 5. Implementation Before Test (Any Phase)

**Pattern:** Implementation file has uncommitted changes when entering RED phase.

**Why it's bad:** Starting RED with existing implementation means you might write tests that pass immediately — you're verifying what exists instead of driving new behavior. The test can't tell you if the design is good because the design was already decided without test feedback.

**When detected:** Check `git status` for source file changes at RED phase entry.

**Detection rule:** At the start of RED phase, if `git status --short` shows modifications to the implementation file specified in `<feature><files>`, flag as violation.

**Fix:**
1. Stash existing implementation changes: `git stash`
2. Write the test from scratch based on `<behavior>` specification
3. Verify the test fails (it should, since implementation is stashed)
4. Unstash and adjust in GREEN: `git stash pop`
5. Or: commit existing work as a separate non-TDD task, then start fresh TDD cycle

**Severity:** Warning — stash or commit existing work before starting TDD cycle.
</antipattern>

<summary_table>
## Quick Reference

| # | Anti-Pattern | Phase | Severity | Detection |
|---|-------------|-------|----------|-----------|
| 1 | Pre-test code | RED | Blocking | Non-test files modified |
| 2 | YAGNI violations | GREEN | Warning | Impl LOC > 5× test LOC |
| 3 | Over-mocking | Any | Warning | >5 mock calls per test file |
| 4 | Test modification in GREEN | GREEN | Blocking | Test files modified |
| 5 | Implementation before test | RED entry | Warning | Uncommitted impl changes |
</summary_table>
