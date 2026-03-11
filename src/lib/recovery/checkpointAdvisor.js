/**
 * Checkpoint Advisor Module
 * 
 * Analyzes task complexity and recommends appropriate checkpoint types:
 * - Complexity 0-3: No checkpoint (autonomous)
 * - Complexity 4-6: checkpoint:human-verify
 * - Complexity 7-9: checkpoint:decision
 * - Complexity 10+: checkpoint:human-action
 */

/**
 * Complexity factors and their weights
 */
const COMPLEXITY_FACTORS = {
  fileCount: {
    weight: 2,
    thresholds: [
      { max: 1, score: 0 },
      { max: 3, score: 1 },
      { max: 5, score: 2 },
      { max: Infinity, score: 3 }
    ]
  },
  taskType: {
    weight: 3,
    types: {
      'auto': 0,
      'checkpoint:human-verify': 2,
      'checkpoint:decision': 4,
      'checkpoint:human-action': 5
    }
  },
  dependencies: {
    weight: 2,
    thresholds: [
      { max: 0, score: 0 },
      { max: 1, score: 1 },
      { max: 2, score: 2 },
      { max: Infinity, score: 3 }
    ]
  },
  estimatedDuration: {
    weight: 2,
    thresholds: [
      { max: 15, score: 0 },   // < 15 min
      { max: 30, score: 1 },   // 15-30 min
      { max: 45, score: 2 },   // 30-45 min
      { max: 60, score: 3 },   // 45-60 min
      { max: Infinity, score: 4 } // > 60 min
    ]
  },
  externalServices: {
    weight: 4,
    thresholds: [
      { max: 0, score: 0 },
      { max: 1, score: 2 },
      { max: Infinity, score: 5 }
    ]
  },
  userSetup: {
    weight: 3,
    thresholds: [
      { max: 0, score: 0 },
      { max: 1, score: 3 },
      { max: Infinity, score: 5 }
    ]
  },
  hasTests: {
    weight: 1,
    thresholds: [
      { max: 0, score: 0 },
      { max: Infinity, score: -1 } // Having tests reduces complexity slightly
    ]
  }
};

/**
 * Checkpoint recommendation thresholds
 */
const CHECKPOINT_RECOMMENDATIONS = [
  { maxScore: 3, checkpointType: null, description: 'Autonomous execution' },
  { maxScore: 6, checkpointType: 'human-verify', description: 'Human verification recommended' },
  { maxScore: 9, checkpointType: 'decision', description: 'Decision checkpoint recommended' },
  { maxScore: Infinity, checkpointType: 'human-action', description: 'Human action required' }
];

/**
 * CheckpointAdvisor class
 */
class CheckpointAdvisor {
  constructor(config = {}) {
    this.config = {
      ...config,
      weights: { ...COMPLEXITY_FACTORS, ...config.weights }
    };
  }

  /**
   * Analyze task complexity
   * @param {Object} task - Task object
   * @returns {Object} Analysis result
   */
  analyzeComplexity(task) {
    const scores = {};
    let totalScore = 0;
    
    // File count
    const fileCount = task.files?.length || task.filesModified?.length || 0;
    scores.fileCount = this._scoreFromThresholds(fileCount, COMPLEXITY_FACTORS.fileCount);
    totalScore += scores.fileCount * COMPLEXITY_FACTORS.fileCount.weight;
    
    // Task type
    const taskType = task.type || 'auto';
    scores.taskType = COMPLEXITY_FACTORS.taskType.types[taskType] || 0;
    totalScore += scores.taskType * COMPLEXITY_FACTORS.taskType.weight;
    
    // Dependencies
    const dependencyCount = task.dependsOn?.length || task.dependencies?.length || 0;
    scores.dependencies = this._scoreFromThresholds(dependencyCount, COMPLEXITY_FACTORS.dependencies);
    totalScore += scores.dependencies * COMPLEXITY_FACTORS.dependencies.weight;
    
    // Estimated duration (in minutes)
    const duration = task.estimatedDuration || task.duration || 15;
    scores.estimatedDuration = this._scoreFromThresholds(duration, COMPLEXITY_FACTORS.estimatedDuration);
    totalScore += scores.estimatedDuration * COMPLEXITY_FACTORS.estimatedDuration.weight;
    
    // External services
    const externalCount = task.externalServices?.length || 0;
    scores.externalServices = this._scoreFromThresholds(externalCount, COMPLEXITY_FACTORS.externalServices);
    totalScore += scores.externalServices * COMPLEXITY_FACTORS.externalServices.weight;
    
    // User setup required
    const userSetupCount = task.userSetup?.length || (task.requiresUserSetup ? 1 : 0);
    scores.userSetup = this._scoreFromThresholds(userSetupCount, COMPLEXITY_FACTORS.userSetup);
    totalScore += scores.userSetup * COMPLEXITY_FACTORS.userSetup.weight;
    
    // Has tests
    const hasTests = task.hasTests || task.tests?.length > 0 ? 1 : 0;
    scores.hasTests = this._scoreFromThresholds(hasTests, COMPLEXITY_FACTORS.hasTests);
    totalScore += scores.hasTests * COMPLEXITY_FACTORS.hasTests.weight;
    
    // Override from task explicit complexity
    if (task.complexityScore !== undefined) {
      totalScore = task.complexityScore;
      scores.override = task.complexityScore;
    }
    
    // Override from autonomous flag (low complexity tasks can override)
    if (task.autonomous === false && totalScore < 4) {
      scores.autonomousOverride = -totalScore + 4; // Boost to at least 4
      totalScore += scores.autonomousOverride;
    }
    
    return {
      totalScore: Math.max(0, Math.round(totalScore * 10) / 10), // Round to 1 decimal
      breakdown: scores,
      factors: {
        fileCount,
        taskType,
        dependencyCount,
        duration,
        externalCount,
        userSetupCount,
        hasTests: hasTests > 0
      }
    };
  }

