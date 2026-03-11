/**
 * Auto-Recovery Module
 * 
 * Handles deviations autonomously using the 4-rule framework:
 * - Rule 1: Auto-fix bugs
 * - Rule 2: Auto-add missing critical functionality
 * - Rule 3: Auto-fix blocking issues
 * - Rule 4: Escalate architectural changes
 */

const SEVERITY = require('../review/severity.js').SEVERITY;

/**
 * Recovery strategies for each deviation rule
 */
const RECOVERY_STRATEGIES = {
  // Rule 1: Auto-fix bugs
  bug: {
    rule: 1,
    type: 'Bug',
    canAutoFix: true,
    maxAttempts: 3,
    description: 'Code doesn\'t work as intended',
    recoveryActions: [
      'Analyze error message and stack trace',
      'Fix the root cause',
      'Verify the fix works',
      'Log the fix for SUMMARY'
    ]
  },
  
  // Rule 2: Auto-add missing critical functionality
  missing_critical: {
    rule: 2,
    type: 'Missing Critical',
    canAutoFix: true,
    maxAttempts: 3,
    description: 'Missing essential features for correctness/security',
    recoveryActions: [
      'Identify missing functionality',
      'Implement the missing piece',
      'Verify it integrates correctly',
      'Log for SUMMARY'
    ]
  },
  
  // Rule 3: Auto-fix blocking issues
  blocking: {
    rule: 3,
    type: 'Blocking',
    canAutoFix: true,
    maxAttempts: 3,
    description: 'Something prevents completing the task',
    recoveryActions: [
      'Identify the blocker',
      'Resolve or find workaround',
      'Verify task can proceed',
      'Log for SUMMARY'
    ]
  },
  
  // Rule 4: Escalate architectural changes
  architectural: {
    rule: 4,
    type: 'Architectural',
    canAutoFix: false,
    maxAttempts: 1,
    description: 'Requires significant structural modification',
    recoveryActions: [
      'STOP - present decision to user',
      'Describe the change needed',
      'Explain why and impact',
      'Wait for user decision'
    ]
  }
};

/**
 * Common deviation patterns with automatic classification
 */
const DEVIATION_PATTERNS = [
  // Bugs (Rule 1)
  { pattern: /undefined is not an object|undefined.*property|Cannot read property/, type: 'bug', rule: 1 },
  { pattern: /is not a function|TypeError/, type: 'bug', rule: 1 },
  { pattern: /expected.*got|assertion failed/, type: 'bug', rule: 1 },
  { pattern: /logic error|incorrect|mistake/, type: 'bug', rule: 1 },
  
  // Missing Critical (Rule 2)
  { pattern: /missing|not found|not defined/, type: 'missing_critical', rule: 2 },
  { pattern: /no error handling|unhandled/, type: 'missing_critical', rule: 2 },
  { pattern: /no validation|invalid input/, type: 'missing_critical', rule: 2 },
  { pattern: /no auth|no authorization/, type: 'missing_critical', rule: 2 },
  
  // Blocking (Rule 3)
  { pattern: /cannot find module|module not found/, type: 'blocking', rule: 3 },
  { pattern: /dependency|package.*missing/, type: 'blocking', rule: 3 },
  { pattern: /import.*failed|require.*failed/, type: 'blocking', rule: 3 },
  { pattern: /circular dependency/, type: 'blocking', rule: 3 },
  
  // Architectural (Rule 4)
  { pattern: /new table|new schema|new database/, type: 'architectural', rule: 4 },
  { pattern: /refactor.*architecture|redesign/, type: 'architectural', rule: 4 },
  { pattern: /switch.*library|replace.*framework/, type: 'architectural', rule: 4 }
];

/**
 * AutoRecovery class
 */
