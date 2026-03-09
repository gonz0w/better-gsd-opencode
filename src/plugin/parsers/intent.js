import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * INTENT.md parser for in-process reading.
 * Extracts objective and outcomes from .planning/INTENT.md.
 *
 * Self-contained — regex patterns for INTENT.md format.
 * No imports from src/lib/ to keep plugin bundle independent.
 */

// Module-level cache: cwd → frozen parsed intent
const _cache = new Map();

/**
 * Parse INTENT.md from the given working directory (or CWD).
 * Returns a frozen object with structured accessors, or null if file doesn't exist.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {object|null} Frozen intent object or null
 */
export function parseIntent(cwd) {
  const resolvedCwd = cwd || process.cwd();

  // Check cache
  if (_cache.has(resolvedCwd)) {
    return _cache.get(resolvedCwd);
  }

  const intentPath = join(resolvedCwd, '.planning', 'INTENT.md');

  let raw;
  try {
    raw = readFileSync(intentPath, 'utf-8');
  } catch {
    return null;
  }

  if (!raw || raw.trim().length === 0) {
    return null;
  }

  // Extract objective from <objective> tags
  const objectiveMatch = raw.match(/<objective>([\s\S]*?)<\/objective>/);
  const objective = objectiveMatch ? objectiveMatch[1].trim() : null;

  // Extract outcomes from <outcomes> section — array of DO-XX entries
  const outcomesMatch = raw.match(/<outcomes>([\s\S]*?)<\/outcomes>/);
  const outcomes = [];
  if (outcomesMatch) {
    const outcomesContent = outcomesMatch[1];
    const entryPattern = /-\s*(DO-\d+)\s*(?:\[P\d+\])?\s*:\s*([^\n]+)/g;
    let match;
    while ((match = entryPattern.exec(outcomesContent)) !== null) {
      outcomes.push(Object.freeze({
        id: match[1],
        text: match[2].trim(),
      }));
    }
  }

  const result = Object.freeze({
    raw,
    objective,
    outcomes: Object.freeze(outcomes),
  });

  _cache.set(resolvedCwd, result);
  return result;
}

/**
 * Invalidate cached intent for a given CWD (or all if no CWD).
 * @param {string} [cwd] - Specific CWD to invalidate, or all if omitted
 */
export function invalidateIntent(cwd) {
  if (cwd) {
    _cache.delete(cwd);
  } else {
    _cache.clear();
  }
}
