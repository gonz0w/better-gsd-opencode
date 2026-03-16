'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');

// Lazy-load measureAllWorkflows from features.js to avoid circular deps
function getMeasureAllWorkflows() {
  return require('./features').measureAllWorkflows;
}

// ─── Structural Fingerprint Extraction ───────────────────────────────────────

/**
 * Extract structural fingerprint from workflow content.
 * Counts Task() calls, CLI commands (bgsd-tools invocations), section markers,
 * question blocks, and key XML tags.
 *
 * @param {string} content - Workflow file content
 * @returns {object} structure fingerprint
 */
function extractStructuralFingerprint(content) {
  // Task() calls — e.g. Task(1), Task("foo"), task() — case-insensitive
  const taskCallMatches = [];
  const taskCallRe = /\bTask\s*\(([^)]*)\)/gi;
  let m;
  while ((m = taskCallRe.exec(content)) !== null) {
    taskCallMatches.push(m[0].trim());
  }

  // CLI commands: lines in code blocks containing bgsd-tools invocations
  const cliCommandMatches = [];
  const cliRe = /`[^`]*bgsd-tools[^`]*`|```[\s\S]*?```/g;
  // Simpler: extract all bgsd-tools command invocations from code blocks
  const codeBlockRe = /```[^\n]*\n([\s\S]*?)```/g;
  let cbm;
  while ((cbm = codeBlockRe.exec(content)) !== null) {
    const blockContent = cbm[1];
    const lines = blockContent.split('\n');
    for (const line of lines) {
      if (/bgsd-tools/.test(line)) {
        cliCommandMatches.push(line.trim());
      }
    }
  }
  // Also inline backtick mentions
  const inlineRe = /`([^`]*bgsd-tools[^`]*)`/g;
  let im;
  while ((im = inlineRe.exec(content)) !== null) {
    cliCommandMatches.push(im[1].trim());
  }

  // Section markers: <!-- section: ... -->
  const sectionMarkerMatches = [];
  const sectionRe = /<!--\s*section:\s*(.+?)\s*-->/gi;
  let sm;
  while ((sm = sectionRe.exec(content)) !== null) {
    sectionMarkerMatches.push(sm[1].trim());
  }

  // Question blocks: <question> ... </question>
  const questionBlockMatches = [];
  const questionRe = /<question[^>]*>([\s\S]*?)<\/question>/gi;
  let qm;
  while ((qm = questionRe.exec(content)) !== null) {
    questionBlockMatches.push(qm[0].slice(0, 80).trim());
  }

  // Key XML tags: <step>, <process>, <purpose>
  const xmlTagMatches = [];
  const xmlTagRe = /<(step|process|purpose)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  let xm;
  while ((xm = xmlTagRe.exec(content)) !== null) {
    const tagMatch = xm[0].match(/^<(\w+)/);
    if (tagMatch) xmlTagMatches.push(tagMatch[1]);
  }

  return {
    task_calls: taskCallMatches,
    cli_commands: cliCommandMatches,
    section_markers: sectionMarkerMatches,
    question_blocks: questionBlockMatches,
    xml_tags: xmlTagMatches,
  };
}

// ─── workflow:baseline ────────────────────────────────────────────────────────

/**
 * Create a token measurement baseline for all workflows.
 * Saves snapshot to .planning/baselines/workflow-baseline-{timestamp}.json
 *
 * @param {string} cwd - Current working directory
 * @param {boolean} raw - JSON output mode
 */