class AutoRecovery {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries || 3;
    this.taskAttempts = new Map(); // taskId -> attempt count
    this.recoveryLog = [];
    this.metrics = {
      deviationsHandled: 0,
      autonomousRecoveries: 0,
      escalatedToUser: 0,
      ruleBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0 }
    };
  }

  /**
   * Classify a deviation using the 4-rule framework
   * @param {string} deviation - Deviation description or error message
   * @param {Object} context - Additional context
   * @returns {Object} Classification result
   */
  classifyDeviation(deviation, context = {}) {
    const deviationLower = deviation.toLowerCase();
    
    // Check patterns
    for (const { pattern, type, rule } of DEVIATION_PATTERNS) {
      if (pattern.test(deviationLower)) {
        return {
          type,
          rule,
          strategy: RECOVERY_STRATEGIES[type],
          description: deviation,
          context
        };
      }
    }
    
    // Default to Rule 1 (bug) if unclear
    return {
      type: 'bug',
      rule: 1,
      strategy: RECOVERY_STRATEGIES.bug,
      description: deviation,
      context,
      uncertain: true
    };
  }

  /**
   * Attempt to recover from a deviation
   * @param {Object} classification - Deviation classification
   * @param {Object} context - Recovery context (task info, etc.)
   * @returns {Object} Recovery result
   */
  attemptRecovery(classification, context = {}) {
    const { type, rule, strategy, description } = classification;
    const taskId = context.taskId || 'unknown';
    
    // Track attempts
    const attempts = (this.taskAttempts.get(taskId) || 0) + 1;
    this.taskAttempts.set(taskId, attempts);
    
    // Log the deviation
    const logEntry = {
      taskId,
      type,
      rule,
      description,
      attempt: attempts,
      timestamp: new Date().toISOString(),
      context
    };
    this.recoveryLog.push(logEntry);
    
    // Update metrics
    this.metrics.deviationsHandled++;
    this.metrics.ruleBreakdown[rule]++;
    
    // Check if can auto-fix
    if (strategy.canAutoFix) {
      if (attempts <= strategy.maxAttempts) {
        this.metrics.autonomousRecoverles++;
        return {
          success: true,
          action: 'auto_fix',
          rule,
          type,
          description: `Applying ${type} fix (attempt ${attempts}/${strategy.maxAttempts})`,
          recoveryActions: strategy.recoveryActions,
          canContinue: true,
          logEntry
        };
      } else {
        // Max attempts reached - escalate
        this.metrics.escalatedToUser++;
        return {
          success: false,
          action: 'escalate',
          rule,
          type,
          description: `Max recovery attempts (${strategy.maxAttempts}) reached for ${type}`,
          reason: 'max_attempts_exceeded',
          canContinue: false,
          requiresCheckpoint: true,
          logEntry
        };
      }
    } else {
      // Architectural - must escalate
      this.metrics.escalatedToUser++;
      return {
        success: false,
        action: 'escalate',
        rule: 4,
        type: 'architectural',
        description: 'Architectural change required - user decision needed',
        reason: 'architectural_change',
        canContinue: false,
        requiresCheckpoint: true,
        checkpointType: 'decision',
        checkpointDetails: {
          title: 'Architectural Change Required',
          description,
          context,
          options: [
            { id: 'approve', label: 'Approve Change', description: 'Proceed with the proposed architectural change' },
            { id: 'decline', label: 'Decline', description: 'Abandon this approach' },
            { id: 'alternative', label: 'Suggest Alternative', description: 'Propose a different approach' }
          ]
        },
        logEntry
      };
    }
  }

  /**
   * Get recovery strategy for a specific rule
   * @param {number} rule - Rule number (1-4)
   * @returns {Object} Strategy object
   */
  getStrategyForRule(rule) {
    const strategies = {
      1: 'bug',
      2: 'missing_critical',
      3: 'blocking',
      4: 'architectural'
    };
    return RECOVERY_STRATEGIES[strategies[rule]];
  }

  /**
   * Get current recovery metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get recovery log
   * @returns {Array} Recovery log entries
   */
  getRecoveryLog() {
    return [...this.recoveryLog];
  }

  /**
   * Reset recovery state for a task
   * @param {string} taskId - Task identifier
   */
  resetTask(taskId) {
    this.taskAttempts.delete(taskId);
  }

  /**
   * Check if task has exceeded max retries
   * @param {string} taskId - Task identifier
   * @returns {boolean} True if exceeded
   */
  hasExceededMaxRetries(taskId) {
    const attempts = this.taskAttempts.get(taskId) || 0;
    return attempts >= this.maxRetries;
  }

  /**
   * Get status for a specific task
   * @param {string} taskId - Task identifier
   * @returns {Object} Status object
   */
  getTaskStatus(taskId) {
    const attempts = this.taskAttempts.get(taskId) || 0;
    const taskLog = this.recoveryLog.filter(e => e.taskId === taskId);
    const lastEntry = taskLog[taskLog.length - 1];
    
    return {
      taskId,
      attempts,
      maxRetries: this.maxRetries,
      canRetry: attempts < this.maxRetries,
      lastDeviation: lastEntry ? lastEntry.description : null,
      recoveryLogCount: taskLog.length
    };
  }
}

/**
 * Create an AutoRecovery instance
 * @param {Object} config - Configuration options
 * @returns {AutoRecovery} AutoRecovery instance
 */
function createAutoRecovery(config) {
  return new AutoRecovery(config);
}

module.exports = {
  createAutoRecovery,
  RECOVERY_STRATEGIES,
  DEVIATION_PATTERNS,
  AutoRecovery
};
