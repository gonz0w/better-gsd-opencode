import { parseState } from './parsers/state.js';
import { parseRoadmap } from './parsers/roadmap.js';
import { parsePlans } from './parsers/plan.js';
import { parseConfig } from './parsers/config.js';
import { parseProject } from './parsers/project.js';
import { parseIntent } from './parsers/intent.js';

/**
 * Unified ProjectState facade over all parsers.
 * Composes data from all 6 parsers into a single frozen object.
 *
 * Uses existing parser caches — no additional caching layer needed.
 * Each parser maintains its own Map cache with frozen results.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {object|null} Frozen project state object, or null if no .planning/
 */
export function getProjectState(cwd) {
  const resolvedCwd = cwd || process.cwd();

  // If no STATE.md exists, there's no .planning/ directory
  const state = parseState(resolvedCwd);
  if (!state) {
    return null;
  }

  const roadmap = parseRoadmap(resolvedCwd);
  const config = parseConfig(resolvedCwd);
  const project = parseProject(resolvedCwd);
  const intent = parseIntent(resolvedCwd);

  // Derive current phase number from state.phase field
  // Format: "73 — Context Injection" or "73 - Context Injection" or just "73"
  let phaseNum = null;
  if (state.phase) {
    const phaseMatch = state.phase.match(/^(\d+)/);
    if (phaseMatch) {
      phaseNum = parseInt(phaseMatch[1], 10);
    }
  }

  // Get current phase details from roadmap
  let currentPhase = null;
  if (phaseNum && roadmap) {
    currentPhase = roadmap.getPhase(phaseNum);
  }

  // Get current milestone from roadmap
  const currentMilestone = roadmap ? roadmap.currentMilestone : null;

  // Parse plans for current phase
  let plans = Object.freeze([]);
  if (phaseNum) {
    plans = parsePlans(phaseNum, resolvedCwd);
  }

  return Object.freeze({
    state,
    roadmap,
    config,
    project,
    intent,
    plans,
    currentPhase,
    currentMilestone,
  });
}
