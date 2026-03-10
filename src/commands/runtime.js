'use strict';

const path = require('path');
const fs = require('fs');
const { detectBun, isRunningUnderBun, benchmarkStartup } = require('../lib/cli-tools/bun-runtime');
const { getInstallGuidance } = require('../lib/cli-tools/install-guidance');
const { output } = require('../lib/output');

/**
 * CLI command to check Bun runtime status
 * Shows Bun detection status, version, path, and install instructions if unavailable
 */
function cmdRuntimeStatus(cwd, raw) {
  const bunStatus = detectBun();
  const runningUnder = isRunningUnderBun();
  
  const lines = [];
  lines.push('=== Bun Runtime Status ===');
  lines.push('');
  
  if (bunStatus.available) {
    lines.push('Status: Available ✓');
    lines.push(`Version: ${bunStatus.version || 'unknown'}`);
    lines.push(`Path: ${bunStatus.path || 'unknown'}`);
    lines.push('Bun is ready to use');
  } else {
    lines.push('Status: Not available ✗');
    lines.push('');
    
    const guidance = getInstallGuidance('bun');
    if (guidance) {
      lines.push('Install Instructions:');
      lines.push(`  ${guidance.installCommand}`);
      lines.push('');
      lines.push(`Alternatives: ${guidance.alternatives}`);
    }
  }
  
  // Check if currently running under Bun
  if (runningUnder.isBun) {
    lines.push('');
    lines.push(`Currently running under Bun v${runningUnder.version}`);
  }
  
  const result = {
    available: bunStatus.available,
    version: bunStatus.version || null,
    path: bunStatus.path || null,
    runningUnderBun: runningUnder.isBun,
    runningVersion: runningUnder.version || null,
    installCommand: bunStatus.available ? null : getInstallGuidance('bun')?.installCommand
  };
  
  if (raw) {
    output(result, raw);
  } else {
    console.log(lines.join('\n'));
  }
}

/**
 * CLI command to benchmark Node.js vs Bun startup time
 * Runs the script multiple times and compares average execution time
 */
function cmdRuntimeBenchmark(cwd, raw, args = {}) {
  const runs = args.runs || 10;
  
  // Create a simple test script for benchmarking
  const testScript = `
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
// Simple workload - read a few files
const dirs = ['src/lib', 'src/commands', 'bin'];
let count = 0;
for (const dir of dirs) {
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.endsWith('.js')) count++;
    }
  } catch {}
}
console.log('Processed', count, 'files');
`;
  
  // Write temp script (use .cjs extension for CommonJS compatibility)
  const scriptPath = path.join(cwd, '.bgsd-benchmark-temp.cjs');
  fs.writeFileSync(scriptPath, testScript);
  
  const lines = [];
  lines.push('=== Runtime Benchmark ===');
  lines.push('');
  lines.push(`Running ${runs} iterations...`);
  lines.push('');
  
  // Check if Bun is available first
  const bunStatus = detectBun();
  
  if (!bunStatus.available) {
    lines.push('Bun is not available. Install Bun to run benchmark.');
    lines.push('');
    const guidance = getInstallGuidance('bun');
    if (guidance) {
      lines.push(`Install: ${guidance.installCommand}`);
    }
  } else {
    // Run benchmark
    const results = benchmarkStartup(scriptPath, runs);
    
    lines.push(`Node.js: ${results.node}ms (${results.nodeRuns} successful runs)`);
    lines.push(`Bun: ${results.bun}ms (${results.bunRuns} successful runs)`);
    lines.push('');
    
    if (results.node > 0 && results.bun > 0) {
      if (results.speedup >= 1) {
        lines.push(`Bun is ${results.speedup}x faster than Node.js`);
      } else {
        lines.push(`Node.js is ${(1/results.speedup).toFixed(2)}x faster than Bun`);
      }
    } else if (results.node > 0 && results.bun === 0) {
      lines.push('Bun runs failed - cannot compare');
    }
  }
  
  // Run benchmark once and reuse results
  const benchmarkResults = bunStatus.available ? benchmarkStartup(scriptPath, runs) : { node: null, bun: null, speedup: null };
  
  const result = {
    runs: runs,
    bunAvailable: bunStatus.available,
    node: benchmarkResults.node,
    bun: benchmarkResults.bun,
    speedup: benchmarkResults.speedup
  };

  // Cleanup temp script after benchmark
  try {
    fs.unlinkSync(scriptPath);
  } catch {}

  if (raw) {
    output(result, raw);
  } else {
    console.log(lines.join('\n'));
  }
}

module.exports = {
  cmdRuntimeStatus,
  cmdRuntimeBenchmark
};
