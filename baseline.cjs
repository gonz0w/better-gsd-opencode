#!/usr/bin/env node

/**
 * Performance baseline capture script.
 * Captures init timing, bundle size, and source metrics for before/after comparison.
 * Zero dependencies — uses only Node.js built-ins.
 *
 * Usage: node baseline.js
 *        npm run baseline
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- 1. Init timing (median of 5 runs) ---
const RUNS = 5;
const timings = [];

for (let i = 0; i < RUNS; i++) {
  const start = Date.now();
  try {
    execSync('node bin/gsd-tools.cjs current-timestamp --raw', {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    console.error(`Run ${i + 1} failed: ${err.message}`);
    process.exit(1);
  }
  const elapsed = Date.now() - start;
  timings.push(elapsed);
}

// Compute median
const sorted = [...timings].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];

// --- 2. Bundle size ---
const bundlePath = 'bin/gsd-tools.cjs';
const bundleStat = fs.statSync(bundlePath);
const bundleSizeBytes = bundleStat.size;
const bundleSizeKb = Math.round(bundleSizeBytes / 1024);

// --- 3. File I/O counting via /proc/self/io or strace ---
let fsReadCount = null;
let fsWriteCount = null;

// Approach 1: Use /proc/<pid>/io to measure I/O bytes (Linux)
if (fs.existsSync('/proc/self/io')) {
  try {
    // Capture I/O before and after running a command via a wrapper script
    const wrapper = `
      const fs = require('fs');
      const { execSync } = require('child_process');
      const before = fs.readFileSync('/proc/self/io', 'utf-8');
      execSync('node bin/gsd-tools.cjs init plan-phase 1', { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
      const after = fs.readFileSync('/proc/self/io', 'utf-8');
      const parse = (s) => {
        const m = {};
        for (const line of s.trim().split('\\n')) {
          const [k, v] = line.split(': ');
          m[k.trim()] = parseInt(v.trim(), 10);
        }
        return m;
      };
      const b = parse(before), a = parse(after);
      console.log(JSON.stringify({ syscr: a.syscr - b.syscr, syscw: a.syscw - b.syscw }));
    `;
    const ioOut = execSync(`node -e "${wrapper.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const io = JSON.parse(ioOut.trim());
    fsReadCount = io.syscr;
    fsWriteCount = io.syscw;
  } catch {
    // /proc/self/io exists but subprocess approach failed
  }
}

// Approach 2: strace (if available)
if (fsReadCount === null) {
  try {
    const straceOut = execSync(
      'strace -c -e trace=openat node bin/gsd-tools.cjs init plan-phase 1 2>&1 >/dev/null',
      { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'], shell: true }
    );
    const openatMatch = straceOut.match(/(\d+)\s+[\d.]+\s+[\d.]+\s+\d+\s+\d+\s+openat/);
    if (openatMatch) {
      fsReadCount = parseInt(openatMatch[1], 10);
      fsWriteCount = 0;
    }
  } catch {
    // strace not available
  }
}

// Fallback: zeros (metric unavailable on this platform)
if (fsReadCount === null) {
  fsReadCount = 0;
  fsWriteCount = 0;
}

// --- 4. Source file count and total lines ---
function collectSourceFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { recursive: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isFile() && entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const sourceFiles = collectSourceFiles('src');
let totalLines = 0;
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  totalLines += content.split('\n').length;
}

// --- 5. Write performance.json ---
const baselinesDir = '.planning/baselines';
if (!fs.existsSync(baselinesDir)) {
  fs.mkdirSync(baselinesDir, { recursive: true });
}

const baselines = {
  timestamp: new Date().toISOString(),
  init_timing_ms: median,
  init_timing_runs: timings,
  bundle_size_kb: bundleSizeKb,
  bundle_size_bytes: bundleSizeBytes,
  fs_read_count: fsReadCount,
  fs_write_count: fsWriteCount,
  source_file_count: sourceFiles.length,
  source_total_lines: totalLines,
  node_version: process.version,
};

const outPath = path.join(baselinesDir, 'performance.json');
fs.writeFileSync(outPath, JSON.stringify(baselines, null, 2) + '\n');

// --- 6. Console output ---
console.log('Performance Baselines:');
console.log(`  Init timing:    ${median}ms (median of ${RUNS} runs)`);
console.log(`  Bundle size:    ${bundleSizeKb}KB`);
console.log(`  Source files:   ${sourceFiles.length} files, ${totalLines} lines`);
console.log(`  Node version:   ${process.version}`);
if (fsReadCount !== null) {
  console.log(`  FS reads:       ${fsReadCount}`);
  console.log(`  FS writes:      ${fsWriteCount}`);
}
console.log(`Saved to: ${outPath}`);
