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

module.exports = { estimateTokens, estimateJsonTokens, checkBudget, isWithinBudget };