  /**
   * Recommend checkpoint based on complexity analysis
   * @param {Object} task - Task object
   * @param {Object} analysis - Complexity analysis result
   * @returns {Object} Recommendation
   */
  recommendCheckpoint(task, analysis) {
    const { totalScore } = analysis;
    
    // Find appropriate recommendation
    let recommendation = CHECKPOINT_RECOMMENDATIONS[0];
    for (const rec of CHECKPOINT_RECOMMENDATIONS) {
      if (totalScore <= rec.maxScore) {
        recommendation = rec;
        break;
      }
    }
    
    // Check task's explicit autonomy setting
    const hasExplicitCheckpoint = task.type?.startsWith('checkpoint:');
    const taskAutonomy = task.autonomous;
    
    // Decision logic:
    // 1. If task explicitly has checkpoint type, use that
    // 2. If task has autonomous: false, recommend at least human-verify
    // 3. If task has autonomous: true but complexity high, override
    let finalRecommendation = recommendation.checkpointType;
    
    if (hasExplicitCheckpoint) {
      finalRecommendation = task.type.replace('checkpoint:', '');
      recommendation.description = `Explicit checkpoint: ${finalRecommendation}`;
    } else if (taskAutonomy === false && totalScore < 4) {
      finalRecommendation = 'human-verify';
      recommendation.description = 'Task marked non-autonomous, adding verification checkpoint';
    } else if (taskAutonomy === true && totalScore >= 7) {
      // High complexity but marked autonomous - add checkpoint anyway
      finalRecommendation = recommendation.checkpointType;
      recommendation.description += ' (complexity overrides autonomous flag)';
    }
    
    return {
      recommended: finalRecommendation,
      complexityScore: totalScore,
      description: recommendation.description,
      analysis,
      shouldOverrideAutonomy: taskAutonomy === true && totalScore >= 7,
      rationale: this._generateRationale(analysis, recommendation)
    };
  }

  /**
   * Analyze and recommend in one call
   * @param {Object} task - Task object
   * @returns {Object} Full recommendation with analysis
   */
  analyze(task) {
    const analysis = this.analyzeComplexity(task);
    const recommendation = this.recommendCheckpoint(task, analysis);
    return { analysis, recommendation };
  }

  /**
   * Score from thresholds
   * @private
   */
  _scoreFromThresholds(value, factor) {
    for (const threshold of factor.thresholds) {
      if (value <= threshold.max) {
        return threshold.score;
      }
    }
    return 0;
  }

  /**
   * Generate rationale for recommendation
   * @private
   */
  _generateRationale(analysis, recommendation) {
    const reasons = [];
    const { breakdown, factors } = analysis;
    
    if (factors.fileCount > 3) {
      reasons.push(`${factors.fileCount} files touched (high complexity)`);
    }
    if (factors.dependencyCount > 2) {
      reasons.push(`${factors.dependencyCount} dependencies`);
    }
    if (factors.duration > 45) {
      reasons.push(`estimated ${factors.duration}min (long task)`);
    }
    if (factors.externalCount > 0) {
      reasons.push(`${factors.externalCount} external service(s)`);
    }
    if (factors.userSetupCount > 0) {
      reasons.push('requires user setup');
    }
    if (factors.taskType !== 'auto') {
      reasons.push(`task type: ${factors.taskType}`);
    }
    
    if (reasons.length === 0) {
      reasons.push('low complexity - can execute autonomously');
    }
    
    return reasons;
  }

  /**
   * Get checkpoint type from recommendation
   * @param {string} recommendation - Recommendation string
   * @returns {string} Checkpoint type
   */
  static getCheckpointType(recommendation) {
    if (!recommendation) return null;
    return `checkpoint:${recommendation}`;
  }
}

/**
 * Create a CheckpointAdvisor instance
 * @param {Object} config - Configuration options
 * @returns {CheckpointAdvisor} CheckpointAdvisor instance
 */
function createCheckpointAdvisor(config) {
  return new CheckpointAdvisor(config);
}

module.exports = {
  createCheckpointAdvisor,
  CheckpointAdvisor,
  COMPLEXITY_FACTORS,
  CHECKPOINT_RECOMMENDATIONS
};
