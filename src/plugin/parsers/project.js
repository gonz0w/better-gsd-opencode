import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * PROJECT.md parser for in-process reading.
 * Extracts core value, tech stack, and current milestone from .planning/PROJECT.md.
 *
 * Self-contained — regex patterns for PROJECT.md format.
 * No imports from src/lib/ to keep plugin bundle independent.
 */

// Module-level cache: cwd → frozen parsed project
const _cache = new Map();

/**
 * Parse PROJECT.md from the given working directory (or CWD).
 * Returns a frozen object with structured accessors, or null if file doesn't exist.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {object|null} Frozen project object or null
 */
export function parseProject(cwd) {
  const resolvedCwd = cwd || process.cwd();

  // Check cache
  if (_cache.has(resolvedCwd)) {
    return _cache.get(resolvedCwd);
  }

  const projectPath = join(resolvedCwd, '.planning', 'PROJECT.md');

  let raw;
  try {
    raw = readFileSync(projectPath, 'utf-8');
  } catch {
    return null;
  }

  if (!raw || raw.trim().length === 0) {
    return null;
  }

  // Extract "Core Value" or "Core value:" field
  const coreValueMatch = raw.match(/##\s*Core\s+Value\s*\n+([^\n]+)/i)
    || raw.match(/\*\*Core\s+[Vv]alue:?\*\*:?\s*([^\n]+)/i);
  const coreValue = coreValueMatch ? coreValueMatch[1].trim() : null;

  // Extract tech stack summary from Context section (one-line summary)
  // Look for "Tech stack:" or "Tech:" in the Context section
  const techStackMatch = raw.match(/Tech\s+stack:\s*([^\n]+)/i)
    || raw.match(/\*\*Tech:?\*\*:?\s*([^\n]+)/i);
  const techStack = techStackMatch ? techStackMatch[1].trim() : null;

  // Extract current milestone heading
  const milestoneMatch = raw.match(/##\s*Current\s+Milestone:\s*([^\n]+)/i);
  const currentMilestone = milestoneMatch ? milestoneMatch[1].trim() : null;

  const result = Object.freeze({
    raw,
    coreValue,
    techStack,
    currentMilestone,
  });

  _cache.set(resolvedCwd, result);
  return result;
}

/**
 * Invalidate cached project for a given CWD (or all if no CWD).
 * @param {string} [cwd] - Specific CWD to invalidate, or all if omitted
 */
export function invalidateProject(cwd) {
  if (cwd) {
    _cache.delete(cwd);
  } else {
    _cache.clear();
  }
}
