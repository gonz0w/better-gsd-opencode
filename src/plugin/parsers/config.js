import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * config.json parser for in-process reading.
 * Extracts configuration from .planning/config.json with schema defaults.
 *
 * Parsing logic extracted from src/lib/config.js (loadConfig).
 * Self-contained — defaults are inlined, no dependency on constants.js.
 */

// Module-level cache: cwd → frozen parsed config
const _cache = new Map();

/**
 * Inline schema defaults — avoids importing from constants.js which would
 * pull the entire CLI dependency graph into the plugin bundle.
 */
const CONFIG_DEFAULTS = Object.freeze({
  mode: 'interactive',
  depth: 'standard',
  model_profile: 'balanced',
  commit_docs: true,
  branching_strategy: 'none',
  phase_branch_template: 'phase-{number}-{name}',
  milestone_branch_template: '{version}',
  parallelization: false,
  research: true,
  plan_checker: true,
  verifier: true,
  staleness_threshold: 2,
  // Phase 75: Event-driven state sync settings
  idle_validation: Object.freeze({
    enabled: true,
    cooldown_seconds: 5,
    staleness_threshold_hours: 2,
  }),
  notifications: Object.freeze({
    enabled: true,
    os_notifications: true,
    dnd_mode: false,
    rate_limit_per_minute: 5,
    sound: false,
  }),
  stuck_detection: Object.freeze({
    error_threshold: 3,
    spinning_threshold: 5,
  }),
  file_watcher: Object.freeze({
    debounce_ms: 200,
    max_watched_paths: 500,
  }),
  // Phase 76: Advisory guardrails settings
  advisory_guardrails: Object.freeze({
    enabled: true,
    conventions: true,
    planning_protection: true,
    test_suggestions: true,
    convention_confidence_threshold: 70,
    dedup_threshold: 3,
    test_debounce_ms: 500,
  }),
});

/**
 * Keys whose defaults are nested objects — require shallow merge
 * so user can override individual sub-keys while preserving other defaults.
 */
const NESTED_OBJECT_KEYS = new Set([
  'idle_validation', 'notifications', 'stuck_detection', 'file_watcher', 'advisory_guardrails',
]);

/**
 * Parse config.json from the given working directory (or CWD).
 * Returns a frozen object with all config fields and defaults applied.
 * Returns default config if file is missing or corrupt.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {object} Frozen config object (never null — defaults always applied)
 */
export function parseConfig(cwd) {
  const resolvedCwd = cwd || process.cwd();

  // Check cache
  if (_cache.has(resolvedCwd)) {
    return _cache.get(resolvedCwd);
  }

  const configPath = join(resolvedCwd, '.planning', 'config.json');

  let parsed = {};
  try {
    const raw = readFileSync(configPath, 'utf-8');
    parsed = JSON.parse(raw);
  } catch {
    // File missing or corrupt — use all defaults
    const defaults = Object.freeze({ ...CONFIG_DEFAULTS });
    _cache.set(resolvedCwd, defaults);
    return defaults;
  }

  // Build config with defaults — support nested workflow section and nested object merging
  const result = {};
  for (const [key, defaultValue] of Object.entries(CONFIG_DEFAULTS)) {
    if (parsed[key] !== undefined) {
      // Handle parallelization coercion: {enabled: true} → true
      if (key === 'parallelization') {
        if (typeof parsed[key] === 'boolean') {
          result[key] = parsed[key];
        } else if (typeof parsed[key] === 'object' && parsed[key] !== null && 'enabled' in parsed[key]) {
          result[key] = parsed[key].enabled;
        } else {
          result[key] = defaultValue;
        }
      } else if (NESTED_OBJECT_KEYS.has(key)) {
        // Shallow merge: user overrides + defaults for unset sub-keys
        if (typeof parsed[key] === 'object' && parsed[key] !== null) {
          result[key] = Object.freeze({ ...defaultValue, ...parsed[key] });
        } else {
          result[key] = defaultValue;
        }
      } else {
        result[key] = parsed[key];
      }
    } else if (parsed.workflow && ['research', 'plan_checker', 'verifier'].includes(key)) {
      // Check nested workflow section
      const nestedKey = key === 'plan_checker' ? 'plan_check' : key;
      if (parsed.workflow[nestedKey] !== undefined) {
        result[key] = parsed.workflow[nestedKey];
      } else if (parsed.workflow[key] !== undefined) {
        result[key] = parsed.workflow[key];
      } else {
        result[key] = defaultValue;
      }
    } else {
      result[key] = defaultValue;
    }
  }

  const frozen = Object.freeze(result);
  _cache.set(resolvedCwd, frozen);
  return frozen;
}

/**
 * Invalidate cached config for a given CWD (or all if no CWD).
 * @param {string} [cwd] - Specific CWD to invalidate, or all if omitted
 */
export function invalidateConfig(cwd) {
  if (cwd) {
    _cache.delete(cwd);
  } else {
    _cache.clear();
  }
}
