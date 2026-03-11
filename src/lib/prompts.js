/**
 * Prompt factory and reusable question templates for interactive CLI workflows.
 * Uses inquirer v8 for prompting.
 * 
 * @module prompts
 */

let inquirer;

/**
 * Lazy-load inquirer to avoid issues when not in interactive mode.
 * This allows the module to be imported even without inquirer installed.
 */
function getInquirer() {
  if (!inquirer) {
    try {
      inquirer = require('inquirer');
    } catch (err) {
      throw new Error('inquirer is required for interactive prompts. Run: npm install inquirer');
    }
  }
  return inquirer;
}

/**
 * Create a text input prompt.
 * 
 * @param {string} name - Name of the prompt (used as answer key)
 * @param {string} message - Question to display
 * @param {Object} [options={}] - Additional options
 * @param {string} [options.default=''] - Default value
 * @param {Function} [options.validate] - Validation function (value) => true/string
 * @param {boolean} [options.mask=false] - Mask input (for passwords)
 * @returns {Promise<Object>} Answers object with the prompt name as key
 */
function inputPrompt(name, message, options = {}) {
  const inq = getInquirer();
  return inq.prompt([{
    type: 'input',
    name,
    message,
    default: options.default || '',
    validate: options.validate,
    mask: options.mask,
  }]);
}

/**
 * Create a yes/no confirmation prompt.
 * 
 * @param {string} name - Name of the prompt
 * @param {string} message - Question to display
 * @param {boolean} [defaultValue=false] - Default value (true/false)
 * @returns {Promise<Object>} Answers object
 */
function confirmPrompt(name, message, defaultValue = false) {
  const inq = getInquirer();
  return inq.prompt([{
    type: 'confirm',
    name,
    message,
    default: defaultValue,
  }]);
}

/**
 * Create a single-selection list prompt.
 * 
 * @param {string} name - Name of the prompt
 * @param {string} message - Question to display
 * @param {Array<string|Object>} choices - Array of choices
 * @param {string} [options.default] - Default choice (by value)
 * @returns {Promise<Object>} Answers object
 */
function listPrompt(name, message, choices, options = {}) {
  const inq = getInquirer();
  return inq.prompt([{
    type: 'list',
    name,
    message,
    choices,
    default: options.default,
  }]);
}

/**
 * Create a multi-selection checkbox prompt.
 * 
 * @param {string} name - Name of the prompt
 * @param {string} message - Question to display
 * @param {Array<string|Object>} choices - Array of choices
 * @param {Array<string>} [options.default=[]] - Default selections
 * @returns {Promise<Object>} Answers object
 */
function checkboxPrompt(name, message, choices, options = {}) {
  const inq = getInquirer();
  return inq.prompt([{
    type: 'checkbox',
    name,
    message,
    choices,
    default: options.default || [],
  }]);
}

/**
 * Create a generic prompt with multiple questions.
 * 
 * @param {Array<Object>} questions - Array of inquirer question objects
 * @returns {Promise<Object>} Answers object with all responses
 */
function createPrompt(questions) {
  const inq = getInquirer();
  return inq.prompt(questions);
}

// =============================================================================
// Common Prompt Templates
// =============================================================================

/**
 * Prompt template for project name input with validation.
 * Validates: 3-50 chars, valid filename characters.
 */
const projectNamePrompt = {
  name: 'projectName',
  type: 'input',
  message: 'Enter project name:',
  validate: (value) => {
    if (!value || value.length < 3) {
      return 'Project name must be at least 3 characters';
    }
    if (value.length > 50) {
      return 'Project name must be less than 50 characters';
    }
    // Valid filename characters only
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Project name can only contain letters, numbers, hyphens, and underscores';
    }
    return true;
  },
};

/**
 * Creates a phase selection prompt with the given phase list.
 * 
 * @param {Array<Object>} phases - Array of phase objects with {num, name, status}
 * @returns {Object} Inquirer question object
 */
function createPhaseSelectionPrompt(phases) {
  const choices = phases.map(p => ({
    name: `${p.num}: ${p.name} [${p.status}]`,
    value: p.num,
  }));
  
  return {
    name: 'phase',
    type: 'list',
    message: 'Select a phase:',
    choices,
  };
}

/**
 * Creates a plan selection prompt for the current phase.
 * 
 * @param {Array<Object>} plans - Array of plan objects with {num, status}
 * @returns {Object} Inquirer question object
 */
function createPlanSelectionPrompt(plans) {
  const choices = plans.map(p => ({
    name: `Plan ${p.num} [${p.status}]`,
    value: p.num,
  }));
  
  return {
    name: 'plan',
    type: 'list',
    message: 'Select a plan:',
    choices,
  };
}

/**
 * Creates a confirmation prompt with custom message.
 * 
 * @param {string} message - Confirmation message
 * @param {string} [name='confirm'] - Answer key
 * @param {boolean} [defaultValue=false] - Default value
 * @returns {Object} Inquirer question object
 */
function createConfirmActionPrompt(message, name = 'confirm', defaultValue = false) {
  return {
    name,
    type: 'confirm',
    message,
    default: defaultValue,
  };
}

// =============================================================================
// Prompt Utilities
// =============================================================================

/**
 * Merge defaults into questions array.
 * 
 * @param {Array<Object>} questions - Array of inquirer questions
 * @param {Object} defaults - Default values keyed by question name
 * @returns {Array<Object>} Questions with defaults merged
 */
function promptWithDefaults(questions, defaults) {
  return questions.map(q => ({
    ...q,
    default: defaults[q.name] !== undefined ? defaults[q.name] : q.default,
  }));
}

/**
 * Run a validator function on input value.
 * 
 * @param {Function} validator - Validator function (value) => true/string
 * @param {string} value - Value to validate
 * @returns {boolean|string} True if valid, error string if invalid
 */
function validateInput(validator, value) {
  try {
    return validator(value);
  } catch (err) {
    return err.message || 'Validation error';
  }
}

/**
 * Check if an inquirer error is an abort (Ctrl+C) error.
 * 
 * @param {Error} error - Inquirer error
 * @returns {boolean} True if this is an abort error
 */
function isAbortError(error) {
  if (!error) return false;
  return error.name === 'AbortError' || 
         error.message?.includes('User force closed') ||
         error.message?.includes('aborted');
}

module.exports = {
  // Core prompt functions
  inputPrompt,
  confirmPrompt,
  listPrompt,
  checkboxPrompt,
  createPrompt,
  
  // Prompt templates
  projectNamePrompt,
  createPhaseSelectionPrompt,
  createPlanSelectionPrompt,
  createConfirmActionPrompt,
  
  // Utilities
  promptWithDefaults,
  validateInput,
  isAbortError,
};
