/**
 * CLI Tool Fallback Wrapper Module
 * 
 * Provides graceful fallback from CLI tools to Node.js implementations.
 * Enables operations to gracefully degrade when CLI tools are unavailable.
 */

const { detectTool } = require('./detector.js');
const { getInstallGuidance } = require('./install-guidance.js');

/**
 * Wrap a CLI operation with fallback to Node.js implementation
 * 
 * @param {string} toolName - Name of the CLI tool to check
 * @param {Function} cliFn - Function to execute if CLI tool is available
 * @param {Function} nodeJsFallback - Function to execute if CLI tool is unavailable
 * @returns {object} - Operation result with success, usedFallback, guidance, result, error
 * 
 * @example
 * const result = withToolFallback(
 *   'ripgrep',
 *   () => execFileSync('rg', ['pattern', path]),
 *   () => fallbackGrep(pattern, path)
 * );
 * 
 * if (result.usedFallback) {
 *   console.log('Note: Using Node.js fallback. ' + result.guidance.installCommand);
 * }
 */
function withToolFallback(toolName, cliFn, nodeJsFallback) {
  const toolResult = detectTool(toolName);
  
  // Check if tool is available
  if (toolResult.available) {
    try {
      const result = cliFn();
      return {
        success: true,
        usedFallback: false,
        result: result
      };
    } catch (error) {
      return {
        success: false,
        usedFallback: false,
        error: error.message || String(error)
      };
    }
  }
  
  // Tool not available, use Node.js fallback
  try {
    const guidance = getInstallGuidance(toolName);
    const result = nodeJsFallback();
    
    return {
      success: true,
      usedFallback: true,
      guidance: guidance ? {
        name: guidance.name,
        description: guidance.description,
        installCommand: guidance.installCommand,
        installInstructions: guidance.installInstructions
      } : null,
      result: result
    };
  } catch (error) {
    const guidance = getInstallGuidance(toolName);
    return {
      success: false,
      usedFallback: true,
      guidance: guidance ? {
        name: guidance.name,
        description: guidance.description,
        installCommand: guidance.installCommand,
        installInstructions: guidance.installInstructions
      } : null,
      error: error.message || String(error)
    };
  }
}

/**
 * Check if a tool is available without executing any operation
 * @param {string} toolName - Name of the tool to check
 * @returns {boolean} - True if tool is available
 */
function isToolAvailable(toolName) {
  const result = detectTool(toolName);
  return result.available;
}

/**
 * Get guidance for a tool without executing any operation
 * @param {string} toolName - Name of the tool
 * @returns {object|null} - Guidance object or null if tool not found
 */
function getToolGuidance(toolName) {
  return getInstallGuidance(toolName);
}

module.exports = {
  withToolFallback,
  isToolAvailable,
  getToolGuidance
};
