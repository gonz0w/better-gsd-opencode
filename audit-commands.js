'use strict';

const fs = require('fs');
const path = require('path');

// ─── 1. Parse all CLI commands from router.js ────────────────────────────────
function parseRouterCommands() {
  const routerPath = path.join(__dirname, 'src', 'router.js');
  const routerSrc = fs.readFileSync(routerPath, 'utf-8');

  const commands = new Map();

  // Extract namespace:subcommand patterns from the router
  // Pattern: case 'xxx': in the top-level switch
  const topLevelCases = [];
  const topCaseRe = /^\s*case\s+'([^']+)':/gm;
  let m;
  while ((m = topCaseRe.exec(routerSrc)) !== null) {
    topLevelCases.push(m[1]);
  }

  // The namespaced section uses namespace variable with switch
  // We need to extract the combination of namespace + subcommand
  // Strategy: find all unique command paths by parsing the router structure

  // Approach: extract all lazy*().cmd* invocations and map them to commands
  // But the plan wants CLI command strings, not function names.
  // Let's extract both namespace:subcommand and legacy top-level commands.

  // ── Namespace commands ──
  // Pattern: namespace cases: 'init', 'plan', 'execute', 'verify', 'util', 'research', 'cache'
  // Within each namespace, subcommands are matched via if/switch

  // init namespace
  const initWorkflows = [
    'execute-phase', 'plan-phase', 'new-project', 'new-milestone', 'quick',
    'resume', 'verify-work', 'phase-op', 'todos', 'milestone-op',
    'map-codebase', 'progress', 'memory'
  ];
  for (const w of initWorkflows) {
    commands.set(`init:${w}`, { namespace: 'init', subcommand: w });
  }

  // plan namespace
  const planSubs = [
    'intent create', 'intent show', 'intent read', 'intent update',
    'intent validate', 'intent trace', 'intent drift',
    'requirements mark-complete',
    'roadmap get-phase', 'roadmap analyze', 'roadmap update-plan-progress',
    'phases list',
    'find-phase',
    'milestone complete',
    'phase next-decimal', 'phase add', 'phase insert', 'phase remove', 'phase complete'
  ];
  for (const s of planSubs) {
    commands.set(`plan:${s.replace(/\s+/g, ' ')}`, { namespace: 'plan', subcommand: s });
  }

  // execute namespace
  const execSubs = [
    'commit', 'rollback-info', 'session-diff', 'session-summary', 'velocity',
    'worktree create', 'worktree list', 'worktree remove', 'worktree cleanup',
    'worktree merge', 'worktree check-overlap',
    'tdd', 'test-run'
  ];
  for (const s of execSubs) {
    commands.set(`execute:${s.replace(/\s+/g, ' ')}`, { namespace: 'execute', subcommand: s });
  }

  // verify namespace
  const verifySubs = [
    'state', 'state update', 'state get', 'state patch', 'state advance-plan',
    'state record-metric', 'state update-progress', 'state add-decision',
    'state add-blocker', 'state resolve-blocker', 'state record-session', 'state validate',
    'verify plan-structure', 'verify phase-completeness', 'verify references',
    'verify commits', 'verify artifacts', 'verify key-links', 'verify analyze-plan',
    'verify deliverables', 'verify requirements', 'verify regression',
    'verify plan-wave', 'verify plan-deps', 'verify quality',
    'assertions list', 'assertions validate',
    'search-decisions', 'search-lessons', 'review',
    'context-budget', 'context-budget baseline', 'context-budget compare',
    'context-budget measure', 'token-budget'
  ];
  for (const s of verifySubs) {
    commands.set(`verify:${s.replace(/\s+/g, ' ')}`, { namespace: 'verify', subcommand: s });
  }

  // util namespace
  const utilSubs = [
    'config-get', 'config-set', 'env scan', 'env status',
    'current-timestamp', 'list-todos', 'todo complete',
    'memory write', 'memory read', 'memory list', 'memory ensure-dir', 'memory compact',
    'mcp profile', 'classify plan', 'classify phase',
    'frontmatter get', 'frontmatter set', 'frontmatter merge', 'frontmatter validate',
    'progress', 'websearch', 'history-digest', 'trace-requirement',
    'codebase analyze', 'codebase status', 'codebase conventions', 'codebase rules',
    'codebase deps', 'codebase impact', 'codebase context', 'codebase lifecycle',
    'codebase ast', 'codebase exports', 'codebase complexity', 'codebase repo-map',
    'cache status', 'cache clear', 'cache warm',
    'agent audit', 'agent list'
  ];
  for (const s of utilSubs) {
    commands.set(`util:${s.replace(/\s+/g, ' ')}`, { namespace: 'util', subcommand: s });
  }

  // research namespace
  const researchSubs = [
    'capabilities', 'yt-search', 'yt-transcript', 'collect',
    'nlm-create', 'nlm-add-source', 'nlm-ask', 'nlm-report'
  ];
  for (const s of researchSubs) {
    commands.set(`research:${s}`, { namespace: 'research', subcommand: s });
  }

  // cache namespace (top-level)
  const cacheSubs = ['research-stats', 'research-clear', 'status', 'clear', 'warm'];
  for (const s of cacheSubs) {
    commands.set(`cache:${s}`, { namespace: 'cache', subcommand: s });
  }

  // Legacy top-level commands (still supported via backward-compat switch)
  const legacyCmds = [
    'state', 'resolve-model', 'find-phase', 'commit', 'verify-summary',
    'template select', 'template fill', 'frontmatter get', 'frontmatter set',
    'frontmatter merge', 'frontmatter validate',
    'verify plan-structure', 'verify phase-completeness', 'verify references',
    'verify commits', 'verify artifacts', 'verify key-links', 'verify analyze-plan',
    'verify deliverables', 'verify requirements', 'verify regression',
    'verify plan-wave', 'verify plan-deps', 'verify quality',
    'generate-slug', 'current-timestamp', 'list-todos', 'verify-path-exists',
    'config-ensure-section', 'config-set', 'config-get', 'config-migrate',
    'history-digest', 'phases list',
    'roadmap get-phase', 'roadmap analyze', 'roadmap update-plan-progress',
    'requirements mark-complete',
    'phase next-decimal', 'phase add', 'phase insert', 'phase remove', 'phase complete',
    'milestone complete', 'validate consistency', 'validate health', 'validate roadmap',
    'progress', 'todo complete', 'scaffold',
    'init execute-phase', 'init plan-phase', 'init new-project', 'init new-milestone',
    'init quick', 'init resume', 'init verify-work', 'init phase-op',
    'init todos', 'init milestone-op', 'init map-codebase', 'init progress', 'init memory',
    'phase-plan-index', 'state-snapshot', 'summary-extract', 'websearch',
    'session-diff', 'session-summary', 'context-budget', 'context-budget baseline',
    'context-budget compare', 'context-budget measure',
    'test-run', 'search-decisions', 'validate-dependencies', 'search-lessons',
    'codebase analyze', 'codebase status', 'codebase conventions', 'codebase rules',
    'codebase deps', 'codebase impact', 'codebase context', 'codebase lifecycle',
    'codebase ast', 'codebase exports', 'codebase complexity', 'codebase repo-map',
    'codebase-impact', 'rollback-info', 'velocity', 'trace-requirement',
    'validate-config', 'quick-summary', 'extract-sections', 'test-coverage', 'token-budget',
    'memory write', 'memory read', 'memory list', 'memory ensure-dir', 'memory compact',
    'intent create', 'intent show', 'intent read', 'intent update',
    'intent validate', 'intent trace', 'intent drift',
    'env scan', 'env status', 'mcp-profile', 'mcp profile',
    'assertions list', 'assertions validate',
    'worktree create', 'worktree list', 'worktree remove', 'worktree cleanup',
    'worktree merge', 'worktree check-overlap',
    'agent audit', 'agent list',
    'git log', 'git diff-summary', 'git blame', 'git branch-info', 'git rewind',
    'git trajectory-branch',
    'review', 'tdd',
    'classify plan', 'classify phase',
    'trajectory checkpoint', 'trajectory list', 'trajectory pivot',
    'trajectory compare', 'trajectory choose', 'trajectory dead-ends',
    'cache status', 'cache clear', 'cache warm',
    'research capabilities', 'research yt-search', 'research yt-transcript',
    'profiler compare', 'profiler cache-speedup'
  ];
  for (const cmd of legacyCmds) {
    if (!commands.has(cmd)) {
      commands.set(cmd, { namespace: null, subcommand: cmd });
    }
  }

  return commands;
}

