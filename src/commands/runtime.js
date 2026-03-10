'use strict';

const path = require('path');
const fs = require('fs');
const { detectBun, isRunningUnderBun, benchmarkStartup, benchmarkFileIO, benchmarkNested, benchmarkHTTPServer } = require('../lib/cli-tools/bun-runtime');
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
  const benchmarkType = args.type || 'all'; // 'simple', 'io', 'nested', 'http', 'all'
  
  // Check if Bun is available first
  const bunStatus = detectBun();
  
  const lines = [];
  lines.push('=== Runtime Benchmark ===');
  lines.push('');
  
  if (!bunStatus.available) {
    lines.push('Bun is not available. Install Bun to run benchmark.');
    lines.push('');
    const guidance = getInstallGuidance('bun');
    if (guidance) {
      lines.push(`Install: ${guidance.installCommand}`);
    }
    
    if (raw) {
      output({ runs, bunAvailable: false, error: 'Bun not available' }, raw);
    } else {
      console.log(lines.join('\n'));
    }
    return;
  }
  
  lines.push(`Running ${runs} iterations per benchmark type...`);
  lines.push('');
  
  const results = {};
  
  // Run simple benchmark (existing)
  if (benchmarkType === 'simple' || benchmarkType === 'all') {
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
    const scriptPath = path.join(cwd, '.bgsd-benchmark-temp.cjs');
    fs.writeFileSync(scriptPath, testScript);
    results.simple = benchmarkStartup(scriptPath, runs);
    try { fs.unlinkSync(scriptPath); } catch {}
  }
  
  // Run File I/O benchmark
  if (benchmarkType === 'io' || benchmarkType === 'all') {
    results.io = benchmarkFileIO(cwd, runs);
  }
  
  // Run Nested directory benchmark
  if (benchmarkType === 'nested' || benchmarkType === 'all') {
    results.nested = benchmarkNested(cwd, runs);
  }
  
  // Run HTTP server benchmark
  if (benchmarkType === 'http' || benchmarkType === 'all') {
    results.http = benchmarkHTTPServer(cwd, runs);
  }
  
  // Display results table
  if (benchmarkType === 'all') {
    lines.push('| Benchmark Type    | Node.js  | Bun     | Speedup | Notes                     |');
    lines.push('|-------------------|----------|---------|---------|---------------------------|');
    lines.push(`| Simple            | ${results.simple.node}ms  | ${results.simple.bun}ms   | ${results.simple.speedup}x   | Simple require overhead    |`);
    lines.push(`| File I/O          | ${results.io.node}ms  | ${results.io.bun}ms   | ${results.io.speedup}x   | Read/write/parse files    |`);
    lines.push(`| Nested Traversal  | ${results.nested.node}ms | ${results.nested.bun}ms  | ${results.nested.speedup}x   | Recursive directory walk   |`);
    lines.push(`| HTTP Server       | ${results.http.node}ms  | ${results.http.bun}ms   | ${results.http.speedup}x   | Server + request cycle    |`);
    lines.push('');
    lines.push('### Realistic Improvement Range');
    lines.push('');
    lines.push('- **Simple:** 1.5-2x (Node.js competitive on require overhead)');
    lines.push('- **File I/O:** 2-3x (Bun advantage on I/O operations)');
    lines.push('- **Nested:** 2-4x (Bun advantage on recursive traversal)');
    lines.push('- **HTTP:** 3-5x (Bun advantage on full bootstrap)');
    lines.push('');
    lines.push('### Why Node.js v25 is Competitive');
    lines.push('');
    lines.push('Node.js v25 has improved simple require performance, closing the gap on basic module loading.');
    lines.push('However, Bun still excels at:');
    lines.push('- File I/O operations (native async I/O)');
    lines.push('- Recursive directory traversal');
    lines.push('- Full application bootstrap with HTTP servers');
  } else {
    // Single benchmark mode
    const r = results[benchmarkType];
    lines.push(`Node.js: ${r.node}ms (${r.nodeRuns} runs)`);
    lines.push(`Bun: ${r.bun}ms (${r.bunRuns} runs)`);
    lines.push('');
    lines.push(`Speedup: ${r.speedup}x`);
  }

  const result = {
    runs,
    bunAvailable: true,
    type: benchmarkType,
    results
  };

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
