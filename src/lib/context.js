'use strict';

const { debugLog } = require('./output');

// ─── Token Estimation ────────────────────────────────────────────────────────

let _estimateTokenCount = null;

/**
 * Lazy-load tokenx's estimateTokenCount function.
 * Falls back to character-based heuristic if tokenx fails to load.
 */
function getTokenizer() {
  if (_estimateTokenCount !== null) return _estimateTokenCount;
  try {
    const tokenx = require('tokenx');
    _estimateTokenCount = tokenx.estimateTokenCount;
    debugLog('context.tokenizer', 'tokenx loaded successfully');
  } catch (e) {
    debugLog('context.tokenizer', 'tokenx load failed, using fallback', e);
    _estimateTokenCount = (text) => Math.ceil(String(text).length / 4);
  }
  return _estimateTokenCount;
}

/**
 * Estimate token count for a text string using tokenx (~96% accuracy for prose).
 * Falls back to Math.ceil(text.length / 4) if tokenx fails.
 *
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  try {
    const fn = getTokenizer();
    return fn(text);
  } catch (e) {
    debugLog('context.estimateTokens', 'estimation failed, using fallback', e);
    return Math.ceil(text.length / 4);
  }
}

/**
 * Estimate token count for a JSON-serializable object.
 *
 * @param {*} obj - Object to serialize and estimate
 * @returns {number} Estimated token count of JSON.stringify(obj)
 */
function estimateJsonTokens(obj) {
  if (obj === undefined || obj === null) return 0;
  try {
    return estimateTokens(JSON.stringify(obj));
  } catch (e) {
    debugLog('context.estimateJsonTokens', 'stringify failed', e);
    return 0;
  }
}

/**
 * Check token count against budget.
 *
 * @param {number} tokens - Token count to check
 * @param {object} config - Config with context_window and context_target_percent
 * @returns {{ tokens: number, percent: number, warning: boolean, recommendation: string|null }}
 */
function checkBudget(tokens, config = {}) {
  const contextWindow = config.context_window || 200000;
  const targetPercent = config.context_target_percent || 50;
  const percent = Math.round((tokens / contextWindow) * 100);
  const warning = percent > targetPercent;

  let recommendation = null;
  if (percent > 80) {
    recommendation = 'Critical: exceeds 80% of context window. Split into smaller units.';
  } else if (percent > 60) {
    recommendation = 'High: exceeds 60% of context window. Consider reducing scope.';
  } else if (percent > targetPercent) {
    recommendation = `Above target: exceeds ${targetPercent}% target. Monitor closely.`;
  }

  return { tokens, percent, warning, recommendation };
}

/**
 * Convenience: estimate tokens for text and check budget in one call.
 *
 * @param {string} text - Text to estimate
 * @param {object} config - Config with context_window and context_target_percent
 * @returns {{ tokens: number, percent: number, warning: boolean, recommendation: string|null }}
 */
function isWithinBudget(text, config = {}) {
  const tokens = estimateTokens(text);
  return checkBudget(tokens, config);
}

// ─── Agent Context Manifests ─────────────────────────────────────────────────

const AGENT_MANIFESTS = {
  'gsd-executor': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plans', 'incomplete_plans',
             'plan_count', 'incomplete_count', 'branch_name', 'commit_docs',
             'verifier_enabled', 'task_routing', 'env_summary'],
    optional: ['codebase_conventions', 'codebase_dependencies'],
    exclude: ['intent_drift', 'intent_summary', 'worktree_config', 'worktree_active',
              'file_overlaps', 'codebase_freshness', 'codebase_stats'],
  },
  'gsd-verifier': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plans', 'summaries',
             'verifier_enabled'],
    optional: ['codebase_stats'],
    exclude: ['intent_drift', 'intent_summary', 'task_routing', 'worktree_config',
              'worktree_active', 'file_overlaps', 'env_summary', 'branch_name',
              'codebase_conventions', 'codebase_dependencies'],
  },
  'gsd-planner': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plan_count',
             'research_enabled', 'plan_checker_enabled', 'intent_summary'],
    optional: ['codebase_stats', 'codebase_conventions', 'codebase_dependencies',
               'codebase_freshness', 'env_summary'],
    exclude: ['task_routing', 'worktree_config', 'worktree_active', 'file_overlaps',
              'branch_name'],
  },
  'gsd-phase-researcher': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'intent_summary'],
    optional: ['codebase_stats', 'env_summary'],
    exclude: ['task_routing', 'worktree_config', 'worktree_active', 'file_overlaps',
              'branch_name', 'verifier_enabled', 'plans', 'incomplete_plans'],
  },
  'gsd-plan-checker': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plans', 'plan_count'],
    optional: ['codebase_stats', 'codebase_dependencies'],
    exclude: ['intent_drift', 'intent_summary', 'task_routing', 'worktree_config',
              'worktree_active', 'file_overlaps', 'env_summary', 'branch_name'],
  },
};

