#!/usr/bin/env node

/**
 * Compile-cache benchmark script for Phase 79: Startup Compile-cache Acceleration.
 * 
 * Measures CLI startup time with and without compile-cache enabled to capture
 * evidence of warm-start speedup (RUNT-01 requirement).
 *
 * Usage:
 *   node benchmark-compile-cache.cjs
 *   BGSD_COMPILE_CACHE=1 node benchmark-compile-cache.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RUNS = 5;
const COMMAND = 'util:current-timestamp';

/**
 * Run CLI multiple times and measure startup time.
 * @param {string} compileCacheEnv - Value for BGSD_COMPILE_CACHE env var
 * @returns {object} - { runs: number[], median: number, label: string }
 */
function benchmarkStartup(compileCacheEnv) {
  const env = { ...process.env };
  if (compileCacheEnv !== undefined) {
    env.BGSD_COMPILE_CACHE = compileCacheEnv;
  }
  
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const start = Date.now();
    try {
      // Use wrapper script (bin/bgsd) which applies compile-cache flag
      execSync(`./bin/bgsd ${COMMAND}`, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });
    } catch (err) {
      console.error(`Run ${i + 1} failed: ${err.message}`);
      process.exit(1);
    }
    const elapsed = Date.now() - start;
    runs.push(elapsed);
  }
  
  const sorted = [...runs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const label = compileCacheEnv === '1' 
    ? 'BGSD_COMPILE_CACHE=1' 
    : compileCacheEnv === '0' 
      ? 'BGSD_COMPILE_CACHE=0' 
      : 'default (no env)';
      
  return { runs, median, label };
}

// Run benchmarks
console.log('Compile-cache Benchmark (Phase 79: RUNT-01 evidence)\n');
console.log(`Node.js version: ${process.version}`);
console.log(`Runs per test: ${RUNS}\n`);

// Baseline: without compile-cache
const baseline = benchmarkStartup('0');
console.log(`Baseline (BGSD_COMPILE_CACHE=0):`);
console.log(`  Runs: ${baseline.runs.join(', ')}`);
console.log(`  Median: ${baseline.median}ms\n`);

// With compile-cache enabled
const withCache = benchmarkStartup('1');
console.log(`With compile-cache (BGSD_COMPILE_CACHE=1):`);
console.log(`  Runs: ${withCache.runs.join(', ')}`);
console.log(`  Median: ${withCache.median}ms\n`);

// Calculate speedup
const deltaMs = baseline.median - withCache.median;
const deltaPct = baseline.median > 0 
  ? Math.round(((baseline.median - withCache.median) / baseline.median) * 100)
  : 0;

console.log('Results:');
console.log(`  Speedup: ${deltaMs > 0 ? '+' : ''}${deltaMs}ms (${deltaPct > 0 ? deltaPct : 0}% improvement)`);
console.log(`  Note: First run creates cache, subsequent runs benefit from it.\n`);

// Check runtime support
const { detectCompileCacheSupport, getCompileCacheArgs } = require('./src/lib/runtime-capabilities');
const { supported, reason } = detectCompileCacheSupport();
const cacheArgs = getCompileCacheArgs();

console.log('Runtime capability check:');
console.log(`  Compile-cache supported: ${supported ? 'YES' : 'NO'}`);
console.log(`  Reason: ${reason}`);
console.log(`  Current args: ${cacheArgs.args.length > 0 ? cacheArgs.args.join(', ') : '(none - default disabled)'}`);

// Save results to performance.json
const baselinesDir = '.planning/baselines';
if (!fs.existsSync(baselinesDir)) {
  fs.mkdirSync(baselinesDir, { recursive: true });
}

const results = {
  timestamp: new Date().toISOString(),
  node_version: process.version,
  runs_per_test: RUNS,
  baseline: {
    env: 'BGSD_COMPILE_CACHE=0',
    runs_ms: baseline.runs,
    median_ms: baseline.median,
  },
  with_compile_cache: {
    env: 'BGSD_COMPILE_CACHE=1',
    runs_ms: withCache.runs,
    median_ms: withCache.median,
  },
  speedup_ms: deltaMs,
  speedup_percent: deltaPct,
  compile_cache_supported: supported,
  compile_cache_reason: reason,
  compile_cache_default_args: cacheArgs.args,
};

const outPath = path.join(baselinesDir, 'compile-cache-benchmark.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
console.log(`\nResults saved to: ${outPath}`);
