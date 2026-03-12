# Duplicate Code Detection Report

**Generated:** 2026-03-12  
**Tool:** jscpd v4.0.8  
**Threshold:** 70% similarity  
**Source:** src/ directory

---

## Summary

| Metric | Value |
|--------|-------|
| Total duplicate blocks detected | 40+ |
| Files with duplicates | 25+ |
| Priority 1 (lib/) | 15+ occurrences |
| Priority 2 (commands/) | 8+ occurrences |
| Priority 3 (plugin/) | 10+ occurrences |

---

## Priority 1: lib/ Directory (Highest Priority)

### 1.1 CLI Tools Module (lib/cli-tools/)

**Duplicate Pattern: JSON/YAML parsing with error handling**
- `src/lib/cli-tools/yq.js` lines 58-70 ↔ lines 121-133 (12 lines, 92 tokens)
- `src/lib/cli-tools/yq.js` lines 49-64 ↔ lines 167-183 (16 lines, 116 tokens)
- `src/lib/cli-tools/jq.js` lines 120-128 ↔ `src/lib/cli-tools/yq.js` lines 211-219 (8 lines, 84 tokens)

**Pattern:** Similar error handling and fallback logic for CLI JSON/YAML parsers

**Recommendation:** Extract shared CLI parsing utility

---

**Duplicate Pattern: GitHub CLI detection logic**
- `src/lib/cli-tools/gh.js` lines 40-52 ↔ lines 70-82 (12 lines, 88 tokens)
- `src/lib/cli-tools/gh.js` lines 40-82 ↔ lines 116-128 (12 lines, 95 tokens)
- `src/lib/cli-tools/gh.js` lines 70-138 ↔ lines 145-166 (21 lines, 109 tokens)

**Recommendation:** Extract GitHub CLI version detection to shared utility

---

**Duplicate Pattern: Runtime detection**
- `src/lib/cli-tools/bun-runtime.js` lines 21-34 ↔ `src/lib/cli-tools/plugin-benchmark.js` lines 18-30 (13 lines, 88 tokens)

**Recommendation:** Consolidate runtime detection into shared module

---

### 1.2 Reports Module (lib/reports/)

**Duplicate Pattern: Date/time formatting**
- `src/lib/reports/milestone-summary.js` lines 302-314 ↔ `src/lib/reports/velocity-metrics.js` lines 80-92 (12 lines, 147 tokens)

**Recommendation:** Extract date formatting utility to lib/date-utils.js

---

### 1.3 Visualization Module (lib/viz/)

**Duplicate Pattern: Chart data processing**
- `src/lib/viz/burndown.js` lines 139-145 ↔ lines 157-163 (6 lines, 197 tokens) - internal self-duplication

**Recommendation:** Refactor to use single data transformation function

---

### 1.4 Natural Language Module (lib/nl/)

**Duplicate Pattern: Command matching logic**
- `src/lib/nl/command-registry.js` lines 69-76 ↔ `src/lib/nl/intent-classifier.js` lines 4-15 (7 lines, 122 tokens)

**Recommendation:** Extract fuzzy matching logic to shared utility

---

### 1.5 Adapters Module (lib/adapters/)

**Duplicate Pattern: File discovery logic**
- `src/lib/adapters/discovery.js` lines 202-222 ↔ lines 258-278 (20 lines, 180 tokens)

**Recommendation:** Consolidate discovery traversal into single function

---

### 1.6 Core Library Duplicates

**Frontmatter parsing:**
- `src/lib/frontmatter.js` lines 38-83 ↔ `src/plugin/parsers/plan.js` lines 41-86 (45 lines, 632 tokens)
- **Significance:** HIGH - This is a major duplicate across lib/ and plugin/

**Convention matching:**
- `src/lib/conventions.js` lines 26-36 ↔ `src/plugin/advisory-guardrails.js` lines 41-50 (10 lines, 89 tokens)

**Context building:**
- `src/lib/commandDiscovery.js` lines 200-233 ↔ `src/lib/nl/help-fallback.js` lines 240-275 (33 lines, 389 tokens)

**Cache key generation:**
- `src/lib/cache.js` lines 279-305 ↔ lines 528-554 (26 lines, 138 tokens)

---

## Priority 2: commands/ Directory

### 2.1 worktree.js

**Duplicate Pattern: Git worktree validation**
- `src/commands/worktree.js` lines 319-331 ↔ lines 421-432 (11 lines, 128 tokens)

**Recommendation:** Extract worktree validation to lib/git-worktree.js

---

### 2.2 trajectory.js

**Duplicate Pattern: Session tracking**
- `src/commands/trajectory.js` lines 34-41 ↔ lines 528-535 (7 lines, 76 tokens)
- `src/commands/trajectory.js` lines 45-50 ↔ lines 359-364 (5 lines, 104 tokens)
- `src/commands/trajectory.js` lines 148-154 ↔ lines 447-453 (6 lines, 75 tokens)
- `src/commands/trajectory.js` lines 224-231 ↔ lines 376-383 (7 lines, 88 tokens)
- `src/commands/trajectory.js` lines 221-231 ↔ lines 535-545 (10 lines, 113 tokens)

**Recommendation:** Multiple session tracking patterns - consolidate into single utility

---

## Priority 3: plugin/ Directory

### 3.1 Tool Handlers (plugin/tools/)

**Duplicate Pattern: Tool output formatting**
- `src/plugin/tools/bgsd-status.js` lines 24-42 ↔ `src/plugin/tools/bgsd-validate.js` lines 25-43 (18 lines, 143 tokens)
- `src/plugin/tools/bgsd-plan.js` lines 36-54 ↔ `src/plugin/tools/bgsd-validate.js` lines 25-43 (18 lines, 140 tokens)
- `src/plugin/tools/bgsd-context.js` lines 33-51 ↔ `src/plugin/tools/bgsd-validate.js` lines 25-43 (18 lines, 140 tokens)

**Significance:** HIGH - Same 18-line pattern repeated across 4 tool files

**Recommendation:** Extract common tool output formatting to plugin/tools/format-utils.js

---

### 3.2 Parser Overlap

**Duplicate Pattern: Frontmatter parsing** (also in lib/)
- `src/plugin/parsers/plan.js` ↔ `src/lib/frontmatter.js` (documented above in Priority 1)

---

## Consolidation Opportunities

### High Priority (Easy wins)

1. **Tool output formatting** (plugin/tools/) - 4 files share 18-line duplicate
2. **Frontmatter parsing** (lib/frontmatter.js ↔ plugin/parsers/plan.js) - 45-line major duplicate
3. **CLI tool detection** (lib/cli-tools/) - repeated patterns across gh.js, yq.js, jq.js

### Medium Priority

4. **Date/time formatting** (lib/reports/)
5. **Cache key generation** (lib/cache.js internal)
6. **Command matching** (lib/nl/)

### Lower Priority

7. **Trajectory session tracking** (commands/trajectory.js internal)
8. **Discovery traversal** (lib/adapters/discovery.js internal)

---

## Notes

- Many duplicates are intentional variations (e.g., different CLI tools need slightly different handling)
- jscpd threshold of 70% captures meaningful duplicates but may include false positives
- Some duplicates improve readability and should NOT be consolidated (e.g., explicit vs. condensed logic)
- Focus on HIGH priority items for maximum impact refactoring