/**
 * Filter init output to agent-declared fields.
 * @param {object} result - Full init output object
 * @param {string} agentType - Agent type key (e.g. 'gsd-executor')
 * @returns {object} Scoped result with _agent and _savings metadata
 */
function scopeContextForAgent(result, agentType) {
  const manifest = AGENT_MANIFESTS[agentType];
  if (!manifest || !result) return result;

  const originalKeys = Object.keys(result).length;
  const allowed = new Set([...manifest.fields, ...manifest.optional]);
  const scoped = { _agent: agentType };

  for (const key of allowed) {
    if (key in result && result[key] !== undefined && result[key] !== null) {
      scoped[key] = result[key];
    } else if (manifest.fields.includes(key) && key in result) {
      // Required fields: include even if null
      scoped[key] = result[key];
    }
  }

  const scopedKeys = Object.keys(scoped).length - 1; // exclude _agent
  scoped._savings = {
    original_keys: originalKeys,
    scoped_keys: scopedKeys,
    reduction_pct: originalKeys > 0 ? Math.round((1 - scopedKeys / originalKeys) * 100) : 0,
  };

  return scoped;
}

/**
 * Compress STATE.md markdown to essential fields (70-80% reduction).
 * @param {string} stateRaw - Raw STATE.md content
 * @returns {object} Compact state object
 */
function compactPlanState(stateRaw) {
  if (!stateRaw || typeof stateRaw !== 'string') {
    return { phase: null, progress: null, status: null, last_activity: null, decisions: [], blockers: [] };
  }

  let phase = null, progress = null, status = null, lastActivity = null;

  // Extract Current Position fields
  const phaseMatch = stateRaw.match(/^Phase:\s*(\S+)/m);
  if (phaseMatch) phase = phaseMatch[1];

  const planMatch = stateRaw.match(/^Plan:\s*(.+)$/m);
  if (planMatch) progress = planMatch[1].trim();

  const statusMatch = stateRaw.match(/^Status:\s*(.+)$/m);
  if (statusMatch) status = statusMatch[1].trim();

  const activityMatch = stateRaw.match(/^Last activity:\s*(\S+)/m);
  if (activityMatch) lastActivity = activityMatch[1];

  // Extract last 5 decisions (lines starting with "- Phase")
  const decisions = [];
  const decisionRe = /^- Phase .+$/gm;
  let m;
  while ((m = decisionRe.exec(stateRaw)) !== null) {
    decisions.push(m[0].replace(/^- /, ''));
  }

  // Extract blockers
  const blockers = [];
  const blockerSection = stateRaw.match(/### Blockers\/Concerns\n([\s\S]*?)(?:\n## |\n$|$)/);
  if (blockerSection) {
    const lines = blockerSection[1].trim().split('\n').filter(l => l.startsWith('- '));
    for (const line of lines) {
      const text = line.replace(/^- /, '').trim();
      if (text && text.toLowerCase() !== 'none' && text.toLowerCase() !== 'none.') {
        blockers.push(text);
      }
    }
  }

  return {
    phase,
    progress,
    status,
    last_activity: lastActivity,
    decisions: decisions.slice(-5),
    blockers,
  };
}

/**
 * Compress dependency graph data to essentials (50-60% reduction).
 * @param {object} depData - Full codebase_dependencies object
 * @returns {object} Compact dep graph object
 */
function compactDepGraph(depData) {
  if (!depData || typeof depData !== 'object') return {};

  return {
    total_modules: depData.total_modules || 0,
    total_edges: depData.total_edges || 0,
    top_imported: Array.isArray(depData.top_imported) ? depData.top_imported.slice(0, 5) : [],
    has_cycles: !!depData.has_cycles,
  };
}

module.exports = {
  estimateTokens, estimateJsonTokens, checkBudget, isWithinBudget,
  AGENT_MANIFESTS, scopeContextForAgent, compactPlanState, compactDepGraph,
};
