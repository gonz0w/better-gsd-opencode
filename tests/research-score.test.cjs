'use strict';
/**
 * Tests for research:score and research:gaps commands.
 * Covers: parseResearchFile, computeConfidenceLevel, cmdResearchScore (integration),
 * cmdResearchGaps, and edge cases.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { parseResearchFile, computeConfidenceLevel } = require('../src/commands/research.js');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── Sample RESEARCH.md fixtures ─────────────────────────────────────────────

const VALID_RESEARCH_MD = `# Research: Node.js Async Patterns

**Confidence:** HIGH
**Researched:** 2026-01-15

## Sources

### Primary

- [Node.js official docs](https://docs.nodejs.org/async) — official documentation on async/await
- [MDN Web Docs](https://docs.mozilla.org/web) — official reference for Promises

### Secondary

- [Node.js GitHub](https://github.com/nodejs/node) — source code and issues

### Tertiary

- [Stack Overflow discussion](https://stackoverflow.com/q/123) — community answers
- [Dev.to article](https://dev.to/async) — tutorial

## Metadata

**Confidence breakdown:**
- async/await patterns: HIGH
- error handling: HIGH
- performance: MEDIUM
- edge cases: LOW

## Open Questions

- How does async/await perform under high concurrency load?
- What is the behavior of unhandled rejections in Node 18+?
`;

const MINIMAL_RESEARCH_MD = `# Research: Minimal

**Confidence:** HIGH
`;

const MISSING_CONFIDENCE_MD = `# Research: Missing Confidence Line

## Sources

### Primary

- [Some docs](https://example.com)
`;

const CONFLICT_RESEARCH_MD = `# Research: Conflicting Sources

**Confidence:** MEDIUM
**Researched:** 2026-01-01

## Sources

### Primary

- [Source A](https://source-a.com) — says X is recommended
- [Source B](https://source-b.com) — Source A contradicts Source B on performance benchmarks
`;

// ─── Test group: parseResearchFile ───────────────────────────────────────────

describe('parseResearchFile', () => {
  test('valid RESEARCH.md - parses all sections correctly', () => {
    const parsed = parseResearchFile(VALID_RESEARCH_MD);

    // Source tier counts
    assert.strictEqual(parsed.primaryCount, 2, 'primary sources: 2');
    assert.strictEqual(parsed.secondaryCount, 1, 'secondary sources: 1');
    assert.strictEqual(parsed.tertiaryCount, 2, 'tertiary sources: 2');
    assert.strictEqual(parsed.totalSources, 5, 'total sources: 5');

    // Official docs detection (docs.nodejs.org, docs.mozilla.org)
    assert.strictEqual(parsed.hasOfficialDocs, true, 'has official docs (docs.* domains)');

    // Header confidence
    assert.strictEqual(parsed.headerConfidence, 'HIGH');

    // Research date
    assert.strictEqual(parsed.researchDate, '2026-01-15');

    // Confidence breakdown entries
    assert.ok(Array.isArray(parsed.confidenceBreakdown), 'confidenceBreakdown is array');
    assert.strictEqual(parsed.confidenceBreakdown.length, 4, 'breakdown has 4 entries');

    const lowEntry = parsed.confidenceBreakdown.find(e => e.level === 'LOW');
    assert.ok(lowEntry, 'has LOW entry in breakdown');
    assert.strictEqual(lowEntry.domain, 'edge cases');

    // Gaps from LOW-confidence breakdown + Open Questions
    assert.ok(Array.isArray(parsed.flaggedGaps), 'flaggedGaps is array');
    // 1 from LOW breakdown + 2 from Open Questions = 3
    assert.ok(parsed.flaggedGaps.length >= 1, 'at least one gap from LOW confidence section');

    const lowGap = parsed.flaggedGaps.find(g => g.section === 'Confidence Breakdown');
    assert.ok(lowGap, 'has gap from Confidence Breakdown section');
    assert.strictEqual(lowGap.severity, 'HIGH');

    const oqGaps = parsed.flaggedGaps.filter(g => g.section === 'Open Questions');
    assert.ok(oqGaps.length >= 1, 'has Open Questions gaps');
    assert.strictEqual(oqGaps[0].severity, 'MEDIUM');

    // Conflicts should be empty in this fixture
    assert.ok(Array.isArray(parsed.conflicts), 'conflicts is array');
  });

  test('minimal RESEARCH.md - returns zero counts without crashing', () => {
    const parsed = parseResearchFile(MINIMAL_RESEARCH_MD);

    assert.strictEqual(parsed.primaryCount, 0, 'primary: 0');
    assert.strictEqual(parsed.secondaryCount, 0, 'secondary: 0');
    assert.strictEqual(parsed.tertiaryCount, 0, 'tertiary: 0');
    assert.strictEqual(parsed.totalSources, 0, 'total: 0');
    assert.strictEqual(parsed.hasOfficialDocs, false, 'no official docs');
    assert.deepStrictEqual(parsed.flaggedGaps, [], 'empty gaps');
    assert.deepStrictEqual(parsed.conflicts, [], 'empty conflicts');
    assert.strictEqual(parsed.headerConfidence, 'HIGH');
  });

  test('missing confidence line - headerConfidence is null, rest still parses', () => {
    const parsed = parseResearchFile(MISSING_CONFIDENCE_MD);

    assert.strictEqual(parsed.headerConfidence, null, 'headerConfidence is null');
    assert.strictEqual(parsed.primaryCount, 1, 'primary: 1');
    assert.ok(Array.isArray(parsed.flaggedGaps), 'flaggedGaps is array');
    assert.ok(Array.isArray(parsed.conflicts), 'conflicts is array');
  });

  test('conflict detection - finds contradicts pattern', () => {
    const parsed = parseResearchFile(CONFLICT_RESEARCH_MD);

    assert.ok(Array.isArray(parsed.conflicts), 'conflicts is array');
    assert.ok(parsed.conflicts.length >= 1, 'at least one conflict detected');

    const conflict = parsed.conflicts[0];
    assert.ok('claim' in conflict, 'conflict has claim field');
    assert.ok('source_a' in conflict, 'conflict has source_a field');
    assert.ok('source_b' in conflict, 'conflict has source_b field');
    // source_a and source_b should be non-empty strings
    assert.strictEqual(typeof conflict.source_a, 'string');
    assert.strictEqual(typeof conflict.source_b, 'string');
    assert.ok(conflict.source_a.length > 0, 'source_a is non-empty');
    assert.ok(conflict.source_b.length > 0, 'source_b is non-empty');
  });

  test('empty string input - returns safe defaults without crashing', () => {
    const parsed = parseResearchFile('');

    assert.strictEqual(parsed.totalSources, 0);
    assert.strictEqual(parsed.hasOfficialDocs, false);
    assert.deepStrictEqual(parsed.flaggedGaps, []);
    assert.deepStrictEqual(parsed.conflicts, []);
    assert.strictEqual(parsed.headerConfidence, null);
  });

  test('null input - returns safe defaults without crashing', () => {
    const parsed = parseResearchFile(null);

    assert.strictEqual(parsed.totalSources, 0);
    assert.deepStrictEqual(parsed.flaggedGaps, []);
  });
});

// ─── Test group: computeConfidenceLevel ──────────────────────────────────────

describe('computeConfidenceLevel', () => {
  test('HIGH confidence - 5+ sources, official docs, recent, no conflicts, high pct', () => {
    const parsed = {
      totalSources: 6,
      hasOfficialDocs: true,
      oldestSourceDays: 30,      // recent
      conflicts: [],
      highConfidencePct: 80,
    };
    assert.strictEqual(computeConfidenceLevel(parsed), 'HIGH');
  });

  test('MEDIUM confidence - exactly 1 negative signal (no official docs)', () => {
    const parsed = {
      totalSources: 5,
      hasOfficialDocs: false,    // 1 negative signal
      oldestSourceDays: 30,
      conflicts: [],
      highConfidencePct: 70,
    };
    assert.strictEqual(computeConfidenceLevel(parsed), 'MEDIUM');
  });

  test('LOW confidence - 3+ negative signals (few sources, old, no official docs)', () => {
    const parsed = {
      totalSources: 1,           // negative: < 3
      hasOfficialDocs: false,    // negative: no official docs
      oldestSourceDays: 200,     // negative: > 90 days
      conflicts: [],
      highConfidencePct: 50,
    };
    assert.strictEqual(computeConfidenceLevel(parsed), 'LOW');
  });

  test('LOW confidence - conflicts contribute as negative signal', () => {
    const parsed = {
      totalSources: 1,           // negative
      hasOfficialDocs: false,    // negative
      oldestSourceDays: 100,     // negative
      conflicts: [{ claim: 'x', source_a: 'a', source_b: 'b' }], // negative
      highConfidencePct: 50,
    };
    assert.strictEqual(computeConfidenceLevel(parsed), 'LOW');
  });

  test('LOW confidence - low high_confidence_pct < 30 counts as negative signal', () => {
    const parsed = {
      totalSources: 1,           // negative
      hasOfficialDocs: false,    // negative
      oldestSourceDays: 30,
      conflicts: [],
      highConfidencePct: 10,     // negative: < 30
    };
    assert.strictEqual(computeConfidenceLevel(parsed), 'LOW');
  });

  test('MEDIUM confidence - single signal: few sources but otherwise fine', () => {
    const parsed = {
      totalSources: 2,           // negative: < 3
      hasOfficialDocs: true,
      oldestSourceDays: 20,
      conflicts: [],
      highConfidencePct: 75,
    };
    assert.strictEqual(computeConfidenceLevel(parsed), 'MEDIUM');
  });
});

// ─── Test group: cmdResearchScore (integration) ──────────────────────────────

describe('cmdResearchScore (integration)', () => {
  test('outputs 7-field profile and writes cache', () => {
    const tmpDir = createTempProject();
    try {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '0001-test');
      fs.mkdirSync(phaseDir, { recursive: true });

      const researchPath = path.join(phaseDir, '0001-RESEARCH.md');
      fs.writeFileSync(researchPath, VALID_RESEARCH_MD, 'utf-8');

      const result = runGsdTools(`research:score "${researchPath}"`, tmpDir);
      assert.ok(result.success, `research:score should succeed. Error: ${result.error}`);

      const profile = JSON.parse(result.output);

      // Assert all 7 required fields are present
      assert.ok('source_count' in profile, 'has source_count');
      assert.ok('high_confidence_pct' in profile, 'has high_confidence_pct');
      assert.ok('oldest_source_days' in profile, 'has oldest_source_days');
      assert.ok('has_official_docs' in profile, 'has has_official_docs');
      assert.ok('confidence_level' in profile, 'has confidence_level');
      assert.ok('flagged_gaps' in profile, 'has flagged_gaps');
      assert.ok('conflicts' in profile, 'has conflicts');

      // Verify types
      assert.strictEqual(typeof profile.source_count, 'number');
      assert.strictEqual(typeof profile.high_confidence_pct, 'number');
      assert.strictEqual(typeof profile.has_official_docs, 'boolean');
      assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(profile.confidence_level), 'valid confidence_level');
      assert.ok(Array.isArray(profile.flagged_gaps), 'flagged_gaps is array');
      assert.ok(Array.isArray(profile.conflicts), 'conflicts is array');

      // No legacy overall_grade field
      assert.ok(!('overall_grade' in profile), 'no legacy overall_grade field');

      // Cache file created in same directory
      const cachePath = path.join(phaseDir, 'research-score.json');
      assert.ok(fs.existsSync(cachePath), 'research-score.json cache created');

      const cachedProfile = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      assert.ok('source_count' in cachedProfile, 'cache has source_count');
      assert.strictEqual(cachedProfile.source_count, profile.source_count, 'cached source_count matches output');

    } finally {
      cleanup(tmpDir);
    }
  });

  test('error if no path argument given', () => {
    const tmpDir = createTempProject();
    try {
      const result = runGsdTools('research:score', tmpDir);
      // May succeed with error object or fail — either way output should include 'Usage'
      const output = result.output || '';
      const errOutput = result.error || '';
      const combined = output + errOutput;
      assert.ok(combined.includes('Usage') || combined.includes('usage') || combined.includes('error') || combined.includes('Error'),
        'should produce usage/error message when no args');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('error if file does not exist', () => {
    const tmpDir = createTempProject();
    try {
      const result = runGsdTools(`research:score "${path.join(tmpDir, 'nonexistent.md')}"`, tmpDir);
      const output = result.output || '';
      const errOutput = result.error || '';
      const combined = output + errOutput;
      assert.ok(combined.includes('Cannot read') || combined.includes('error') || combined.includes('Error'),
        'should produce error for missing file');
    } finally {
      cleanup(tmpDir);
    }
  });
});

// ─── Test group: cmdResearchGaps ─────────────────────────────────────────────

describe('cmdResearchGaps', () => {
  test('reads cached research-score.json and returns flagged_gaps', () => {
    const tmpDir = createTempProject();
    try {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '0001-test');
      fs.mkdirSync(phaseDir, { recursive: true });

      // Write a known research-score.json cache directly
      const knownCache = {
        source_count: 3,
        high_confidence_pct: 60,
        oldest_source_days: 45,
        has_official_docs: true,
        confidence_level: 'MEDIUM',
        flagged_gaps: [
          { gap: 'Test gap from cache', severity: 'HIGH', section: 'Confidence Breakdown', suggestion: 'Research more' },
          { gap: 'Another gap', severity: 'MEDIUM', section: 'Open Questions', suggestion: 'Investigate further' },
        ],
        conflicts: [],
      };
      const cachePath = path.join(phaseDir, 'research-score.json');
      fs.writeFileSync(cachePath, JSON.stringify(knownCache, null, 2), 'utf-8');

      // Test with RESEARCH.md path (resolves to same dir's cache)
      const researchPath = path.join(phaseDir, '0001-RESEARCH.md');
      fs.writeFileSync(researchPath, '# Placeholder', 'utf-8');

      const result = runGsdTools(`research:gaps "${researchPath}"`, tmpDir);
      assert.ok(result.success, `research:gaps should succeed. Error: ${result.error}`);

      const output = JSON.parse(result.output);
      assert.ok('flagged_gaps' in output, 'output has flagged_gaps');
      assert.ok(Array.isArray(output.flagged_gaps), 'flagged_gaps is array');
      assert.strictEqual(output.flagged_gaps.length, 2, 'returns both gaps from cache');
      assert.strictEqual(output.flagged_gaps[0].gap, 'Test gap from cache');

    } finally {
      cleanup(tmpDir);
    }
  });

  test('reads cache via .json path directly', () => {
    const tmpDir = createTempProject();
    try {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '0001-test');
      fs.mkdirSync(phaseDir, { recursive: true });

      const knownCache = {
        source_count: 2,
        high_confidence_pct: 40,
        oldest_source_days: 20,
        has_official_docs: false,
        confidence_level: 'MEDIUM',
        flagged_gaps: [
          { gap: 'Direct json path gap', severity: 'LOW', section: 'Open Questions', suggestion: 'Follow up' },
        ],
        conflicts: [],
      };
      const cachePath = path.join(phaseDir, 'research-score.json');
      fs.writeFileSync(cachePath, JSON.stringify(knownCache, null, 2), 'utf-8');

      const result = runGsdTools(`research:gaps "${cachePath}"`, tmpDir);
      assert.ok(result.success, `research:gaps should succeed. Error: ${result.error}`);

      const output = JSON.parse(result.output);
      assert.strictEqual(output.flagged_gaps.length, 1);
      assert.strictEqual(output.flagged_gaps[0].gap, 'Direct json path gap');

    } finally {
      cleanup(tmpDir);
    }
  });

  test('error if no cache exists', () => {
    const tmpDir = createTempProject();
    try {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '0001-test');
      fs.mkdirSync(phaseDir, { recursive: true });

      const researchPath = path.join(phaseDir, '0001-RESEARCH.md');
      fs.writeFileSync(researchPath, '# Placeholder', 'utf-8');

      // No research-score.json written
      const result = runGsdTools(`research:gaps "${researchPath}"`, tmpDir);
      const output = result.output || '';
      assert.ok(output.includes('No cached profile found') || output.includes('research:score'),
        'should error about missing cache');

    } finally {
      cleanup(tmpDir);
    }
  });

  test('gaps with missing conflicts key in cache still works (backward-safe)', () => {
    const tmpDir = createTempProject();
    try {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '0001-test');
      fs.mkdirSync(phaseDir, { recursive: true });

      // Cache without conflicts key (backward compatibility)
      const oldFormatCache = {
        source_count: 5,
        high_confidence_pct: 70,
        oldest_source_days: 15,
        has_official_docs: true,
        confidence_level: 'HIGH',
        flagged_gaps: [],
        // no conflicts key
      };
      const cachePath = path.join(phaseDir, 'research-score.json');
      fs.writeFileSync(cachePath, JSON.stringify(oldFormatCache, null, 2), 'utf-8');

      const researchPath = path.join(phaseDir, '0001-RESEARCH.md');
      fs.writeFileSync(researchPath, '# Placeholder', 'utf-8');

      const result = runGsdTools(`research:gaps "${researchPath}"`, tmpDir);
      assert.ok(result.success, `research:gaps should succeed even without conflicts key`);

      const output = JSON.parse(result.output);
      assert.ok('flagged_gaps' in output, 'has flagged_gaps');
      assert.deepStrictEqual(output.flagged_gaps, [], 'empty gaps returned safely');

    } finally {
      cleanup(tmpDir);
    }
  });
});

// ─── Test group: Edge cases ───────────────────────────────────────────────────

describe('Edge cases', () => {
  test('empty file - no crash, returns zero/null profile values', () => {
    const parsed = parseResearchFile('');
    assert.strictEqual(parsed.totalSources, 0);
    assert.strictEqual(parsed.hasOfficialDocs, false);
    assert.deepStrictEqual(parsed.flaggedGaps, []);
    assert.deepStrictEqual(parsed.conflicts, []);
    assert.strictEqual(parsed.headerConfidence, null);
    assert.strictEqual(parsed.oldestSourceDays, null);
  });

  test('## Sources section with no tier headings - source_count is 0', () => {
    const content = `# Research

**Confidence:** MEDIUM

## Sources

- Some source without a tier heading
- Another source

`;
    const parsed = parseResearchFile(content);
    // No ### Primary/Secondary/Tertiary headings
    assert.strictEqual(parsed.primaryCount, 0, 'primary: 0 (no tier headings)');
    assert.strictEqual(parsed.secondaryCount, 0, 'secondary: 0');
    assert.strictEqual(parsed.tertiaryCount, 0, 'tertiary: 0');
    assert.strictEqual(parsed.totalSources, 0, 'total: 0');
  });

  test('research:score integration with empty file - returns profile without crashing', () => {
    const tmpDir = createTempProject();
    try {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '0001-test');
      fs.mkdirSync(phaseDir, { recursive: true });

      const researchPath = path.join(phaseDir, '0001-RESEARCH.md');
      fs.writeFileSync(researchPath, '', 'utf-8');

      const result = runGsdTools(`research:score "${researchPath}"`, tmpDir);
      assert.ok(result.success, `research:score should succeed on empty file. Error: ${result.error}`);

      const profile = JSON.parse(result.output);
      assert.strictEqual(profile.source_count, 0, 'source_count: 0');
      assert.ok(Array.isArray(profile.flagged_gaps), 'flagged_gaps is array');
      assert.ok(Array.isArray(profile.conflicts), 'conflicts is array');

    } finally {
      cleanup(tmpDir);
    }
  });
});
