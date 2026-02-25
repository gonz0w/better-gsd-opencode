const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { loadConfig } = require('../lib/config');
const { execGit } = require('../lib/git');
const { parseIntentMd, generateIntentMd } = require('../lib/helpers');

// ─── Intent Commands ─────────────────────────────────────────────────────────

function cmdIntentCreate(cwd, args, raw) {
  const planningDir = path.join(cwd, '.planning');

  // Guard: .planning/ must exist
  if (!fs.existsSync(planningDir)) {
    error('.planning/ directory not found. Run project initialization first.');
  }

  const intentPath = path.join(planningDir, 'INTENT.md');
  const force = args.includes('--force');

  // Check existence
  if (fs.existsSync(intentPath) && !force) {
    error('INTENT.md already exists. Use --force to overwrite.');
  }

  // Parse CLI flags for section content
  const getFlag = (flag) => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return null;
    return args[idx + 1];
  };

  const getMultiFlag = (flag) => {
    const idx = args.indexOf(flag);
    if (idx === -1) return [];
    const values = [];
    for (let i = idx + 1; i < args.length; i++) {
      if (args[i].startsWith('--')) break;
      values.push(args[i]);
    }
    return values;
  };

  const now = new Date().toISOString().split('T')[0];

  // Build data structure
  const data = {
    revision: 1,
    created: now,
    updated: now,
    objective: { statement: '', elaboration: '' },
    users: [],
    outcomes: [],
    criteria: [],
    constraints: { technical: [], business: [], timeline: [] },
    health: { quantitative: [], qualitative: '' },
  };

  // Populate from flags if provided
  const objectiveText = getFlag('--objective');
  if (objectiveText) {
    const parts = objectiveText.split('\n');
    data.objective.statement = parts[0] || '';
    data.objective.elaboration = parts.slice(1).join('\n').trim();
  }

  const userArgs = getMultiFlag('--users');
  for (const u of userArgs) {
    data.users.push({ text: u });
  }

  const outcomeArgs = getMultiFlag('--outcomes');
  for (const o of outcomeArgs) {
    const match = o.match(/^(DO-\d+)\s+\[(P[123])\]:\s*(.+)$/);
    if (match) {
      data.outcomes.push({ id: match[1], priority: match[2], text: match[3] });
    }
  }

  const criteriaArgs = getMultiFlag('--criteria');
  for (const c of criteriaArgs) {
    const match = c.match(/^(SC-\d+):\s*(.+)$/);
    if (match) {
      data.criteria.push({ id: match[1], text: match[2] });
    }
  }

  // Generate INTENT.md content
  const content = generateIntentMd(data);

  // Write file
  fs.writeFileSync(intentPath, content, 'utf-8');

  // Build section list for output
  const sections = ['objective', 'users', 'outcomes', 'criteria', 'constraints', 'health'];

  // Auto-commit if commit_docs enabled
  const config = loadConfig(cwd);
  let commitHash = null;
  if (config.commit_docs) {
    execGit(cwd, ['add', '.planning/INTENT.md']);
    const commitResult = execGit(cwd, ['commit', '-m', 'docs(intent): create INTENT.md']);
    if (commitResult.exitCode === 0) {
      const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
      commitHash = hashResult.exitCode === 0 ? hashResult.stdout : null;
    }
  }

  const result = {
    created: true,
    path: '.planning/INTENT.md',
    revision: 1,
    sections,
    commit: commitHash,
  };

  output(result, raw, commitHash || 'created');
}

// ─── Intent Show / Read ──────────────────────────────────────────────────────

const SECTION_ALIASES = ['objective', 'users', 'outcomes', 'criteria', 'constraints', 'health'];

function cmdIntentShow(cwd, args, raw) {
  const planningDir = path.join(cwd, '.planning');
  const intentPath = path.join(planningDir, 'INTENT.md');

  if (!fs.existsSync(intentPath)) {
    error('No INTENT.md found. Run `intent create` first.');
  }

  const content = fs.readFileSync(intentPath, 'utf-8');
  const data = parseIntentMd(content);

  // Check for section filter (first positional arg after subcommand)
  const sectionFilter = args.length > 0 && SECTION_ALIASES.includes(args[0]) ? args[0] : null;
  const fullFlag = args.includes('--full');

  // JSON output mode (--raw flag or invoked as "intent read")
  if (raw) {
    if (sectionFilter) {
      // Return just that section's data
      const sectionData = {};
      sectionData[sectionFilter] = data[sectionFilter];
      output(sectionData, false);
    } else {
      output(data, false);
    }
    return;
  }

  // Human-readable output
  if (fullFlag) {
    // Render complete INTENT.md content
    output(null, true, content);
    return;
  }

  if (sectionFilter) {
    // Show just that section's full content
    const sectionContent = renderSection(data, sectionFilter);
    output(null, true, sectionContent);
    return;
  }

  // Default: compact summary (10-20 lines)
  const summary = renderCompactSummary(data);
  output(null, true, summary);
}

/**
 * Render a compact summary of INTENT.md (target 10-20 lines).
 * Sorts outcomes by priority (P1 first).
 */
