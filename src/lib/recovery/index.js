/**
 * Recovery Module Index
 * 
 * Exports all recovery-related modules:
 * - autoRecovery: Autonomous deviation handling
 * - checkpointAdvisor: Complexity-based checkpoint decisions
 * - stuckDetector: Stuck/loop pattern detection
 */

const autoRecovery = require('./autoRecovery.js');
const checkpointAdvisor = require('./checkpointAdvisor.js');
const stuckDetector = require('./stuck-detector.js');

/**
 * LoopDetector - alias for StuckDetector (for naming consistency)
 */
const LoopDetector = stuckDetector.StuckDetector;

/**
 * Create a loop detector instance (alias for createStuckDetector)
 */
function createLoopDetector(config) {
  return stuckDetector.createStuckDetector(config);
}

module.exports = {
  // Auto recovery for deviations
  createAutoRecovery: autoRecovery.createAutoRecovery,
  AutoRecovery: autoRecovery.AutoRecovery,
  RECOVERY_STRATEGIES: autoRecovery.RECOVERY_STRATEGIES,
  DEVIATION_PATTERNS: autoRecovery.DEVIATION_PATTERNS,
  
  // Checkpoint advisor
  createCheckpointAdvisor: checkpointAdvisor.createCheckpointAdvisor,
  CheckpointAdvisor: checkpointAdvisor.CheckpointAdvisor,
  COMPLEXITY_FACTORS: checkpointAdvisor.COMPLEXITY_FACTORS,
  CHECKPOINT_RECOMMENDATIONS: checkpointAdvisor.CHECKPOINT_RECOMMENDATIONS,
  
  // Stuck/loop detection
  createStuckDetector: stuckDetector.createStuckDetector,
  StuckDetector: stuckDetector.StuckDetector,
  
  // Loop detector (alias)
  createLoopDetector,
  LoopDetector
};
