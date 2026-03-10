'use strict';

const { getToolStatus } = require('../lib/cli-tools/detector');
const { getInstallGuidance } = require('../lib/cli-tools/install-guidance');
const { output } = require('../lib/output');

/**
 * CLI command to check tool availability
 * Shows which CLI tools (ripgrep, fd, jq, yq, bat, gh) are available vs unavailable
 */
function cmdToolsStatus(cwd, raw) {
  const status = getToolStatus();
  
  // Separate available and unavailable tools
  const available = [];
  const unavailable = [];
  
  for (const [toolName, toolInfo] of Object.entries(status)) {
    if (toolInfo.available) {
      available.push({ name: toolName, ...toolInfo });
    } else {
      unavailable.push({ name: toolName, ...toolInfo });
    }
  }
  
  // Format output for display
  const lines = [];
  lines.push('=== CLI Tool Status ===');
  lines.push('');
  
  if (available.length > 0) {
    lines.push('Available:');
    for (const tool of available) {
      const version = tool.version ? ` (${tool.version.split('\n')[0]})` : '';
      lines.push(`  ✓ ${tool.name.padEnd(8)} ${tool.path || '-'.padEnd(20)} ${tool.description}${version}`);
    }
    lines.push('');
  }
  
  if (unavailable.length > 0) {
    lines.push('Unavailable:');
    for (const tool of unavailable) {
      const guidance = getInstallGuidance(tool.name);
      const installCmd = guidance ? guidance.installCommand : 'N/A';
      lines.push(`  ✗ ${tool.name.padEnd(8)} -`.padEnd(30) + ` ${tool.description}`);
      lines.push(`                 Install: ${installCmd}`);
    }
  }
  
  const result = {
    available: available.map(t => ({ name: t.name, path: t.path, version: t.version })),
    unavailable: unavailable.map(t => ({ name: t.name, installCommand: getInstallGuidance(t.name)?.installCommand })),
    summary: {
      total: Object.keys(status).length,
      availableCount: available.length,
      unavailableCount: unavailable.length
    }
  };
  
  // Output formatted or raw
  if (raw) {
    output(result, raw);
  } else {
    console.log(lines.join('\n'));
  }
}

module.exports = {
  cmdToolsStatus
};