function renderCompactSummary(data) {
  const lines = [];
  const isTTY = process.stdout.isTTY;

  // Header
  const updated = data.updated || 'unknown';
  lines.push(`INTENT — Revision ${data.revision || '?'} (updated ${updated})`);
  lines.push('');

  // Objective (truncated to ~80 chars)
  const obj = data.objective.statement || '(not set)';
  const truncObj = obj.length > 80 ? obj.slice(0, 77) + '...' : obj;
  lines.push(`Objective: ${truncObj}`);
  lines.push('');

  // Outcomes with priority sorting
  if (data.outcomes.length > 0) {
    const sorted = [...data.outcomes].sort((a, b) => {
      const pa = parseInt(a.priority.replace('P', ''), 10);
      const pb = parseInt(b.priority.replace('P', ''), 10);
      return pa - pb;
    });

    // Count by priority
    const counts = { P1: 0, P2: 0, P3: 0 };
    for (const o of sorted) {
      if (counts[o.priority] !== undefined) counts[o.priority]++;
    }
    const countParts = [];
    if (counts.P1 > 0) countParts.push(`${counts.P1}×P1`);
    if (counts.P2 > 0) countParts.push(`${counts.P2}×P2`);
    if (counts.P3 > 0) countParts.push(`${counts.P3}×P3`);

    lines.push(`Outcomes (${sorted.length}): ${countParts.join('  ')}`);
    for (const o of sorted) {
      const priorityLabel = colorPriority(o.priority, isTTY);
      lines.push(`  ${priorityLabel}: ${o.id} — ${o.text}`);
    }
  } else {
    lines.push('Outcomes: none defined');
  }
  lines.push('');

  // Success Criteria count
  lines.push(`Success Criteria: ${data.criteria.length} defined`);

  // Constraints breakdown
  const techCount = data.constraints.technical.length;
  const bizCount = data.constraints.business.length;
  const timeCount = data.constraints.timeline.length;
  lines.push(`Constraints: ${techCount} technical, ${bizCount} business, ${timeCount} timeline`);

  // Health metrics breakdown
  const quantCount = data.health.quantitative.length;
  const hasQual = data.health.qualitative && data.health.qualitative.trim() ? 'defined' : 'none';
  lines.push(`Health Metrics: ${quantCount} quantitative, qualitative ${hasQual}`);

  // Target users
  lines.push(`Target Users: ${data.users.length} audience${data.users.length !== 1 ? 's' : ''}`);

  return lines.join('\n') + '\n';
}

/**
 * Render a single section's full content.
 */
function renderSection(data, section) {
  const isTTY = process.stdout.isTTY;
  const lines = [];

  switch (section) {
    case 'objective':
      lines.push('## Objective');
      lines.push('');
      lines.push(data.objective.statement || '(not set)');
      if (data.objective.elaboration) {
        lines.push('');
        lines.push(data.objective.elaboration);
      }
      break;

    case 'users':
      lines.push('## Target Users');
      lines.push('');
      if (data.users.length > 0) {
        for (const u of data.users) {
          lines.push(`- ${u.text}`);
        }
      } else {
        lines.push('(none defined)');
      }
      break;

    case 'outcomes':
      lines.push('## Desired Outcomes');
      lines.push('');
      if (data.outcomes.length > 0) {
        const sorted = [...data.outcomes].sort((a, b) => {
          const pa = parseInt(a.priority.replace('P', ''), 10);
          const pb = parseInt(b.priority.replace('P', ''), 10);
          return pa - pb;
        });
        for (const o of sorted) {
          const priorityLabel = colorPriority(o.priority, isTTY);
          lines.push(`- ${o.id} [${priorityLabel}]: ${o.text}`);
        }
      } else {
        lines.push('(none defined)');
      }
      break;

    case 'criteria':
      lines.push('## Success Criteria');
      lines.push('');
      if (data.criteria.length > 0) {
        for (const c of data.criteria) {
          lines.push(`- ${c.id}: ${c.text}`);
        }
      } else {
        lines.push('(none defined)');
      }
      break;

    case 'constraints':
      lines.push('## Constraints');
      if (data.constraints.technical.length > 0) {
        lines.push('');
        lines.push('### Technical');
        for (const c of data.constraints.technical) {
          lines.push(`- ${c.id}: ${c.text}`);
        }
      }
      if (data.constraints.business.length > 0) {
        lines.push('');
        lines.push('### Business');
        for (const c of data.constraints.business) {
          lines.push(`- ${c.id}: ${c.text}`);
        }
      }
      if (data.constraints.timeline.length > 0) {
        lines.push('');
        lines.push('### Timeline');
        for (const c of data.constraints.timeline) {
          lines.push(`- ${c.id}: ${c.text}`);
        }
      }
      if (data.constraints.technical.length === 0 && data.constraints.business.length === 0 && data.constraints.timeline.length === 0) {
        lines.push('');
        lines.push('(none defined)');
      }
      break;

    case 'health':
      lines.push('## Health Metrics');
      if (data.health.quantitative.length > 0) {
        lines.push('');
        lines.push('### Quantitative');
        for (const m of data.health.quantitative) {
          lines.push(`- ${m.id}: ${m.text}`);
        }
      }
      if (data.health.qualitative && data.health.qualitative.trim()) {
        lines.push('');
        lines.push('### Qualitative');
        lines.push(data.health.qualitative);
      }
      if (data.health.quantitative.length === 0 && (!data.health.qualitative || !data.health.qualitative.trim())) {
        lines.push('');
        lines.push('(none defined)');
      }
      break;
  }

  return lines.join('\n') + '\n';
}

/**
 * Apply ANSI color to priority labels (only when TTY).
 * P1 = red, P2 = yellow, P3 = dim.
 */
function colorPriority(priority, isTTY) {
  if (!isTTY) return priority;
  switch (priority) {
    case 'P1': return '\x1b[31mP1\x1b[0m';
    case 'P2': return '\x1b[33mP2\x1b[0m';
    case 'P3': return '\x1b[2mP3\x1b[0m';
    default: return priority;
  }
}

module.exports = {
  cmdIntentCreate,
  cmdIntentShow,
};
