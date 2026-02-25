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

module.exports = {
  cmdIntentCreate,
};