function cmdWorkflowBaseline(cwd, raw) {
  const measureAllWorkflows = getMeasureAllWorkflows();
  const measurement = measureAllWorkflows(cwd);

  if (measurement.error) {
    error(measurement.error);
  }

  // Detect plugin path to read workflow files for structural fingerprinting
  let pluginDir = process.env.BGSD_PLUGIN_DIR;
  if (!pluginDir) {
    pluginDir = path.resolve(__dirname, '..', '..');
  }
  const workflowsDir = path.join(pluginDir, 'workflows');

  // Enrich each workflow with structural fingerprint
  const enrichedWorkflows = measurement.workflows.map(w => {
    let structure = {
      task_calls: [],
      cli_commands: [],
      section_markers: [],
      question_blocks: [],
      xml_tags: [],
    };
    try {
      const filePath = path.join(workflowsDir, w.name);
      const content = fs.readFileSync(filePath, 'utf-8');
      structure = extractStructuralFingerprint(content);
    } catch (e) {
      debugLog('workflow.baseline', `fingerprint failed for ${w.name}`, e);
    }
    return { ...w, structure };
  });

  // Build snapshot
  const snapshot = {
    version: 1,
    timestamp: measurement.timestamp,
    workflow_count: measurement.workflow_count,
    total_tokens: measurement.total_tokens,
    workflows: enrichedWorkflows,
  };

  // Save to .planning/baselines/
  const baselinesDir = path.join(cwd, '.planning', 'baselines');
  if (!fs.existsSync(baselinesDir)) {
    fs.mkdirSync(baselinesDir, { recursive: true });
  }

  const ts = measurement.timestamp.replace(/[:.]/g, '-');
  const baselineFile = `workflow-baseline-${ts}.json`;
  const baselinePath = path.join(baselinesDir, baselineFile);
  fs.writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // Print human-readable table to stderr
  const maxNameLen = Math.max(30, ...snapshot.workflows.map(w => w.name.length));
  const header = `${'Workflow'.padEnd(maxNameLen)} | Tokens  | Refs | Ref Tokens | Tasks | CLI | Sections`;
  const sep = '-'.repeat(maxNameLen) + '-+---------+------+------------+-------+-----+---------';
  process.stderr.write('\n## Workflow Token Baseline\n\n');
  process.stderr.write(header + '\n');
  process.stderr.write(sep + '\n');
  for (const w of snapshot.workflows) {
    const name = w.name.padEnd(maxNameLen);
    const tokens = String(w.workflow_tokens).padStart(7);
    const refs = String(w.ref_count).padStart(4);
    const refTokens = String(w.ref_tokens).padStart(10);
    const tasks = String(w.structure.task_calls.length).padStart(5);
    const cli = String(w.structure.cli_commands.length).padStart(3);
    const sections = String(w.structure.section_markers.length).padStart(7);
    process.stderr.write(`${name} | ${tokens} | ${refs} | ${refTokens} | ${tasks} | ${cli} | ${sections}\n`);
  }
  process.stderr.write(sep + '\n');
  process.stderr.write(`${'TOTAL'.padEnd(maxNameLen)} | ${String(snapshot.total_tokens).padStart(7)} |      |            |       |     |\n`);
  process.stderr.write(`\nBaseline saved: ${path.relative(cwd, baselinePath)}\n\n`);

  snapshot.baseline_file = path.relative(cwd, baselinePath);
  output(snapshot, raw);
}

// ─── workflow:compare ─────────────────────────────────────────────────────────

/**
 * Compare two workflow baseline snapshots.
 * Usage:
 *   workflow:compare <a> <b>   — diff two snapshot files
 *   workflow:compare <a>       — diff <a> against current state
 *   workflow:compare           — diff two most recent baselines
 *
 * @param {string} cwd - Current working directory
 * @param {string[]} args - Positional args [snapshotA?, snapshotB?]
 * @param {boolean} raw - JSON output mode
 */
