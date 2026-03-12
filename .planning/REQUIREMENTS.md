# Milestone v11.2 Requirements

**Version:** v11.2
**Name:** Code Audit & Performance
**Started:** 2026-03-12

## Current Requirements

### Code Cleanup (CLEAN-01 - CLEAN-05)

- [ ] **CLEAN-01**: Audit src/ for unused exports — Scan src/ directory for exported functions/variables that are never imported within the codebase
- [ ] **CLEAN-02**: Remove verify:orphans — Delete the verify:orphans command and related code (one-time cleanup)
- [ ] **CLEAN-03**: Remove test infrastructure from bundle — Strip node:test, test files, and test utilities from the build output
- [ ] **CLEAN-04**: Remove performance profiling from bundle — Strip profiler.js, benchmarking code from the build output
- [ ] **CLEAN-05**: Measure bundle reduction — Report before/after bundle size to quantify improvements

## Future Consideration (Deferred)

- External audit tools via CLI wrappers (run externally before release)
- External performance profiling (run externally before release)

## Out of Scope

- Adding audit tools to the plugin (done externally)
- Adding performance tools to the plugin (done externally)
- Analyzing .planning/ directory (not part of the plugin)

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | 106 | - |
| CLEAN-02 | 106 | - |
| CLEAN-03 | 106 | - |
| CLEAN-04 | 106 | - |
| CLEAN-05 | 106 | - |
