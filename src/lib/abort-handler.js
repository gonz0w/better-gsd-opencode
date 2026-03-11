/**
 * Graceful Ctrl+C and abort handling for interactive workflows.
 * 
 * @module abort-handler
 */

const fs = require('fs');
const path = require('path');

/**
 * Global cleanup callbacks registry.
 */
const cleanupCallbacks = [];
let abortHandlerInstalled = false;
let isAborting = false;

/**
 * Install the abort handler with cleanup callbacks.
 * 
 * @param {Object} [options={}] - Handler options
 * @param {Function|Array<Function>} [options.onCleanup] - Cleanup callback(s) to run on abort
 * @param {string} [options.message] - Message to show on abort
 * @param {boolean} [options.saveProgress=false] - Whether to save progress before exiting
 */
function setupAbortHandler(options = {}) {
  if (abortHandlerInstalled) return;
  
  const callbacks = Array.isArray(options.onCleanup) 
    ? options.onCleanup 
    : options.onCleanup ? [options.onCleanup] : [];
  
  callbacks.forEach(cb => cleanupCallbacks.push(cb));
  
  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => handleAbort('SIGINT'));
  
  // Handle SIGTERM (graceful termination)
  process.on('SIGTERM', () => handleAbort('SIGTERM'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('\nUncaught exception:', error.message);
    handleAbort('uncaughtException');
  });
  
  abortHandlerInstalled = true;
}

/**
 * Handle abort signal and run cleanup.
 * 
 * @param {string} reason - Abort reason (signal name)
 */
function handleAbort(reason) {
  if (isAborting) return;  // Prevent double-abort
  isAborting = true;
  
  console.log(`\n⚠ Received ${reason}. Cleaning up...`);
  
  // Run all cleanup callbacks
  for (const callback of cleanupCallbacks) {
    try {
      callback();
    } catch (err) {
      console.error('Cleanup error:', err.message);
    }
  }
  
  cleanupAndExit(1);
}

/**
 * Run cleanup and exit with code.
 * 
 * @param {number} [exitCode=0] - Exit code
 */
function cleanupAndExit(exitCode = 0) {
  // Run final cleanup
  for (const callback of cleanupCallbacks) {
    try {
      callback();
    } catch { /* ignore cleanup errors */ }
  }
  
  process.exit(exitCode);
}

// =============================================================================
// Safe Prompt Wrappers
// =============================================================================

let promptsModule = null;

/**
 * Get the prompts module lazily.
 */
function getPrompts() {
  if (!promptsModule) {
    promptsModule = require('./prompts');
  }
  return promptsModule;
}

/**
 * Wrap inquirer.prompt with abort handling.
 * Returns null on abort instead of throwing.
 * 
 * @param {Array<Object>|Object} questions - Inquirer questions
 * @param {Object} [options={}] - Prompt options
 * @param {Function} [options.onAbort] - Callback on abort
 * @returns {Promise<Object|null>} Answers object, or null if aborted
 */
async function safePrompt(questions, options = {}) {
  const { createPrompt, isAbortError } = getPrompts();
  
  // Normalize to array
  const questionArray = Array.isArray(questions) ? questions : [questions];
  
  try {
    return await createPrompt(questionArray);
  } catch (error) {
    if (isAbortError(error)) {
      if (options.onAbort) {
        options.onAbort(error);
      }
      return null;
    }
    throw error;
  }
}

/**
 * Check if an error is an inquirer abort condition.
 * 
 * @param {Error} error - Error to check
 * @returns {boolean} True if this is an abort error
 */
function isAbortError(error) {
  const { isAbortError: checkAbort } = getPrompts();
  return checkAbort(error);
}

/**
 * Format an abort error into a user-friendly message.
 * 
 * @param {Error} error - Inquirer abort error
 * @returns {string} User-friendly message
 */
function formatAbortMessage(error) {
  if (!error) return 'Operation cancelled';
  
  if (error.name === 'AbortError') {
    return 'Operation cancelled (Ctrl+C)';
  }
  
  if (error.message?.includes('User force closed')) {
    return 'Operation cancelled by user';
  }
  
  if (error.message?.includes('aborted')) {
    return 'Operation was aborted';
  }
  
  return error.message || 'Operation cancelled';
}

// =============================================================================
// Progress Persistence
// =============================================================================

const PROGRESS_DIR = '.planning/progress';

/**
 * Ensure progress directory exists.
 */
function ensureProgressDir() {
  const dir = path.join(process.cwd(), PROGRESS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Save current progress to file for later resume.
 * 
 * @param {Object} state - Progress state to save
 * @param {string} [filename='wizard-progress.json'] - Filename to save to
 * @returns {string} Path to saved file
 */
function saveProgress(state, filename = 'wizard-progress.json') {
  ensureProgressDir();
  const filePath = path.join(process.cwd(), PROGRESS_DIR, filename);
  
  const data = {
    savedAt: new Date().toISOString(),
    state,
    pid: process.pid,
  };
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

/**
 * Load saved progress from file.
 * 
 * @param {string} [filename='wizard-progress.json'] - Filename to load from
 * @returns {Object|null} Saved state, or null if not found
 */
function loadProgress(filename = 'wizard-progress.json') {
  const filePath = path.join(process.cwd(), PROGRESS_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.state || null;
  } catch (err) {
    return null;
  }
}

/**
 * Clear saved progress file.
 * 
 * @param {string} [filename='wizard-progress.json'] - Filename to clear
 * @returns {boolean} True if file was removed
 */
function clearProgress(filename = 'wizard-progress.json') {
  const filePath = path.join(process.cwd(), PROGRESS_DIR, filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Check if there's saved progress that can be resumed.
 * 
 * @param {string} [filename='wizard-progress.json'] - Filename to check
 * @returns {boolean} True if there's saved progress
 */
function hasProgress(filename = 'wizard-progress.json') {
  const filePath = path.join(process.cwd(), PROGRESS_DIR, filename);
  return fs.existsSync(filePath);
}

module.exports = {
  // Abort handling
  setupAbortHandler,
  handleAbort,
  cleanupAndExit,
  
  // Safe prompt wrappers
  safePrompt,
  isAbortError,
  formatAbortMessage,
  
  // Progress persistence
  saveProgress,
  loadProgress,
  clearProgress,
  hasProgress,
};
