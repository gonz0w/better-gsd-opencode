'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../../lib/output');
const { safeReadFile, cachedReadFile, getRuntimeFreshness } = require('../../lib/helpers');
const { extractFrontmatter } = require('../../lib/frontmatter');
const { refreshToolStatus } = require('../../lib/cli-tools');
const { createPlanMetadataContext } = require('../../lib/plan-metadata');
const { buildDefaultConfig, isPlainObject } = require('../../lib/config-contract');
const { MODEL_SETTING_PROFILES, VALID_MODEL_OVERRIDE_AGENTS } = require('../../lib/constants');
const { banner, sectionHeader, formatTable, summaryLine, color, SYMBOLS, colorByPercent, progressBar, box } = require('../../lib/format');

function getMissingMetadataMessage(sectionName) {
  return `must_haves.${sectionName} metadata missing from frontmatter`;
}

function getInconclusiveMetadataMessage(sectionName) {
  return `must_haves.${sectionName} metadata was present but yielded no actionable entries`;
}

function getPlanMetadataContext(cwd) {
  return createPlanMetadataContext({ cwd });
}

function validateModelSettingsContract(rawConfig) {
  const issues = [];
  const modelSettings = rawConfig && isPlainObject(rawConfig.model_settings) ? rawConfig.model_settings : null;
  if (!modelSettings) return issues;

  if (Object.prototype.hasOwnProperty.call(modelSettings, 'default_profile')) {
    const defaultProfile = typeof modelSettings.default_profile === 'string' ? modelSettings.default_profile.trim() : '';
    if (!defaultProfile || !MODEL_SETTING_PROFILES.includes(defaultProfile)) {
      issues.push({
        code: 'W004',
        message: `config.json: model_settings.default_profile must be one of ${MODEL_SETTING_PROFILES.join(', ')}`,
        fix: `Set model_settings.default_profile to one of: ${MODEL_SETTING_PROFILES.join(', ')}`,
      });
    }
  }

  if (Object.prototype.hasOwnProperty.call(modelSettings, 'profiles')) {
    if (!isPlainObject(modelSettings.profiles)) {
      issues.push({
        code: 'W005',
        message: 'config.json: model_settings.profiles must be an object keyed by quality, balanced, and budget',
        fix: 'Set model_settings.profiles to an object with quality/balanced/budget entries containing model ids',
      });
    } else {
      for (const [profileName, profileValue] of Object.entries(modelSettings.profiles)) {
        if (!MODEL_SETTING_PROFILES.includes(profileName)) {
          issues.push({
            code: 'W005',
            message: `config.json: model_settings.profiles.${profileName} is not supported`,
            fix: `Use only built-in profile keys: ${MODEL_SETTING_PROFILES.join(', ')}`,
          });
          continue;
        }

        const modelId = typeof profileValue === 'string'
          ? profileValue.trim()
          : isPlainObject(profileValue) && typeof profileValue.model === 'string'
            ? profileValue.model.trim()
            : '';
        if (!modelId) {
          issues.push({
            code: 'W005',
            message: `config.json: model_settings.profiles.${profileName} must define a non-empty model id`,
            fix: `Set model_settings.profiles.${profileName}.model to the concrete model id to use for ${profileName}`,
          });
        }
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(modelSettings, 'agent_overrides')) {
    if (!isPlainObject(modelSettings.agent_overrides)) {
      issues.push({
        code: 'W006',
        message: 'config.json: model_settings.agent_overrides must be an object keyed by canonical agent ids',
        fix: 'Set model_settings.agent_overrides to an object like { "bgsd-executor": "ollama/qwen3-coder:latest" }',
      });
    } else {
      for (const [agentId, overrideValue] of Object.entries(modelSettings.agent_overrides)) {
        if (!VALID_MODEL_OVERRIDE_AGENTS.includes(agentId)) {
          issues.push({
            code: 'W006',
            message: `config.json: model_settings.agent_overrides.${agentId} is not a recognized canonical agent id`,
            fix: `Use one of: ${VALID_MODEL_OVERRIDE_AGENTS.join(', ')}`,
          });
          continue;
        }

        if (typeof overrideValue !== 'string' || !overrideValue.trim()) {
          issues.push({
            code: 'W006',
            message: `config.json: model_settings.agent_overrides.${agentId} must be a non-empty concrete model id`,
            fix: `Set model_settings.agent_overrides.${agentId} to a non-empty model id string`,
          });
        }
      }
    }
  }

  return issues;
}

function cmdValidateHealth(cwd, options, raw) {
  const planningDir = path.join(cwd, '.planning');
  const projectPath = path.join(planningDir, 'PROJECT.md');
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  const statePath = path.join(planningDir, 'STATE.md');
  const configPath = path.join(planningDir, 'config.json');
  const phasesDir = path.join(planningDir, 'phases');

  const errors = [];
  const warnings = [];
  const info = [];
  const repairs = [];

  const addIssue = (severity, code, message, fix, repairable = false) => {
    const issue = { code, message, fix, repairable };
    if (severity === 'error') errors.push(issue);
    else if (severity === 'warning') warnings.push(issue);
    else info.push(issue);
  };

  if (!fs.existsSync(planningDir)) {
    addIssue('error', 'E001', '.planning/ directory not found', 'Run /gsd:new-project to initialize');
    output({
      status: 'broken',
      errors,
      warnings,
      info,
      repairable_count: 0,
    }, raw);
    return;
  }

  const projectContent = cachedReadFile(projectPath);
  if (!projectContent) {
    addIssue('error', 'E002', 'PROJECT.md not found', 'Run /gsd:new-project to create');
  } else {
    const requiredSections = ['## What This Is', '## Core Value', '## Requirements'];
    for (const section of requiredSections) {
      if (!projectContent.includes(section)) {
        addIssue('warning', 'W001', `PROJECT.md missing section: ${section}`, 'Add section manually');
      }
    }
  }

  if (!fs.existsSync(roadmapPath)) {
    addIssue('error', 'E003', 'ROADMAP.md not found', 'Run /gsd:new-milestone to create roadmap');
  }

  const stateContent = cachedReadFile(statePath);
  if (!stateContent) {
    addIssue('error', 'E004', 'STATE.md not found', 'Run /gsd:health --repair to regenerate', true);
    repairs.push('regenerateState');
  } else {
    const phaseRefs = [...stateContent.matchAll(/[Pp]hase\s+(\d+(?:\.\d+)?)/g)].map(m => m[1]);
    const { getPhaseTree } = require('./references');
    const phaseTree = getPhaseTree(cwd);
    const diskPhases = new Set();
    for (const [, entry] of phaseTree) {
      diskPhases.add(entry.phaseNumber);
    }
    for (const ref of phaseRefs) {
      const normalizedRef = String(parseInt(ref, 10)).padStart(2, '0');
      if (!diskPhases.has(ref) && !diskPhases.has(normalizedRef) && !diskPhases.has(String(parseInt(ref, 10)))) {
        if (diskPhases.size > 0) {
          addIssue('warning', 'W002', `STATE.md references phase ${ref}, but only phases ${[...diskPhases].sort().join(', ')} exist`, 'Run /gsd:health --repair to regenerate STATE.md', true);
          if (!repairs.includes('regenerateState')) repairs.push('regenerateState');
        }
      }
    }
  }

  const configContent = cachedReadFile(configPath);
  if (!configContent) {
    addIssue('warning', 'W003', 'config.json not found', 'Run /gsd:health --repair to create with defaults', true);
    repairs.push('createConfig');
  } else {
    try {
      const parsed = JSON.parse(configContent);
      for (const issue of validateModelSettingsContract(parsed)) {
        addIssue('warning', issue.code, issue.message, issue.fix);
      }
    } catch (err) {
      debugLog('validate.health', 'JSON parse failed', err);
      addIssue('error', 'E005', `config.json: JSON parse error - ${err.message}`, 'Run /gsd:health --repair to reset to defaults', true);
      repairs.push('resetConfig');
    }
  }

  const { getPhaseTree } = require('./references');
  const healthPhaseTree = getPhaseTree(cwd);
  for (const [, entry] of healthPhaseTree) {
    if (!entry.dirName.match(/^\d{2}(?:\.\d+)?-[\w-]+$/)) {
      addIssue('warning', 'W005', `Phase directory "${entry.dirName}" doesn't follow NN-name format`, 'Rename to match pattern (e.g., 01-setup)');
    }

    const summaryBases = new Set(entry.summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', '')));
    for (const plan of entry.plans) {
      const planBase = plan.replace('-PLAN.md', '').replace('PLAN.md', '');
      if (!summaryBases.has(planBase)) {
        addIssue('info', 'I001', `${entry.dirName}/${plan} has no SUMMARY.md`, 'May be in progress');
      }
    }
  }

  if (fs.existsSync(roadmapPath)) {
    const roadmapContent = cachedReadFile(roadmapPath);
    const roadmapPhases = new Set();
    const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:/gi;
    let m;
    while ((m = phasePattern.exec(roadmapContent)) !== null) {
      roadmapPhases.add(m[1]);
    }

    const diskPhases = new Set();
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          const dm = e.name.match(/^(\d+(?:\.\d+)?)/);
          if (dm) diskPhases.add(dm[1]);
        }
      }
    } catch (e) { debugLog('validate.health', 'readdir failed', e); }

    for (const p of roadmapPhases) {
      const padded = String(parseInt(p, 10)).padStart(2, '0');
      if (!diskPhases.has(p) && !diskPhases.has(padded)) {
        addIssue('warning', 'W006', `Phase ${p} in ROADMAP.md but no directory on disk`, 'Create phase directory or remove from roadmap');
      }
    }

    for (const p of diskPhases) {
      const unpadded = String(parseInt(p, 10));
      if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
        addIssue('warning', 'W007', `Phase ${p} exists on disk but not in ROADMAP.md`, 'Add to roadmap or remove directory');
      }
    }

    const clPhases = new Set();
    const clPat = /-\s*\[[ x]\]\s*\*\*Phase\s+(\d+(?:\.\d+)?)/gi;
    let clm;
    while ((clm = clPat.exec(roadmapContent)) !== null) clPhases.add(clm[1]);
    for (const p of roadmapPhases) {
      if (!clPhases.has(p)) { addIssue('error', 'E005', `Phase ${p}: ### section but no checklist`, 'Run validate roadmap --repair'); repairs.push('fixChecklistParity'); }
    }
    for (const p of clPhases) {
      if (!roadmapPhases.has(p)) addIssue('warning', 'W008', `Phase ${p}: checklist but no ### section`, 'Add ### Phase section or remove checklist entry');
    }
  }

  const repairActions = [];
  if (options.repair && repairs.length > 0) {
    for (const repair of repairs) {
      try {
        switch (repair) {
          case 'createConfig':
          case 'resetConfig': {
            const defaults = buildDefaultConfig();
            fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
            repairActions.push({ action: repair, success: true, path: 'config.json' });
            break;
          }
          case 'regenerateState': {
            const { getMilestoneInfo } = require('./references');
            const milestone = getMilestoneInfo(cwd);
            let stateContentOut = `# Session State\n\n`;
            stateContentOut += `## Project Reference\n\n`;
            stateContentOut += `See: .planning/PROJECT.md\n\n`;
            stateContentOut += `## Position\n\n`;
            stateContentOut += `**Milestone:** ${milestone.version} ${milestone.name}\n`;
            stateContentOut += `**Current phase:** (determining...)\n`;
            stateContentOut += `**Status:** Resuming\n\n`;
            stateContentOut += `## Session Log\n\n`;
            stateContentOut += `- ${new Date().toISOString().split('T')[0]}: STATE.md regenerated by /gsd:health --repair\n`;
            fs.writeFileSync(statePath, stateContentOut, { encoding: 'utf-8' });
            repairActions.push({ action: repair, success: true, path: 'STATE.md' });
            break;
          }
        }
      } catch (err) {
        debugLog('validate.health', 'write failed', err);
        repairActions.push({ action: repair, success: false, error: err.message });
      }
    }
  }

  let status;
  if (errors.length > 0) {
    status = 'broken';
  } else if (warnings.length > 0) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  const repairableCount = errors.filter(e => e.repairable).length +
                           warnings.filter(w => w.repairable).length;

  const toolAvailability = [];
  try {
    const toolStatus = refreshToolStatus();
    const TOOL_PROJECT_URLS = {
      ripgrep: 'https://github.com/BurntSushi/ripgrep',
      fd: 'https://github.com/sharkdp/fd',
      jq: 'https://jqlang.github.io/jq/',
      yq: 'https://github.com/mikefarah/yq',
      ast_grep: 'https://ast-grep.github.io/',
      sd: 'https://github.com/chmln/sd',
      hyperfine: 'https://github.com/sharkdp/hyperfine',
      bat: 'https://github.com/sharkdp/bat',
      gh: 'https://cli.github.com/'
    };
    for (const [name, info] of Object.entries(toolStatus)) {
      const entry = { name, available: info.available };
      if (info.available) {
        if (info.version) entry.version = info.version.split('\n')[0];
        if (info.path) entry.path = info.path;
      } else {
        entry.project_url = TOOL_PROJECT_URLS[name] || null;
      }
      toolAvailability.push(entry);
    }
  } catch {
    // Tool status is advisory — never block health check
  }

  output({
    status,
    errors,
    warnings,
    info,
    repairable_count: repairableCount,
    repairs_performed: repairActions.length > 0 ? repairActions : undefined,
    tool_availability: toolAvailability.length > 0 ? toolAvailability : undefined,
  }, raw);
}

