---
status: testing
phase: 60-testing-caching-polish
source: 60-01-SUMMARY.md, 60-02-SUMMARY.md
started: 2026-03-03T14:30:00Z
updated: 2026-03-03T14:30:00Z
---

## Current Test

number: 1
name: cache:research-stats command
expected: |
  Running `node bin/gsd-tools.cjs cache:research-stats` returns JSON with
  `count`, `hits`, and `misses` fields (e.g. `{"count":0,"hits":0,"misses":0}`)
awaiting: user response

## Tests

### 1. cache:research-stats command
expected: Running `node bin/gsd-tools.cjs cache:research-stats` returns JSON with `count`, `hits`, and `misses` fields
result: [pending]

### 2. cache:research-clear command
expected: Running `node bin/gsd-tools.cjs cache:research-clear` returns `{"cleared":true}`
result: [pending]

### 3. Repeated query returns cache hit
expected: Running `research:collect` twice with the same query — second call returns instantly (or shows "(cached result — use --no-cache to refresh)")
result: [pending]

### 4. --no-cache flag bypasses cache
expected: Running `research:collect "same query" --no-cache` runs the full pipeline regardless of cached result, does not read from or write to cache
result: [pending]

### 5. cache:research-stats shows hit after cached query
expected: After a cache hit (test 3), `cache:research-stats` shows `hits` > 0
result: [pending]

### 6. [Intent DO-29] Research cache eliminates repeated runs
expected: The mechanism exists and works — a query already in cache returns without re-running the pipeline (verifies the intent "eliminates repeated filesystem/pipeline reads")
result: [pending]

### 7. --resume flag accepted without error
expected: Running `node bin/gsd-tools.cjs research:collect "some query" --resume` does not crash — either finds a session or says "No matching session found — starting fresh"
result: [pending]

### 8. Session file written after interrupted run
expected: After running `research:collect` and interrupting (Ctrl+C) mid-pipeline, `.planning/research-session.json` exists with `completed_stages` array and `query` field
result: [pending]

### 9. --resume skips completed stages
expected: With a pre-written session file, running `research:collect "same query" --resume` shows "Resuming session from stage: ..." and does not re-run already-completed stages
result: [pending]

### 10. No --resume = ignores session file
expected: Running `research:collect "same query"` (no `--resume` flag) ignores any existing `.planning/research-session.json` and runs a fresh collection
result: [pending]

### 11. Session file deleted on success
expected: After a successful full `research:collect` run that used `--resume`, `.planning/research-session.json` is deleted automatically
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0

## Gaps

<!-- filled during diagnosis if issues found -->
