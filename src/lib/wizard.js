/**
 * Multi-step wizard orchestration for interactive CLI workflows.
 * 
 * @module wizard
 */

const { createPrompt, isAbortError } = require('./prompts');

/**
 * WizardRunner class for orchestrating multi-step interactive workflows.
 */
class WizardRunner {
  /**
   * Create a new WizardRunner.
   * 
   * @param {Array<Object>} steps - Array of step definitions
   * @param {Object} [options={}] - Wizard options
   * @param {Function} [options.onStep] - Callback called after each step (answers, step, index)
   * @param {Function} [options.onAbort] - Callback called on abort
   * @param {boolean} [options.validateEach=false] - Validate each step before proceeding
   */
  constructor(steps, options = {}) {
    this.steps = steps;
    this.options = options;
    this.answers = {};
    this.currentStep = 0;
    this.aborted = false;
  }

  /**
   * Execute the wizard steps sequentially.
   * 
   * @returns {Promise<Object|null>} Collected answers object, or null if aborted
   */
  async run() {
    try {
      for (let i = 0; i < this.steps.length; i++) {
        this.currentStep = i;
        const step = this.steps[i];
        
        // Build inquirer question from step definition
        const question = this._buildQuestion(step);
        
        // Skip step if condition is not met
        if (step.condition && !step.condition(this.answers)) {
          continue;
        }
        
        // Execute the step
        const result = await createPrompt([question]);
        
        // Apply transformer if provided
        if (step.transform) {
          Object.assign(this.answers, step.transform(result));
        } else {
          Object.assign(this.answers, result);
        }
        
        // Run onStep callback
        if (this.options.onStep) {
          this.options.onStep(this.answers, step, i);
        }
        
        // Validate step if enabled
        if (this.options.validateEach && step.validate) {
          const validation = step.validate(this.answers[step.name]);
          if (validation !== true) {
            throw new Error(`Validation failed: ${validation}`);
          }
        }
      }
      
      return this.answers;
    } catch (error) {
      if (isAbortError(error)) {
        this.aborted = true;
        if (this.options.onAbort) {
          this.options.onAbort(this.answers);
        }
        return null;
      }
      throw error;
    }
  }

  /**
   * Handle graceful abort of the wizard.
   * 
   * @returns {Object} Current progress (partial answers)
   */
  abort() {
    this.aborted = true;
    return this.getProgress();
  }

  /**
   * Get current progress.
   * 
   * @returns {Object} Current answers and step info
   */
  getProgress() {
    return {
      answers: { ...this.answers },
      currentStep: this.currentStep,
      totalSteps: this.steps.length,
      aborted: this.aborted,
    };
  }

  /**
   * Build inquirer question from step definition.
   * 
   * @param {Object} step - Step definition
   * @returns {Object} Inquirer question object
   */
  _buildQuestion(step) {
    const question = {
      name: step.name,
      message: step.message,
    };

    // Handle different input types
    switch (step.type) {
      case 'input':
        question.type = 'input';
        if (step.default) question.default = step.default;
        if (step.validate) question.validate = step.validate;
        if (step.mask) question.mask = true;
        break;
        
      case 'confirm':
        question.type = 'confirm';
        question.default = step.default !== undefined ? step.default : false;
        break;
        
      case 'list':
        question.type = 'list';
        question.choices = step.choices || [];
        if (step.default !== undefined) question.default = step.default;
        break;
        
      case 'checkbox':
        question.type = 'checkbox';
        question.choices = step.choices || [];
        question.default = step.default || [];
        break;
        
      case 'editor':
        question.type = 'editor';
        if (step.default) question.default = step.default;
        break;
        
      default:
        question.type = 'input';
    }

    return question;
  }
}

/**
 * Run a wizard with a simple array of step definitions.
 * 
 * @param {Array<Object>} steps - Array of step definitions
 * @param {Object} [options={}] - Wizard options
 * @returns {Promise<Object|null>} Collected answers, or null if aborted
 */
