'use strict';

const fs = require('fs');
const path = require('path');
const { output, debugLog } = require('../../lib/output');
const { safeReadFile, cachedReadFile, findPhaseInternal, normalizePhaseName } = require('../../lib/helpers');
const { extractFrontmatter } = require('../../lib/frontmatter');
const { validateCommandIntegrity } = require('../../lib/commandDiscovery');
const { banner, color } = require('../../lib/format');
const { getRuntimeFreshness } = require('../../lib/helpers');

function parseTaskFiles(filesBlock) {
  if (!filesBlock) return [];
  return filesBlock
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

function parsePlanTasks(content) {
  const taskPattern = /<task([^>]*)>([\s\S]*?)<\/task>/g;
  const tasks = [];
  let taskMatch;

  while ((taskMatch = taskPattern.exec(content)) !== null) {
    const attrs = taskMatch[1] || '';
    const taskContent = taskMatch[2];
    const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
    const filesMatch = taskContent.match(/<files>([\s\S]*?)<\/files>/);
    const actionMatch = taskContent.match(/<action>([\s\S]*?)<\/action>/);
    const verifyMatch = taskContent.match(/<verify>([\s\S]*?)<\/verify>/);
    const doneMatch = taskContent.match(/<done>([\s\S]*?)<\/done>/);

    tasks.push({
      type: (attrs.match(/type=["']([^"']+)["']/) || [])[1] || 'auto',
      name: nameMatch ? nameMatch[1].trim() : 'unnamed',
      files: parseTaskFiles(filesMatch ? filesMatch[1] : ''),
      action: actionMatch ? actionMatch[1].trim() : '',
      verify: verifyMatch ? verifyMatch[1].trim() : '',
      done: doneMatch ? doneMatch[1].trim() : '',
      hasFiles: Boolean(filesMatch),
      hasAction: Boolean(actionMatch),
      hasVerify: Boolean(verifyMatch),
      hasDone: Boolean(doneMatch),
    });
  }

  return tasks;
}

function extractTaggedBlock(content, tagName) {
  if (!content || !tagName) return '';
  const match = content.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? match[1].trim() : '';
}

function normalizeCommandWhitespace(command) {
  return String(command || '')
    .replace(/```(?:[a-z0-9_-]+)?/gi, ' ')
    .replace(/```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeCommand(command) {
  return normalizeCommandWhitespace(command).match(/(?:"[^"]+"|'[^']+'|`[^`]+`|\S+)/g) || [];
}

function normalizeVerificationSignature(command) {
  const normalized = normalizeCommandWhitespace(command);
  if (!normalized) return '';

  const tokens = tokenizeCommand(normalized);
  const lowered = tokens.map((token) => token.toLowerCase());

  if (lowered[0] === 'npm' && lowered[1] === 'run' && lowered[2] === 'test:file' && lowered[3] === '--') {
    return ['npm', 'run', 'test:file', '--', ...tokens.slice(4).sort()].join(' ');
  }

  if (lowered[0] === 'node' && lowered[1] === '--test') {
    const optionTokens = [];
    const fileTokens = [];
    for (let i = 2; i < tokens.length; i += 1) {
      if (tokens[i].startsWith('-')) optionTokens.push(tokens[i]);
      else fileTokens.push(tokens[i]);
    }
    return ['node', '--test', ...optionTokens, ...fileTokens.sort()].join(' ').trim();
  }

  return normalized.toLowerCase();
}

function extractTaskVerificationCommands(verifyBlock) {
  if (!verifyBlock) return [];

  const commands = [];
  const seen = new Set();
  const addCommand = (value) => {
    const normalized = normalizeCommandWhitespace(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    commands.push(normalized);
  };

  const codeMatches = [...String(verifyBlock).matchAll(/```(?:[a-z0-9_-]+)?\n([\s\S]*?)```/gi)];
  if (codeMatches.length > 0) {
    for (const match of codeMatches) {
      for (const line of match[1].split('\n').map((entry) => entry.trim()).filter(Boolean)) {
        addCommand(line);
      }
    }
    return commands;
  }

  addCommand(verifyBlock);
  return commands;
}

function extractPlanVerificationCommands(content) {
  const block = extractTaggedBlock(content, 'verification');
  if (!block) return [];

  const commands = [];
  const seen = new Set();
  const addCommand = (value) => {
    const normalized = normalizeCommandWhitespace(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    commands.push(normalized);
  };

  const codeMatches = [...block.matchAll(/```(?:[a-z0-9_-]+)?\n([\s\S]*?)```/gi)];
  for (const match of codeMatches) {
    for (const line of match[1].split('\n').map((entry) => entry.trim()).filter(Boolean)) {
      addCommand(line);
    }
  }

  for (const line of block.split('\n')) {
    const runMatch = line.trim().match(/^(?:[-*]|\d+\.)\s*Run:\s*(.+)$/i);
    if (runMatch) addCommand(runMatch[1]);
  }

  return commands;
}

function isBuildVerificationCommand(command) {
  const normalized = normalizeCommandWhitespace(command).toLowerCase();
  return /^(npm run build|pnpm build|yarn build|bun run build)(?:\s|$)/.test(normalized);
}

function isTestVerificationCommand(command) {
  const normalized = normalizeCommandWhitespace(command).toLowerCase();
  return /^(npm run test:file|npm test|pnpm test|yarn test|bun test|node --test|pytest|cargo test|go test)(?:\s|$)/.test(normalized);
}

function describeVerificationLocation(entry) {
  return entry.scope === 'plan' ? '<verification>' : `task '${entry.task}'`;
}

function walkWorkspaceFiles(rootPath, currentPath = rootPath, collected = []) {
  if (!fs.existsSync(currentPath)) return collected;
  const stat = fs.statSync(currentPath);
  if (!stat.isDirectory()) {
    collected.push(path.relative(rootPath, currentPath).replace(/\\/g, '/'));
    return collected;
  }

  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    if (entry.isDirectory() && ['.git', '.jj', 'node_modules'].includes(entry.name)) continue;
    walkWorkspaceFiles(rootPath, path.join(currentPath, entry.name), collected);
  }

  return collected;
}

function hasGlobSyntax(candidate) {
  return /[*?\[\]{}]/.test(candidate || '');
}

function globToRegex(pattern) {
  const normalized = pattern.replace(/\\/g, '/');
  let regex = '^';
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === '*') {
      if (normalized[i + 1] === '*') {
        regex += '.*';
        i += 1;
      } else {
        regex += '[^/]*';
      }
    } else if (char === '?') {
      regex += '.';
    } else if ('\\.^$+()|{}'.includes(char)) {
      regex += `\\${char}`;
    } else {
      regex += char;
    }
  }
  regex += '$';
  return new RegExp(regex);
}

function matchWorkspaceGlob(cwd, pattern) {
  const matcher = globToRegex(pattern);
  return walkWorkspaceFiles(cwd).filter((candidate) => matcher.test(candidate));
}

function cleanCommandToken(token) {
  return token.replace(/^['"`]/, '').replace(/['"`,.;:)]$/, '').trim();
}

function extractCommandPathCandidates(command) {
  if (!command) return [];
  const tokens = command.match(/(?:"[^"]+"|'[^']+'|`[^`]+`|\S+)/g) || [];
  const seen = new Set();
  const paths = [];

  for (const rawToken of tokens) {
    const token = cleanCommandToken(rawToken);
    if (!token || token.startsWith('-') || token.startsWith('$') || token.startsWith('http')) continue;
    if (/^(node|nodejs|npm|pnpm|yarn|bun|npx|jj|git|bash|sh|python|python3|pytest|cargo|go|mix)$/.test(token)) continue;
    if (!(/[\\/]/.test(token) || /\.[a-z0-9]+$/i.test(token))) continue;
    if (!seen.has(token)) {
      seen.add(token);
      paths.push(token.replace(/^\.\//, ''));
    }
  }

  return paths;
}

function analyzePlanRealism(cwd, fullPath, content, tasks, filesModified) {
  const issues = [];
  const warnings = [];
  const touchedPaths = [];
  const taskFileOrder = new Map();
  const relativePlanPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
  const verificationCommands = [];

  const pushPathIssue = (severity, issue) => {
    (severity === 'warning' ? warnings : issues).push(issue);
  };

  const validatePathReference = (filePath, source, taskName) => {
    if (!filePath) return;
    const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    touchedPaths.push({ path: normalized, source, task: taskName || null });

    if (hasGlobSyntax(normalized)) {
      const matches = matchWorkspaceGlob(cwd, normalized);
      if (matches.length === 0) {
        pushPathIssue('blocker', {
          kind: 'stale-path',
          source,
          task: taskName || null,
          path: normalized,
          message: `${source} references glob ${normalized} but it matches no files in the current repo`,
        });
      }
      return;
    }

    const absolutePath = path.join(cwd, normalized);
    if (fs.existsSync(absolutePath)) return;

    const parentDir = path.dirname(absolutePath);
    if (!fs.existsSync(parentDir)) {
      pushPathIssue('blocker', {
        kind: 'stale-path',
        source,
        task: taskName || null,
        path: normalized,
        message: `${source} references ${normalized} but parent directory ${path.relative(cwd, parentDir).replace(/\\/g, '/')} does not exist`,
      });
    }
  };

  for (const filePath of filesModified) validatePathReference(filePath, 'files_modified', null);

  tasks.forEach((task, index) => {
    for (const filePath of task.files) {
      validatePathReference(filePath, 'task.files', task.name);
      const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
      if (!taskFileOrder.has(normalized)) taskFileOrder.set(normalized, index);
    }
  });

  const commandValidation = validateCommandIntegrity({
    cwd,
    surfaces: [{ surface: 'plan', path: relativePlanPath, content }],
  });
  for (const commandIssue of commandValidation.issues) {
    issues.push({
      kind: commandIssue.kind,
      source: 'commands',
      task: null,
      command: commandIssue.command,
      message: commandIssue.message,
      suggestion: commandIssue.suggestion || null,
      line: commandIssue.line,
    });
  }

  tasks.forEach((task, index) => {
    extractTaskVerificationCommands(task.verify).forEach((command) => {
      verificationCommands.push({
        scope: 'task',
        task: task.name,
        command,
        signature: normalizeVerificationSignature(command),
      });
    });

    const verifyPaths = extractCommandPathCandidates(task.verify);
    for (const verifyPath of verifyPaths) {
      if (hasGlobSyntax(verifyPath)) {
        const matches = matchWorkspaceGlob(cwd, verifyPath);
        if (matches.length === 0) {
          issues.push({
            kind: 'unavailable-validation-step',
            source: 'task.verify',
            task: task.name,
            path: verifyPath,
            message: `Task verify command references ${verifyPath}, but it matches no files in the current repo`,
          });
        }
        continue;
      }

      const normalized = verifyPath.replace(/\\/g, '/').replace(/^\.\//, '');
      const absolutePath = path.join(cwd, normalized);
      if (fs.existsSync(absolutePath)) continue;

      const producerIndex = taskFileOrder.get(normalized);
      if (producerIndex !== undefined && producerIndex > index) {
        issues.push({
          kind: 'task-order-verification-hazard',
          source: 'task.verify',
          task: task.name,
          path: normalized,
          message: `Task verify command depends on ${normalized}, but that file is only created in a later task`,
          producer_task: tasks[producerIndex].name,
        });
      } else if (producerIndex === undefined) {
        issues.push({
          kind: 'unavailable-validation-step',
          source: 'task.verify',
          task: task.name,
          path: normalized,
          message: `Task verify command references ${normalized}, but the file is unavailable in the current repo or plan`,
        });
      }
    }
  });

  extractPlanVerificationCommands(content).forEach((command) => {
    verificationCommands.push({
      scope: 'plan',
      task: null,
      command,
      signature: normalizeVerificationSignature(command),
    });
  });

  const groupedVerification = new Map();
  for (const entry of verificationCommands) {
    if (!entry.signature) continue;
    if (!isBuildVerificationCommand(entry.command) && !isTestVerificationCommand(entry.command)) continue;
    const existing = groupedVerification.get(entry.signature) || [];
    existing.push(entry);
    groupedVerification.set(entry.signature, existing);
  }

  for (const entries of groupedVerification.values()) {
    if (entries.length < 2) continue;
    const locations = Array.from(new Set(entries.map(describeVerificationLocation)));
    warnings.push({
      kind: 'duplicate-verification-command',
      source: 'verification',
      command: entries[0].command,
      locations,
      message: `Verification command \`${entries[0].command}\` repeats in ${locations.join(', ')}. Task <verify> should prove only the delta for that task, while plan <verification> should add only aggregate or final proof not already covered.`,
    });
  }

  const changedPaths = Array.from(new Set([
    ...filesModified,
    ...tasks.flatMap((task) => task.files),
  ].map((entry) => String(entry || '').trim()).filter(Boolean)));
  const runtimeFreshness = getRuntimeFreshness(cwd, changedPaths);
  const buildEntries = verificationCommands.filter((entry) => isBuildVerificationCommand(entry.command));
  if (buildEntries.length > 0 && !runtimeFreshness.checked) {
    const locations = Array.from(new Set(buildEntries.map(describeVerificationLocation)));
    warnings.push({
      kind: 'unnecessary-build-verification',
      source: 'verification',
      command: buildEntries[0].command,
      locations,
      message: `Build verification appears in ${locations.join(', ')}, but the plan does not touch source files that require rebuilt runtime artifact proof. Skip the build or explain the extra signal.`,
    });
  }

  return { issues, warnings, touchedPaths };
}

function cmdAnalyzePlan(cwd, planPath, raw) {
  if (!planPath) { error('plan file path required'); }
  const fullPath = path.isAbsolute(planPath) ? planPath : path.join(cwd, planPath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: planPath }, raw); return; }

  const fm = extractFrontmatter(content);

  const planId = (fm.phase && fm.plan)
    ? `${String(fm.phase).replace(/^0+/, '')}-${String(fm.plan).replace(/^0+/, '').padStart(2, '0')}`
    : path.basename(planPath, '.md').replace(/-PLAN$/i, '');

  const tasks = parsePlanTasks(content).map((task) => ({ name: task.name, files: task.files, verify: task.verify }));
  const filesModified = Array.isArray(fm.files_modified)
    ? fm.files_modified.map((file) => String(file).trim()).filter(Boolean)
    : fm.files_modified
      ? [String(fm.files_modified).trim()].filter(Boolean)
      : [];

  const allFiles = [];
  const dirSet = new Set();
  for (const task of tasks) {
    for (const file of task.files) {
      allFiles.push(file);
      const dir = path.dirname(file);
      dirSet.add(dir === '.' ? '(root)' : dir);
    }
  }

  const taskDirs = tasks.map(t => {
    const dirs = new Set();
    for (const f of t.files) {
      const dir = path.dirname(f);
      dirs.add(dir === '.' ? '(root)' : dir);
    }
    return dirs;
  });

  const parent = tasks.map((_, i) => i);
  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      for (const dir of taskDirs[i]) {
        if (taskDirs[j].has(dir)) {
          union(i, j);
          break;
        }
      }
    }
  }

  const groups = {};
  for (let i = 0; i < tasks.length; i++) {
    const root = find(i);
    if (!groups[root]) groups[root] = { tasks: [], files: new Set(), dirs: new Set() };
    groups[root].tasks.push(tasks[i].name);
    for (const f of tasks[i].files) groups[root].files.add(f);
    for (const d of taskDirs[i]) groups[root].dirs.add(d);
  }

  const concerns = Object.values(groups).map((g, idx) => {
    const dirsArr = [...g.dirs];
    const area = dirsArr.length > 0
      ? dirsArr[0].split('/').filter(s => s !== '(root)')[0] || '(root)'
      : '(none)';
    return {
      group: idx + 1,
      tasks: g.tasks,
      files: [...g.files],
      area,
    };
  });

  const concernCount = concerns.length;
  const taskCount = tasks.length;
  const dirCount = dirSet.size;

  let base = 5;
  if (concernCount > 1) base -= 1;
  if (concernCount > 2) base -= 1;
  if (concernCount > 3) base -= 1;
  if (taskCount > 3) base -= 1;
  if (taskCount > 5) base -= 1;
  const srScore = Math.max(1, Math.min(5, base));

  const labels = { 5: 'Excellent', 4: 'Good', 3: 'Acceptable', 2: 'Poor', 1: 'Bad' };
  const srLabel = labels[srScore];

  let splitSuggestion = null;
  if (srScore <= 3 && concernCount > 1) {
    splitSuggestion = {
      recommended_splits: concernCount,
      proposed_plans: concerns.map((c, idx) => ({
        plan_suffix: String(idx + 1).padStart(2, '0'),
        area: c.area,
        tasks: c.tasks,
        files: c.files,
      })),
    };
  }

  const flags = [];
  if (taskCount === 0) flags.push('no_tasks_found');
  if (dirCount > 5) flags.push('high_directory_spread');
  if (concernCount > 3) flags.push('many_concerns');

  const realism = analyzePlanRealism(cwd, fullPath, content, tasks, filesModified);
  const realismIssues = [...realism.issues];
  const realismWarnings = [...realism.warnings];

  if (taskCount >= 5 || srScore <= 2 || concernCount >= 4) {
    realismIssues.push({
      kind: 'overscoped-plan',
      source: 'analyze-plan',
      message: `Plan scope is likely too large for approval-time execution safety (score ${srScore}, ${taskCount} tasks, ${concernCount} concerns)`,
    });
  } else if (taskCount === 4 || srScore === 3) {
    realismWarnings.push({
      kind: 'overscope-risk',
      source: 'analyze-plan',
      message: `Plan scope is borderline and may need a split before execution (score ${srScore}, ${taskCount} tasks)`,
    });
  }

  output({
    plan: planId,
    sr_score: srScore,
    sr_label: srLabel,
    concern_count: concernCount,
    concerns,
    task_count: taskCount,
    files_total: allFiles.length,
    directories_touched: dirCount,
    split_suggestion: splitSuggestion,
    flags,
    files_modified: filesModified,
    approval_ready: realismIssues.length === 0,
    issues: realismIssues,
    warnings: realismWarnings,
    touched_paths: realism.touchedPaths,
  }, raw);
}

module.exports = {
  // Search functions
  findPhaseInternal,
  normalizePhaseName,
  // Analysis functions
  parseTaskFiles,
  parsePlanTasks,
  extractTaggedBlock,
  normalizeCommandWhitespace,
  tokenizeCommand,
  normalizeVerificationSignature,
  extractTaskVerificationCommands,
  extractPlanVerificationCommands,
  isBuildVerificationCommand,
  isTestVerificationCommand,
  describeVerificationLocation,
  walkWorkspaceFiles,
  hasGlobSyntax,
  globToRegex,
  matchWorkspaceGlob,
  cleanCommandToken,
  extractCommandPathCandidates,
  analyzePlanRealism,
  cmdAnalyzePlan,
};