// ─── 2. Scan markdown files for gsd-tools invocations ─────────────────────────
function scanMarkdownFiles() {
  const dirs = [
    { dir: path.join(__dirname, 'workflows'), label: 'workflows' },
    { dir: path.join(__dirname, 'commands'), label: 'commands' },
    { dir: path.join(__dirname, 'templates'), label: 'templates' },
    { dir: path.join(__dirname, 'references'), label: 'references' },
  ];

  // Check for .agents directory
  const agentsDir = path.join(__dirname, '.agents');
  if (fs.existsSync(agentsDir)) {
    dirs.push({ dir: agentsDir, label: '.agents' });
  }

  const files = [];
  for (const { dir, label } of dirs) {
    if (!fs.existsSync(dir)) continue;
    collectMdFiles(dir, label, files);
  }
  return files;
}

function collectMdFiles(dir, label, files) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMdFiles(fullPath, label, files);
    } else if (entry.name.endsWith('.md')) {
      files.push({ path: fullPath, relative: path.relative(__dirname, fullPath), label });
    }
  }
}

// ─── 3. Extract gsd-tools command invocations from markdown ──────────────────
function extractInvocations(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const invocations = [];

  // Match patterns:
  // gsd-tools <command>
  // gsd-tools.cjs <command>
  // $GSD_HOME/bin/gsd-tools.cjs <command>
  // node $GSD_HOME/bin/gsd-tools.cjs <command>
  // {config_path}/bin/gsd-tools.cjs <command>
  // node /path/to/gsd-tools.cjs <command>
  // __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs <command> (mangled by auth plugin)
  const re = /(?:gsd-tools(?:\.cjs)?|(?:node\s+)?(?:\$GSD_HOME|\$\{GSD_HOME\}|\{config_path\}|__[A-Z_]+__\/[^\s]*?|\/[^\s]*?)\/bin\/gsd-tools\.cjs)\s+([\w:_-]+(?:\s+[\w:_-]+)?(?:\s+[\w:_-]+)?)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    // Reset regex lastIndex for each line since we use a new exec loop
    const lineRe = new RegExp(re.source, 'g');
    while ((match = lineRe.exec(line)) !== null) {
      const raw = match[1].trim();
      // Normalize: take up to 3 words (command + subcommand + sub-sub)
      // but stop at flags (--xxx) or known non-command tokens
      const parts = raw.split(/\s+/).filter(p => !p.startsWith('--') && !p.startsWith('$') && !p.startsWith('"') && !p.startsWith("'") && !p.startsWith('{'));
      if (parts.length === 0) continue;

      // Build candidate command strings
      // Try: "namespace:sub sub2" or "cmd sub" patterns
      const candidates = [];
      if (parts.length >= 3) candidates.push(parts.slice(0, 3).join(' '));
      if (parts.length >= 2) candidates.push(parts.slice(0, 2).join(' '));
      candidates.push(parts[0]);

      // Also try colon-joined: "init execute-phase" → "init:execute-phase"
      if (parts.length >= 2 && !parts[0].includes(':')) {
        candidates.push(`${parts[0]}:${parts[1]}`);
        if (parts.length >= 3) {
          candidates.push(`${parts[0]}:${parts[1]} ${parts[2]}`);
        }
      }

      invocations.push({
        line: i + 1,
        raw,
        candidates
      });
    }
  }

  return invocations;
}