async function runWizard(steps, options = {}) {
  const runner = new WizardRunner(steps, options);
  return runner.run();
}

/**
 * Check if an error is an abort condition.
 * 
 * @param {Error} error - Error to check
 * @returns {boolean} True if this represents an abort
 */
function isAborted(error) {
  return isAbortError(error);
}

/**
 * Validate answers against current step rules.
 * 
 * @param {Object} answers - Current answers
 * @param {Object} step - Step definition with validation rules
 * @returns {boolean|string} True if valid, error message if invalid
 */
function validateStep(answers, step) {
  if (!step.validate) return true;
  
  const value = answers[step.name];
  return step.validate(value);
}

/**
 * Transform answers using transformer functions.
 * 
 * @param {Object} answers - Raw answers
 * @param {Object|Function} transformers - Transformer functions or object of transformers
 * @returns {Object} Transformed answers
 */
function transformAnswers(answers, transformers) {
  if (typeof transformers === 'function') {
    return transformers(answers);
  }
  
  const result = {};
  for (const [key, value] of Object.entries(answers)) {
    if (transformers[key]) {
      result[key] = transformers[key](value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// =============================================================================
// Example Wizards
// =============================================================================

/**
 * Create a new project wizard.
 * Returns step definitions for project creation flow.
 * 
 * @param {Object} [options={}] - Wizard options
 * @returns {Array<Object>} Step definitions
 */
function createProjectWizard(options = {}) {
  return [
    {
      name: 'projectName',
      type: 'input',
      message: 'Enter project name:',
      validate: (value) => {
        if (!value || value.length < 3) return 'Project name must be at least 3 characters';
        if (value.length > 50) return 'Project name must be less than 50 characters';
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
          return 'Only letters, numbers, hyphens, and underscores allowed';
        }
        return true;
      },
    },
    {
      name: 'description',
      type: 'input',
      message: 'Enter project description:',
      default: options.description || '',
    },
    {
      name: 'techStack',
      type: 'input',
      message: 'Enter tech stack (comma-separated):',
      default: options.techStack || 'JavaScript, Node.js',
    },
    {
      name: 'milestone',
      type: 'list',
      message: 'Select initial milestone:',
      choices: ['MVP', 'Beta', 'Production', 'Custom'],
      default: 0,
    },
    {
      name: 'confirm',
      type: 'confirm',
      message: 'Create project with these settings?',
      default: true,
    },
  ];
}

/**
 * Create a phase planning wizard.
 * Returns step definitions for planning a phase.
 * 
 * @param {Object} [options={}] - Wizard options
 * @returns {Array<Object>} Step definitions
 */
function planPhaseWizard(options = {}) {
  return [
    {
      name: 'phaseName',
      type: 'input',
      message: 'Enter phase name:',
      validate: (value) => {
        if (!value || value.length < 3) return 'Phase name must be at least 3 characters';
        return true;
      },
    },
    {
      name: 'goal',
      type: 'input',
      message: 'What is the goal of this phase?',
      default: options.goal || '',
    },
    {
      name: 'type',
      type: 'list',
      message: 'Select phase type:',
      choices: ['Execution', 'Research', 'Planning', 'Verification'],
      default: 0,
    },
    {
      name: 'tasks',
      type: 'checkbox',
      message: 'Select required capabilities:',
      choices: [
        'Code Implementation',
        'Testing',
        'Documentation',
        'Code Review',
        'Performance Optimization',
      ],
      default: ['Code Implementation'],
    },
    {
      name: 'confirm',
      type: 'confirm',
      message: 'Proceed with creating this phase?',
      default: true,
    },
  ];
}

module.exports = {
  // Core classes and functions
  WizardRunner,
  runWizard,
  isAborted,
  
  // Utility functions
  validateStep,
  transformAnswers,
  
  // Example wizards
  createProjectWizard,
  planPhaseWizard,
};