function cmdWorkflowCompare(cwd, args, raw) {
  const baselinesDir = path.join(cwd, '.planning', 'baselines');

  /**
   * Load a snapshot JSON from a file path (absolute or relative to cwd).
   */
  function loadSnapshot(filePath) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
    if (!fs.existsSync(fullPath)) {
      error(`Snapshot file not found: ${filePath}`);
    }
    try {
      return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    } catch (e) {
      error(`Invalid snapshot file (${filePath}): ${e.message}`);
    }
  }

  /**
   * Find the N most recent workflow baselines in baselinesDir.
   */
  function findRecentBaselines(n) {
    if (!fs.existsSync(baselinesDir)) {
      return [];
    }
    return fs.readdirSync(baselinesDir)
      .filter(f => f.startsWith('workflow-baseline-') && f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, n)
      .map(f => path.join(baselinesDir, f));
  }

  let snapshotA, snapshotB, labelA, labelB;

  if (args.length >= 2) {
    // Two explicit paths
    labelA = args[0];
    labelB = args[1];
    snapshotA = loadSnapshot(args[0]);
    snapshotB = loadSnapshot(args[1]);
  } else if (args.length === 1) {
    // One explicit path: A is provided, B is current state
    labelA = args[0];
    snapshotA = loadSnapshot(args[0]);
    const measureAllWorkflows = getMeasureAllWorkflows();
    const current = measureAllWorkflows(cwd);
    if (current.error) error(current.error);
    // Build a snapshot-shaped object from current measurement (no structure fingerprints needed for compare)
    snapshotB = { version: 1, timestamp: current.timestamp, workflow_count: current.workflow_count, total_tokens: current.total_tokens, workflows: current.workflows };
    labelB = 'current';
  } else {
    // No args: use two most recent baselines
    const recent = findRecentBaselines(2);
    if (recent.length < 2) {
      if (recent.length === 0) {
        error('No workflow baselines found. Run `workflow:baseline` first.');
      } else {
        // Only one baseline: compare against current
        labelA = path.relative(cwd, recent[0]);
        snapshotA = loadSnapshot(recent[0]);
        const measureAllWorkflows = getMeasureAllWorkflows();
        const current = measureAllWorkflows(cwd);
        if (current.error) error(current.error);
        snapshotB = { version: 1, timestamp: current.timestamp, workflow_count: current.workflow_count, total_tokens: current.total_tokens, workflows: current.workflows };
        labelB = 'current';
      }
    } else {
      // Two most recent: [0] is newer, [1] is older — compare older→newer
      labelA = path.relative(cwd, recent[1]); // older = A
      labelB = path.relative(cwd, recent[0]); // newer = B
      snapshotA = loadSnapshot(recent[1]);
      snapshotB = loadSnapshot(recent[0]);
    }
  }

  // Build lookup maps
  const mapA = {};
  for (const w of (snapshotA.workflows || [])) {
    mapA[w.name] = w;
  }
  const mapB = {};
  for (const w of (snapshotB.workflows || [])) {
    mapB[w.name] = w;
  }

  // Compare
  const allNames = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
  const workflows = [];
  let beforeTotal = 0;
  let afterTotal = 0;
  let improved = 0;
  let unchanged = 0;
  let worsened = 0;

  for (const name of allNames) {
    const a = mapA[name];
    const b = mapB[name];

    if (a && b) {
      const delta = b.total_tokens - a.total_tokens;
      const pctChange = a.total_tokens > 0
        ? Math.round((delta / a.total_tokens) * 1000) / 10
        : 0;
      beforeTotal += a.total_tokens;
      afterTotal += b.total_tokens;
      if (delta < 0) improved++;
      else if (delta > 0) worsened++;
      else unchanged++;
      workflows.push({ name, before: a.total_tokens, after: b.total_tokens, delta, percent_change: pctChange });
    } else if (a && !b) {
      // Workflow removed in B
      beforeTotal += a.total_tokens;
      workflows.push({ name, before: a.total_tokens, after: 0, delta: -a.total_tokens, percent_change: -100, status: 'removed' });
      improved++;
    } else if (!a && b) {
      // Workflow added in B
      afterTotal += b.total_tokens;
      workflows.push({ name, before: 0, after: b.total_tokens, delta: b.total_tokens, percent_change: 100, status: 'added' });
      worsened++;
    }
  }

  // Sort by delta ascending (biggest reductions first)
  workflows.sort((a, b) => a.delta - b.delta);

  const totalDelta = afterTotal - beforeTotal;
  const totalPctChange = beforeTotal > 0
    ? Math.round((totalDelta / beforeTotal) * 1000) / 10
    : 0;

  const result = {
    snapshot_a: labelA,
    snapshot_b: labelB,
    date_a: snapshotA.timestamp || 'unknown',
    date_b: snapshotB.timestamp || 'unknown',
    summary: {
      before_total: beforeTotal,
      after_total: afterTotal,
      delta: totalDelta,
      percent_change: totalPctChange,
      workflows_improved: improved,
      workflows_unchanged: unchanged,
      workflows_worsened: worsened,
    },
    workflows,
  };

  // Print comparison table to stderr
  const maxNameLen = Math.max(30, ...workflows.map(c => c.name.length));
  const header = `${'Workflow'.padEnd(maxNameLen)} | Before  | After   | Delta   | Change`;
  const sep = '-'.repeat(maxNameLen) + '-+---------+---------+---------+-------';
  process.stderr.write('\n## Workflow Token Comparison\n\n');
  process.stderr.write(`A: ${labelA} (${snapshotA.timestamp || 'unknown'})\n`);
  process.stderr.write(`B: ${labelB} (${snapshotB.timestamp || 'unknown'})\n\n`);
  process.stderr.write(header + '\n');
  process.stderr.write(sep + '\n');
  for (const c of workflows) {
    const name = c.name.padEnd(maxNameLen);
    const before = String(c.before).padStart(7);
    const after = String(c.after).padStart(7);
    const deltaStr = (c.delta >= 0 ? '+' + c.delta : String(c.delta)).padStart(7);
    const pctStr = (c.percent_change >= 0 ? '+' + c.percent_change : String(c.percent_change)) + '%';
    process.stderr.write(`${name} | ${before} | ${after} | ${deltaStr} | ${pctStr.padStart(6)}\n`);
  }
  process.stderr.write(sep + '\n');
  const totalDeltaStr = (totalDelta >= 0 ? '+' + totalDelta : String(totalDelta)).padStart(7);
  const totalPctStr = (totalPctChange >= 0 ? '+' + totalPctChange : String(totalPctChange)) + '%';
  process.stderr.write(`${'TOTAL'.padEnd(maxNameLen)} | ${String(beforeTotal).padStart(7)} | ${String(afterTotal).padStart(7)} | ${totalDeltaStr} | ${totalPctStr.padStart(6)}\n`);
  process.stderr.write(`\nImproved: ${improved} | Unchanged: ${unchanged} | Worsened: ${worsened}\n`);
  process.stderr.write(`Total reduction: ${totalPctChange}%\n\n`);

  output(result, raw);
}

module.exports = {
  cmdWorkflowBaseline,
  cmdWorkflowCompare,
  extractStructuralFingerprint,
};