// ─── 4. Build cross-reference map ────────────────────────────────────────────
function buildCommandMap() {
  const commands = parseRouterCommands();
  const mdFiles = scanMarkdownFiles();

  // For each command, track its markdown consumers
  const commandMap = {};
  for (const [cmdKey] of commands) {
    commandMap[cmdKey] = {
      consumers: [],
      consumer_count: 0
    };
  }

  let totalMdFiles = mdFiles.length;

  for (const mdFile of mdFiles) {
    const invocations = extractInvocations(mdFile.path);

    for (const inv of invocations) {
      // Try to match against known commands
      let matched = false;
      for (const candidate of inv.candidates) {
        // Exact match
        if (commandMap[candidate] !== undefined) {
          const existing = commandMap[candidate].consumers.find(c => c.file === mdFile.relative);
          if (existing) {
            existing.count++;
            existing.lines.push(inv.line);
          } else {
            commandMap[candidate].consumers.push({
              file: mdFile.relative,
              count: 1,
              lines: [inv.line]
            });
          }
          matched = true;
          break;
        }

        // Try namespace:subcommand mapping
        // e.g., "verify:state advance-plan" should match invocations like "verify:state advance-plan"
        // or "state advance-plan" for legacy commands
        const colonForm = candidate.replace(/\s+/, ':');
        if (commandMap[colonForm] !== undefined) {
          const existing = commandMap[colonForm].consumers.find(c => c.file === mdFile.relative);
          if (existing) {
            existing.count++;
            existing.lines.push(inv.line);
          } else {
            commandMap[colonForm].consumers.push({
              file: mdFile.relative,
              count: 1,
              lines: [inv.line]
            });
          }
          matched = true;
          break;
        }
      }
    }
  }

  // Update consumer counts
  for (const key of Object.keys(commandMap)) {
    commandMap[key].consumer_count = commandMap[key].consumers.length;
  }

  // Find orphan commands (no markdown consumers)
  const orphanCommands = Object.keys(commandMap).filter(k => commandMap[k].consumer_count === 0);

  // Find most referenced
  let mostReferenced = { command: '', count: 0 };
  for (const [key, val] of Object.entries(commandMap)) {
    const totalRefs = val.consumers.reduce((sum, c) => sum + c.count, 0);
    if (totalRefs > mostReferenced.count) {
      mostReferenced = { command: key, count: totalRefs };
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    total_commands: Object.keys(commandMap).length,
    total_markdown_files: totalMdFiles,
    commands: commandMap,
    orphan_commands: orphanCommands,
    summary: {
      commands_with_consumers: Object.keys(commandMap).length - orphanCommands.length,
      commands_without_consumers: orphanCommands.length,
      most_referenced: mostReferenced
    }
  };

  // Write report
  const outDir = path.join(__dirname, '.planning', 'baselines', 'audit');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'command-reference-map.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

  // Print summary
  const sep = '\u2500'.repeat(21);
  console.log('');
  console.log('Command Reference Map');
  console.log(sep);
  console.log(`Total CLI commands: ${report.total_commands}`);
  console.log(`Referenced in markdown: ${report.summary.commands_with_consumers}`);
  console.log(`Orphan commands (no markdown refs): ${report.summary.commands_without_consumers}`);
  console.log(`Most referenced: ${mostReferenced.command} (${mostReferenced.count} refs)`);
  console.log(`Report: .planning/baselines/audit/command-reference-map.json`);
  console.log('');

  return report;
}

// ─── 5. Produce final audit summary ──────────────────────────────────────────
function buildAuditSummary() {
  // Load reports
  const auditDir = path.join(__dirname, '.planning', 'baselines', 'audit');
  const deadCodePath = path.join(auditDir, 'dead-code-report.json');
  const cmdMapPath = path.join(auditDir, 'command-reference-map.json');
  const circularPath = path.join(auditDir, 'circular-deps-report.json');

  if (!fs.existsSync(deadCodePath)) {
    console.error('Error: dead-code-report.json not found. Run audit-exports.js first.');
    process.exit(1);
  }
  if (!fs.existsSync(cmdMapPath)) {
    console.error('Error: command-reference-map.json not found. Run audit-commands.js map first.');
    process.exit(1);
  }

  const deadCode = JSON.parse(fs.readFileSync(deadCodePath, 'utf-8'));
  const cmdMap = JSON.parse(fs.readFileSync(cmdMapPath, 'utf-8'));
  const circular = fs.existsSync(circularPath)
    ? JSON.parse(fs.readFileSync(circularPath, 'utf-8'))
    : { has_cycles: false, cycles: [] };

  // Cross-reference: check if "truly_dead" or "internal_helper" exports are actually
  // cmd* functions consumed via markdown workflows through the router
  const classification = {
    router_consumed: [...deadCode.classification.router_consumed],
    cross_module: [...deadCode.classification.cross_module],
    markdown_only: [],
    documented_helper: [],
    truly_dead: [],
  };

  // Build a set of commands that have markdown consumers
  const commandsWithConsumers = new Set();
  for (const [cmdKey, cmdVal] of Object.entries(cmdMap.commands)) {
    if (cmdVal.consumer_count > 0) {
      commandsWithConsumers.add(cmdKey);
    }
  }

  // Helper: extract all function names referenced in markdown
  const mdFunctionRefs = new Set();
  for (const [, cmdVal] of Object.entries(cmdMap.commands)) {
    for (const consumer of cmdVal.consumers) {
      // We track command strings, not function names. We'll check function names separately.
    }
  }

  // Scan all markdown files for function name references
  const mdFiles = scanMarkdownFiles();
  for (const mdFile of mdFiles) {
    try {
      const content = fs.readFileSync(mdFile.path, 'utf-8');
      // Check for function name references like parseVtt, BINARY_EXTENSIONS, etc.
      for (const exp of [...deadCode.classification.internal_helper, ...deadCode.classification.truly_dead]) {
        const nameRe = new RegExp('\\b' + exp.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        if (nameRe.test(content)) {
          mdFunctionRefs.add(exp.name);
        }
      }
    } catch (_) {
      // skip unreadable files
    }
  }

  // Reclassify truly_dead exports
  for (const exp of deadCode.classification.truly_dead) {
    if (exp.name.startsWith('cmd')) {
      // Check if the corresponding command has markdown consumers
      // Map cmdXxx to a command route by looking at the router
      // Since this is a cmd* function that was already classified as truly_dead,
      // it means the router doesn't reference it. But let's double check for
      // markdown doc refs
      if (mdFunctionRefs.has(exp.name)) {
        classification.documented_helper.push({ ...exp, reason: 'function name referenced in markdown docs' });
      } else {
        classification.truly_dead.push(exp);
      }
    } else {
      if (mdFunctionRefs.has(exp.name)) {
        classification.documented_helper.push({ ...exp, reason: 'referenced by name in markdown docs' });
      } else {
        classification.truly_dead.push(exp);
      }
    }
  }

  // Reclassify internal_helper exports
  const internalHelpers = [];
  for (const exp of deadCode.classification.internal_helper) {
    if (mdFunctionRefs.has(exp.name)) {
      classification.documented_helper.push({ ...exp, reason: 'helper referenced in markdown docs' });
    } else {
      internalHelpers.push(exp);
    }
  }

  // Recalculate totals — internal_helpers stay as internal_helpers (not in new classification output)
  // The plan says classification should have: router_consumed, cross_module, markdown_only, documented_helper, truly_dead
  // But we also need to track internal_helpers since they're a big chunk
  // Let's keep them separate but include in the count

  const totalClassified = classification.router_consumed.length +
    classification.cross_module.length +
    classification.markdown_only.length +
    classification.documented_helper.length +
    internalHelpers.length +
    classification.truly_dead.length;

  // Build Phase 63 removal candidates
  const removalCandidates = {
    exports: classification.truly_dead.map(exp => ({
      name: exp.name,
      file: exp.file,
      line: exp.line,
      confidence: 'high'
    })),
    files: deadCode.unused_files || [],
    total_removable_exports: classification.truly_dead.length,
    total_removable_files: (deadCode.unused_files || []).length
  };

  const summary = {
    generated_at: new Date().toISOString(),
    phase: '62-audit-discovery',
    reports_combined: ['dead-code-report.json', 'command-reference-map.json', 'circular-deps-report.json'],
    circular_deps: { has_cycles: circular.has_cycles, cycle_count: circular.cycles.length },
    unused_files: (deadCode.unused_files || []).map(f => ({
      path: typeof f === 'string' ? f : f.path,
      reason: 'no JS imports, check markdown refs'
    })),
    export_classification: {
      router_consumed: {
        count: classification.router_consumed.length,
        action: 'none \u2014 consumed via lazy loading'
      },
      cross_module: {
        count: classification.cross_module.length,
        action: 'none \u2014 used by sibling modules'
      },
      internal_helper: {
        count: internalHelpers.length,
        action: 'review \u2014 used within same file but exported unnecessarily',
        exports: internalHelpers.map(e => ({ name: e.name, file: e.file, line: e.line }))
      },
      markdown_only: {
        count: classification.markdown_only.length,
        action: 'review \u2014 used by markdown workflows but invisible to JS analysis',
        exports: classification.markdown_only.map(e => ({ name: e.name, file: e.file, line: e.line }))
      },
      documented_helper: {
        count: classification.documented_helper.length,
        action: 'review \u2014 referenced in markdown docs',
        exports: classification.documented_helper.map(e => ({ name: e.name, file: e.file, line: e.line, reason: e.reason }))
      },
      truly_dead: {
        count: classification.truly_dead.length,
        action: 'remove in Phase 63',
        exports: classification.truly_dead.map(e => ({ name: e.name, file: e.file, line: e.line }))
      }
    },
    phase_63_removal_candidates: removalCandidates,
    orphan_commands: {
      count: cmdMap.orphan_commands.length,
      commands: cmdMap.orphan_commands,
      action: 'review \u2014 CLI commands with no markdown consumers'
    },
    knip_total: deadCode.knip_total_unused,
    classification_total: totalClassified
  };

  // Write report
  const outPath = path.join(auditDir, 'audit-summary.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');

  // Print summary
  const sep = '\u2550'.repeat(24);
  console.log('');
  console.log('Audit Summary \u2014 Phase 62');
  console.log(sep);
  console.log(`Circular deps: ${circular.cycles.length} cycles ${circular.has_cycles ? '\u2717' : '\u2713'}`);
  console.log(`Unused files: ${(deadCode.unused_files || []).length}`);
  console.log('');
  console.log(`Export Classification (${deadCode.knip_total_unused} knip-reported):`);
  console.log(`  Router-consumed (safe):    ${classification.router_consumed.length}`);
  console.log(`  Cross-module (safe):       ${classification.cross_module.length}`);
  console.log(`  Internal helper (review):  ${internalHelpers.length}`);
  console.log(`  Markdown-only (review):    ${classification.markdown_only.length}`);
  console.log(`  Documented helper (review): ${classification.documented_helper.length}`);
  console.log(`  Truly dead (remove):       ${classification.truly_dead.length}`);
  console.log(`  Classification total:      ${totalClassified}`);
  console.log('');
  console.log('Phase 63 Removal Candidates:');
  console.log(`  Exports: ${removalCandidates.total_removable_exports}`);
  console.log(`  Files: ${removalCandidates.total_removable_files}`);
  console.log('');
  console.log(`Orphan Commands (no markdown refs): ${cmdMap.orphan_commands.length}`);
  console.log('');
  console.log(`Full report: .planning/baselines/audit/audit-summary.json`);
  console.log('');

  return summary;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────
const subcommand = process.argv[2];

if (subcommand === 'map') {
  buildCommandMap();
} else if (subcommand === 'summary') {
  buildAuditSummary();
} else {
  // Default: run both
  buildCommandMap();
  buildAuditSummary();
}
