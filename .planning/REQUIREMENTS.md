# Milestone v11.2 Requirements

**Version:** v11.2
**Name:** Code Cleanup
**Started:** 2026-03-12

## Current Requirements

### Phase 106: Code Cleanup (CLEAN-01 - CLEAN-05)

- [x] **CLEAN-01**: Audit src/ for unused exports — Scan src/ directory for exported functions/variables that are never imported within the codebase
- [x] **CLEAN-02**: Remove verify:orphans — Delete the verify:orphans command and related code (one-time cleanup)
- [x] **CLEAN-03**: Remove test infrastructure from bundle — Strip node:test, test files, and test utilities from the build output
- [x] **CLEAN-04**: Remove performance profiling from bundle — Strip profiler.js, benchmarking code from the build output
- [x] **CLEAN-05**: Measure bundle reduction — Report before/after bundle size to quantify improvements

### Phase 107: Unused Exports Cleanup (UNUSED-01 - UNUSED-03)

- [ ] **UNUSED-01**: Scan src/ for all exports — Use AST analysis to find all exported functions and variables
- [ ] **UNUSED-02**: Identify unused exports — Determine which exports are never imported within src/
- [ ] **UNUSED-03**: Remove unused exports — Remove verified unused exports after confirmation

### Phase 108: Dead Code Removal (DEAD-01 - DEAD-03)

- [ ] **DEAD-01**: Detect unreachable code — Find code paths that can never execute (after return/throw/break)
- [ ] **DEAD-02**: Analyze control flow — Identify dead branches and unreachable functions
- [ ] **DEAD-03**: Remove dead code — Remove unreachable code after verification

### Phase 109: Duplicate Code Merge (DUPE-01 - DUPE-03)

- [ ] **DUPE-01**: Find duplicate patterns — Identify duplicate or similar code across src/
- [ ] **DUPE-02**: Design consolidation — Determine how to extract common patterns into shared utilities
- [ ] **DUPE-03**: Merge duplicates — Consolidate duplicate code into shared utilities

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | 106 | Complete |
| CLEAN-02 | 106 | Complete |
| CLEAN-03 | 106 | Complete |
| CLEAN-04 | 106 | Complete |
| CLEAN-05 | 106 | Complete |
| UNUSED-01 | 107 | Pending |
| UNUSED-02 | 107 | Pending |
| UNUSED-03 | 107 | Pending |
| DEAD-01 | 108 | Pending |
| DEAD-02 | 108 | Pending |
| DEAD-03 | 108 | Pending |
| DUPE-01 | 109 | Pending |
| DUPE-02 | 109 | Pending |
| DUPE-03 | 109 | Pending |