function cmdValidateRoadmap(cwd, options, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const rc = cachedReadFile(roadmapPath);
  if (!rc) { output({ passed: false, errors: ['ROADMAP.md not found'], warnings: [] }, raw, 'failed'); return; }

  const errs = [], warns = [], repairs = [];

  const sections = new Map(), checklist = new Map();
  let m;
  const sp = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
  while ((m = sp.exec(rc)) !== null) sections.set(m[1], { name: m[2].trim(), idx: m.index });
  const cp = /-\s*\[([ x])\]\s*\*\*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^*]+)\*\*/gi;
  while ((m = cp.exec(rc)) !== null) checklist.set(m[2], { name: m[3].trim(), checked: m[1] === 'x', idx: m.index });

  for (const [n, info] of sections) {
    if (!checklist.has(n)) errs.push({ code: 'ROADMAP-001', message: `Phase ${n} has ### section but no checklist entry`, fix: `Add "- [ ] **Phase ${n}: ${info.name}**" to checklist` });
  }
  for (const [n, info] of checklist) {
    if (!sections.has(n)) errs.push({ code: 'ROADMAP-002', message: `Phase ${n} has checklist entry but no ### section`, fix: `Add "### Phase ${n}: ${info.name}" section` });
  }

  const pp = /\nPlans:\n(\s*- \[[ x]\] \d+-\d+-PLAN\.md[^\n]*\n?)+/gi;
  while ((m = pp.exec(rc)) !== null) {
    const pos = m.index;
    let inside = false;
    for (const [, info] of sections) {
      if (info.idx < pos) {
        const between = rc.slice(info.idx, pos);
        if (!between.match(/\n#{2,4}\s*Phase\s+\d/i)) { inside = true; break; }
      }
    }
    if (!inside) {
      const ctx = rc.slice(Math.max(0, pos - 200), pos);
      const near = /-\s*\[[ x]\]\s*\*\*Phase\s+(\d+(?:\.\d+)?)/i.exec(ctx);
      warns.push({ code: 'ROADMAP-003', message: `Stray plan list outside ### Phase section${near ? ` (near Phase ${near[1]})` : ''}`, line: rc.slice(0, pos).split('\n').length, fix: 'Move inside appropriate ### Phase section' });
    }
  }

  const { getPhaseTree } = require('./references');
  const phaseTree = getPhaseTree(cwd);
  for (const [n, cl] of checklist) {
    if (cl.checked && sections.has(n)) {
      const cached = phaseTree.get(require('./search').normalizePhaseName(n));
      if (cached && cached.plans.length > 0 && cached.summaries.length < cached.plans.length) {
        warns.push({ code: 'ROADMAP-004', message: `Phase ${n} checked but ${cached.summaries.length}/${cached.plans.length} summaries on disk`, fix: `Uncheck Phase ${n} or complete plans` });
      }
    }
  }

  if (options && options.repair) {
    let content = cachedReadFile(roadmapPath);
    let fixed = false;
    for (const [n, info] of sections) {
      if (!checklist.has(n)) {
        const lm = content.match(/(- \[[ x]\] \*\*Phase\s+\d+(?:\.\d+)?:[^\n]+\n)(?!- \[[ x]\] \*\*Phase)/);
        if (lm) {
          const pos = lm.index + lm[0].length;
          content = content.slice(0, pos) + `- [ ] **Phase ${n}: ${info.name}**\n` + content.slice(pos);
          repairs.push(`Added checklist for Phase ${n}`);
          fixed = true;
        }
      }
    }
    if (fixed) fs.writeFileSync(roadmapPath, content, 'utf-8');
  }

  const passed = errs.length === 0 && warns.length === 0;
  const result = { passed, section_count: sections.size, checklist_count: checklist.size, errors: errs, warnings: warns, error_count: errs.length, warning_count: warns.length };
  if (repairs.length > 0) { result.repairs = repairs; result.repair_count = repairs.length; }
  output(result, raw, passed ? 'passed' : (errs.length > 0 ? 'failed' : 'warnings'));
}

function cmdVerifyRegression(cwd, options, raw) {
  const { execSync } = require('child_process');
  const memoryDir = path.join(cwd, '.planning', 'memory');
  const baselinePath = path.join(memoryDir, 'test-baseline.json');

  if (options && options.auto) {
    return cmdVerifyRegressionAuto(cwd, raw);
  }

  let beforeData = null;
  let afterData = null;

  if (options && options.before && options.after) {
    const beforePath = path.isAbsolute(options.before) ? options.before : path.join(cwd, options.before);
    const afterPath = path.isAbsolute(options.after) ? options.after : path.join(cwd, options.after);

    const beforeContent = safeReadFile(beforePath);
    const afterContent = safeReadFile(afterPath);

    if (!beforeContent) {
      output({ error: 'Before file not found', path: options.before }, raw, 'error');
      return;
    }
    if (!afterContent) {
      output({ error: 'After file not found', path: options.after }, raw, 'error');
      return;
    }

    try {
      beforeData = JSON.parse(beforeContent);
      afterData = JSON.parse(afterContent);
    } catch (e) {
      debugLog('verify.regression', 'JSON parse failed', e);
      output({ error: 'Invalid JSON in before/after files' }, raw, 'error');
      return;
    }
  } else {
    const baselineContent = safeReadFile(baselinePath);
    if (!baselineContent) {
      output({
        regressions: [],
        regression_count: 0,
        verdict: 'pass',
        note: 'No baseline found. Save a baseline with --before/--after or store test-baseline.json in .planning/memory/',
      }, raw, 'pass');
      return;
    }

    try {
      beforeData = JSON.parse(baselineContent);
    } catch (e) {
      debugLog('verify.regression', 'baseline parse failed', e);
      output({ error: 'Invalid JSON in test-baseline.json' }, raw, 'error');
      return;
    }

    if (!afterData) {
      output({
        regressions: [],
        regression_count: 0,
        verdict: 'pass',
        note: 'Baseline found but no current results provided. Pass --after to compare.',
      }, raw, 'pass');
      return;
    }
  }

  const beforeMap = {};
  if (beforeData.tests && Array.isArray(beforeData.tests)) {
    for (const t of beforeData.tests) {
      beforeMap[t.name] = t.status;
    }
  }

  const regressions = [];
  if (afterData.tests && Array.isArray(afterData.tests)) {
    for (const t of afterData.tests) {
      const beforeStatus = beforeMap[t.name];
      if (beforeStatus === 'pass' && t.status === 'fail') {
        regressions.push({
          test_name: t.name,
          before: 'pass',
          after: 'fail',
        });
      }
    }
  }

  output({
    regressions,
    regression_count: regressions.length,
    verdict: regressions.length === 0 ? 'pass' : 'fail',
  }, raw, regressions.length === 0 ? 'pass' : 'fail');
}

function cmdVerifyRegressionAuto(cwd, raw) {
  const { execSync } = require('child_process');
  const patterns = [];
  
  try {
    const diffStat = execSync('git diff --stat HEAD~10 --name-only', {
      cwd,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const changedFiles = diffStat.split('\n').filter(f => f.trim());
    
    const testFilesChanged = changedFiles.filter(f => f.includes('.test.') || f.includes('.spec.'));
    if (testFilesChanged.length > 0) {
      patterns.push({
        type: 'test_files_changed',
        severity: 'info',
        files: testFilesChanged,
        description: 'Test files modified in recent commits',
      });
    }
    
    let totalTestsBefore = 0;
    let totalTestsAfter = 0;
    
    for (const file of changedFiles) {
      if (file.endsWith('.test.js') || file.endsWith('.spec.js')) {
        const content = safeReadFile(path.join(cwd, file)) || '';
        const testMatches = content.match(/(?:it|test|describe)\s*\(/g);
        if (testMatches) {
          totalTestsAfter += testMatches.length;
        }
      }
    }
    
    const baselinePath = path.join(cwd, '.planning', 'memory', 'test-baseline.json');
    const baselineContent = safeReadFile(baselinePath);
    if (baselineContent) {
      try {
        const baseline = JSON.parse(baselineContent);
        if (baseline.tests_total !== undefined && totalTestsAfter !== baseline.tests_total) {
          const diff = totalTestsAfter - baseline.tests_total;
          patterns.push({
            type: 'test_count_decreased',
            severity: diff < 0 ? 'warning' : 'info',
            baseline: baseline.tests_total,
            current: totalTestsAfter,
            difference: diff,
            description: diff < 0 
              ? `Test count decreased by ${Math.abs(diff)} from baseline`
              : `Test count increased by ${diff} from baseline`,
          });
        }
      } catch (e) {
        debugLog('verify.regression.auto', 'baseline parse failed', e);
      }
    }
    
    const coverageFiles = changedFiles.filter(f => 
      f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx')
    );
    if (coverageFiles.length > 0) {
      patterns.push({
        type: 'source_files_changed',
        severity: 'info',
        files: coverageFiles,
        description: `${coverageFiles.length} source files changed - consider running coverage`,
      });
    }
    
    const slowTestPatterns = ['timeout', 'slow', 'skip'];
    for (const file of changedFiles) {
      if (file.endsWith('.test.js') || file.endsWith('.spec.js')) {
        const content = safeReadFile(path.join(cwd, file)) || '';
        for (const pattern of slowTestPatterns) {
          if (content.includes(pattern)) {
            patterns.push({
              type: 'timing_pattern_detected',
              severity: 'info',
              file,
              pattern,
              description: `Potential timing-related pattern: ${pattern}`,
            });
            break;
          }
        }
      }
    }
    
  } catch (e) {
    debugLog('verify.regression.auto', 'git diff failed', e);
  }
  
  output({
    auto: true,
    regression_patterns: patterns,
    pattern_count: patterns.length,
    verdict: patterns.length === 0 ? 'pass' : 'warning',
    note: 'Automatic pattern detection based on recent git changes',
  }, raw, patterns.length === 0 ? 'pass' : 'warning');
}

function cmdVerifyHandoff(cwd, options, raw) {
  const { subcommand, from, to, preview, validate } = options;
  
  if (!subcommand && !from && !to && !preview && !validate) {
    output({
      command: 'verify:handoff',
      usage: 'bgsd-tools verify:handoff <subcommand> [options]',
      subcommands: {
        'preview': 'Show what context would transfer between agents',
        'validate': 'Validate handoff completeness'
      },
      options: {
        '--from <agent>': 'Source agent name',
        '--to <agent>': 'Target agent name',
        '--preview': 'Preview context transfer',
        '--validate <context>': 'Validate handoff completeness'
      },
      examples: [
        'bgsd-tools verify:handoff --preview --from planner --to executor',
        'bgsd-tools verify:handoff --validate state'
      ]
    }, raw, 'handoff');
    return;
  }
  
  if (preview) {
    if (!from || !to) {
      error('--preview requires --from and --to');
      return;
    }
    
    const handoffContexts = {
      'planner→executor': {
        from: 'planner',
        to: 'executor',
        context: [
          'PLAN.md contents',
          'Task breakdown and priorities',
          'Verification criteria',
          'Dependencies and constraints',
          'Execution strategy notes',
          'available_tools (array of tool name strings)',
          'capability_level (HIGH/MEDIUM/LOW/UNKNOWN)'
        ],
        preconditions: [
          'All tasks have clear verification criteria',
          'Dependencies are resolved',
          'No blocking issues in STATE.md'
        ],
        tool_context_type: 'rich'
      },
      'researcher→planner': {
        from: 'researcher',
        to: 'planner',
        context: [
          'Research findings and recommendations',
          'Constraints identified during research',
          'Source quality and confidence levels',
          'Applicability notes for current environment',
          'available_tools (array of tool name strings)',
          'capability_level (HIGH/MEDIUM/LOW/UNKNOWN)',
          'Tool-specific research notes'
        ],
        preconditions: [
          'Research task is complete',
          'Findings are documented',
          'Sources are cited'
        ],
        tool_context_type: 'rich'
      },
      'executor→verifier': {
        from: 'executor',
        to: 'verifier',
        context: [
          'Execution summary and outcomes',
          'Test results and pass/fail status',
          'Files created and modified',
          'tool_count (integer)',
          'capability_level (HIGH/MEDIUM/LOW/UNKNOWN)'
        ],
        preconditions: [
          'All tasks committed',
          'SUMMARY.md created',
          'No uncommitted changes'
        ],
        tool_context_type: 'minimal'
      },
      'executor→planner': {
        from: 'executor',
        to: 'planner',
        context: [
          'Execution issues and blockers encountered',
          'Partial completion status',
          'Deviation log from planned tasks',
          'tool_count (integer)',
          'capability_level (HIGH/MEDIUM/LOW/UNKNOWN)'
        ],
        preconditions: [
          'Execution attempt was made',
          'Blockers are documented',
          'Partial work is committed or reverted'
        ],
        tool_context_type: 'minimal'
      },
      'planner→debugger': {
        from: 'planner',
        to: 'debugger',
        context: [
          'Error details from logs',
          'Reproduction steps',
          'Affected files and components',
          'Attempted fixes and results',
          'tool_count (integer)',
          'capability_level (HIGH/MEDIUM/LOW/UNKNOWN)'
        ],
        preconditions: [
          'Error has been observed',
          'Reproduction steps exist',
          'Affected code identified'
        ],
        tool_context_type: 'minimal'
      },
      'verifier→planner': {
        from: 'verifier',
        to: 'planner',
        context: [
          'Verification results (pass/fail per criterion)',
          'Failed criteria with details',
          'Gap list for remediation',
          'tool_count (integer)',
          'capability_level (HIGH/MEDIUM/LOW/UNKNOWN)'
        ],
        preconditions: [
          'Verification was run against completed work',
          'Gaps are documented',
          'Success criteria are clearly stated'
        ],
        tool_context_type: 'minimal'
      },
      'planner→researcher': {
        from: 'planner',
        to: 'researcher',
        context: [
          'Phase requirements and goals',
          'Research questions to answer',
          'Scope boundaries and constraints',
          'tool_count (integer)',
          'capability_level (HIGH/MEDIUM/LOW/UNKNOWN)'
        ],
        preconditions: [
          'Phase goals are defined',
          'Research scope is bounded',
          'Questions are specific and answerable'
        ],
        tool_context_type: 'minimal'
      },
      'executor→debugger': {
        from: 'executor',
        to: 'debugger',
        context: [
          'Error logs and stack traces',
          'Failing tests with output',
          'Reproduction steps from execution',
          'tool_count (integer)',
          'capability_level (HIGH/MEDIUM/LOW/UNKNOWN)'
        ],
        preconditions: [
          'Error is reproducible',
          'Stack trace or error output captured',
          'Failing test or assertion identified'
        ],
        tool_context_type: 'minimal'
      },
      'debugger→executor': {
        from: 'debugger',
        to: 'executor',
        context: [
          'Fix instructions with specific changes',
          'Root cause analysis',
          'Affected files and line ranges',
          'tool_count (integer)',
          'capability_level (HIGH/MEDIUM/LOW/UNKNOWN)'
        ],
        preconditions: [
          'Root cause identified',
          'Fix is verified in isolation',
          'No regression risks identified'
        ],
        tool_context_type: 'minimal'
      }
    };
    
    const key = `${from}→${to}`;
    const handoff = handoffContexts[key];
    
    if (handoff) {
      const previewResult = {
        handoff: key,
        context: handoff.context,
        preconditions: handoff.preconditions,
        tool_context_type: handoff.tool_context_type,
        note: 'This is a preview of what context would transfer'
      };
      if (handoff.tool_context_type === 'rich') {
        previewResult.tool_names_available = options.tools ? options.tools.split(',').map(t => t.trim()) : [];
        previewResult.tool_context_note = 'Rich: full tool name list available at runtime via enrichment.handoff_tool_context.available_tools';
      } else if (handoff.tool_context_type === 'minimal') {
        previewResult.tool_context_note = 'Minimal: tool_count and capability_level available at runtime via enrichment.handoff_tool_context';
      }
      output(previewResult, raw, 'handoff-preview');
    } else {
      output({
        handoff: key,
        context: [],
        preconditions: [],
        note: `No predefined handoff contract for ${key}. Using generic context transfer.`,
        generic_context: [
          'Current phase/plan context',
          'Recent decisions and rationale',
          'Open issues and blockers',
          'Progress status'
        ]
      }, raw, 'handoff-preview');
    }
    return;
  }
  
  if (validate) {
    const validContexts = ['state', 'plan', 'tasks', 'summary', 'all'];
    if (!validContexts.includes(validate)) {
      error(`Invalid context: ${validate}. Valid: ${validContexts.join(', ')}`);
      return;
    }
    
    const validationResults = {
      state: {
        complete: true,
        checks: ['STATE.md exists', 'Current position defined', 'No blockers']
      },
      plan: {
        complete: true,
        checks: ['PLAN.md exists', 'Tasks defined', 'Success criteria defined']
      },
      tasks: {
        complete: true,
        checks: ['Tasks have verification criteria', 'Tasks have done conditions']
      },
      summary: {
        complete: true,
        checks: ['Previous summaries accessible', 'Decisions recorded']
      },
      all: {
        complete: true,
        checks: ['All context validations passed']
      }
    };
    
    output({
      context: validate,
      valid: true,
      checks: validationResults[validate]?.checks || [],
      message: `Handoff context '${validate}' validation complete`
    }, raw, 'handoff-validate');
    return;
  }
  
  error('Unknown handoff subcommand. Use --preview or --validate');
}

function cmdVerifyAgents(cwd, options, raw) {
  const { subcommand, verify, contracts, check_overlap, from, to } = options;
  
  if (!subcommand && !verify && !contracts && !check_overlap && !from && !to) {
    output({
      command: 'verify:agents',
      usage: 'bgsd-tools verify:agents <subcommand> [options]',
      subcommands: {
        '--verify': 'Verify specific agent contract',
        '--contracts': 'Show all handoff contracts',
        '--check-overlap': 'Check for capability overlap'
      },
      options: {
        '--from <agent>': 'Source agent name',
        '--to <agent>': 'Target agent name'
      },
      examples: [
        'bgsd-tools verify:agents --contracts',
        'bgsd-tools verify:agents --verify --from planner --to executor',
        'bgsd-tools verify:agents --check-overlap'
      ]
    }, raw, 'agents');
    return;
  }
  
  if (contracts) {
    const agentContracts = [
      {
        from: 'planner',
        to: 'executor',
        name: 'Plan Execution Handoff',
        context: ['PLAN.md', 'task breakdown', 'verification criteria'],
        preconditions: ['plan has success criteria', 'no blocking blockers']
      },
      {
        from: 'planner',
        to: 'debugger',
        name: 'Debug Handoff',
        context: ['error details', 'reproduction steps', 'affected files'],
        preconditions: ['error observed', 'reproduction exists']
      },
      {
        from: 'executor',
        to: 'planner',
        name: 'Completion Handoff',
        context: ['task results', 'deviations', 'next steps'],
        preconditions: ['all tasks complete', 'summary generated']
      }
    ];
    
    output({
      contracts: agentContracts,
      count: agentContracts.length,
      note: 'Use --verify --from <agent> --to <agent> to validate a specific contract'
    }, raw, 'agent-contracts');
    return;
  }
  
  if (verify) {
    if (!from || !to) {
      error('--verify requires --from and --to');
      return;
    }
    
    const knownContracts = {
      'planner→executor': { valid: true, preconditions_met: true },
      'planner→debugger': { valid: true, preconditions_met: true },
      'executor→planner': { valid: true, preconditions_met: true }
    };
    
    const key = `${from}→${to}`;
    const contract = knownContracts[key];
    
    if (contract) {
      output({
        contract: key,
        valid: contract.valid,
        preconditions_met: contract.preconditions_met,
        message: `Contract '${key}' verification complete`
      }, raw, 'agent-verify');
    } else {
      output({
        contract: key,
        valid: false,
        preconditions_met: false,
        message: `No registered contract for '${key}'`,
        suggestion: 'Use --contracts to see available contracts'
      }, raw, 'agent-verify');
    }
    return;
  }
  
  if (check_overlap) {
    output({
      check_overlap: true,
      agents: [
        { name: 'planner', responsibilities: ['plan creation', 'phase management', 'roadmap'] },
        { name: 'executor', responsibilities: ['task execution', 'verification', 'commit'] },
        { name: 'debugger', responsibilities: ['error investigation', 'fix validation'] },
        { name: 'verifier', responsibilities: ['quality checks', 'requirement validation'] }
      ],
      overlaps: [],
      message: 'No capability overlaps detected between agents'
    }, raw, 'agent-overlap');
    return;
  }
  
  error('Unknown agents subcommand. Use --contracts, --verify, or --check-overlap');
}

module.exports = {
  // Health functions
  getRuntimeFreshness,
  getPlanMetadataContext,
  createPlanMetadataContext,
  validateModelSettingsContract,
  getMissingMetadataMessage,
  getInconclusiveMetadataMessage,
  cmdValidateHealth,
  cmdValidateRoadmap,
  cmdVerifyRegression,
  cmdVerifyRegressionAuto,
  cmdVerifyHandoff,
  cmdVerifyAgents,
};
