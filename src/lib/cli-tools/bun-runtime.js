/**
 * Bun Runtime Detection Module
 * 
 * Detects Bun runtime availability with config persistence.
 * Uses execFileSync with array args to prevent shell injection.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Session cache for Bun detection (Map, cleared on process exit - no TTL)
const sessionCache = new Map();

/**
 * Get config file path - looks for .planning/config.json in cwd or parent dirs
 */
function getConfigPath() {
  let cwd = process.cwd();
  // Walk up to find .planning directory
  while (cwd !== path.parse(cwd).root) {
    const configPath = path.join(cwd, '.planning', 'config.json');
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    cwd = path.dirname(cwd);
  }
  return null;
}

/**
 * Read config from .planning/config.json
 * @returns {object} Config object or empty object
 */
function readConfig() {
  const configPath = getConfigPath();
  if (!configPath) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Write config to .planning/config.json
 * @param {object} config - Config object to write
 */
function writeConfig(config) {
  const configPath = getConfigPath();
  if (!configPath) {
    return false;
  }
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get config value by key path (e.g., 'runtime' or 'bun.detected')
 * @param {string} keyPath - Dot-notation key path
 * @returns {any} Config value or undefined
 */
function configGet(keyPath) {
  const config = readConfig();
  const keys = keyPath.split('.');
  let current = config;
  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

/**
 * Set config value by key path (e.g., 'runtime' or 'bun.detected')
 * @param {string} keyPath - Dot-notation key path
 * @param {any} value - Value to set
 * @returns {boolean} Success
 */
function configSet(keyPath, value) {
  const configPath = getConfigPath();
  if (!configPath) {
    return false;
  }
  const config = readConfig();
  const keys = keyPath.split('.');
  let current = config;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
  return writeConfig(config);
}

/**
 * Detect if Bun runtime is available on the system
 * Detection order: bun --version first (3s timeout), fallback to which bun
 * Supports config override (runtime=node|bun|auto) and env var BGSD_RUNTIME
 * @returns {object} - { available: boolean, name: string, version?: string, path?: string, fromConfig?: boolean, forced?: boolean }
 */
function detectBun() {
  const cacheKey = 'bun';
  
  // Check session cache first
  if (sessionCache.has(cacheKey)) {
    return sessionCache.get(cacheKey);
  }
  
  // Check environment variable override first (takes precedence over config)
  const envRuntime = process.env.BGSD_RUNTIME;
  let runtimePref = null;
  
  if (envRuntime && ['node', 'bun', 'auto'].includes(envRuntime.toLowerCase())) {
    runtimePref = envRuntime.toLowerCase();
  } else {
    // Fallback to config
    runtimePref = configGet('runtime') || 'auto';
  }
  
  // If runtime is forced to 'node', skip detection
  if (runtimePref === 'node') {
    const result = {
      available: false,
      name: 'bun',
      fromConfig: true,
      forced: true
    };
    sessionCache.set(cacheKey, result);
    return result;
  }
  
  // If runtime is forced to 'bun', assume available (skip detection for speed)
  if (runtimePref === 'bun') {
    // Try to get cached version if available
    const cachedVersion = configGet('bun.detected');
    const result = {
      available: true,
      name: 'bun',
      version: cachedVersion || 'unknown',
      fromConfig: true,
      forced: true
    };
    sessionCache.set(cacheKey, result);
    return result;
  }
  
  let result = {
    available: false,
    name: 'bun'
  };
  
  // Method 1: Try bun --version first (with 3s timeout)
  try {
    const version = execFileSync('bun', ['--version'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000
    }).trim();
    
    if (version) {
      result.available = true;
      result.version = version;
      
      // Get path
      try {
        const path = execFileSync('which', ['bun'], {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        result.path = path;
      } catch {
        // PATH lookup failed, but we have version
      }
      
      // Cache detection result in config for faster subsequent runs
      if (version && version !== 'unknown') {
        configSet('bun.detected', version);
      }
      
      sessionCache.set(cacheKey, result);
      return result;
    }
  } catch {
    // Fallback to PATH-only detection
  }
  
  // Method 2: Fallback to PATH lookup only
  try {
    const path = execFileSync('which', ['bun'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    if (path) {
      result.available = true;
      result.path = path;
    }
  } catch {
    // Not available
  }
  
  sessionCache.set(cacheKey, result);
  return result;
}

/**
 * Check if running under Bun runtime
 * @returns {object} - { isBun: boolean, version?: string }
 */
function isRunningUnderBun() {
  // Method 1: Check process.versions.bun
  if (process.versions && process.versions.bun) {
    return { isBun: true, version: process.versions.bun };
  }
  
  // Method 2: Check global Bun object
  try {
    if (typeof Bun !== 'undefined') {
      return { isBun: true, version: Bun.version };
    }
  } catch {
    // Bun not defined
  }
  
  // Method 3: Check globalThis
  try {
    if (globalThis && 'Bun' in globalThis) {
      return { isBun: true, version: globalThis.Bun?.version };
    }
  } catch {
    // globalThis not available
  }
  
  return { isBun: false };
}

/**
 * Benchmark startup time comparing Node.js vs Bun
 * @param {string} scriptPath - Path to script to benchmark
 * @param {number} runs - Number of runs (default 10)
 * @returns {object} - { node: number, bun: number, speedup: number }
 */
function benchmarkStartup(scriptPath, runs = 10) {
  const results = {
    node: [],
    bun: []
  };
  
  // Benchmark Node.js
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    try {
      execFileSync('node', [scriptPath], {
        stdio: 'pipe',
        timeout: 5000
      });
      results.node.push(Date.now() - start);
    } catch {
      // Script execution failed, skip this run
    }
  }
  
  // Benchmark Bun (if available)
  const bunStatus = detectBun();
  if (bunStatus.available) {
    for (let i = 0; i < runs; i++) {
      const start = Date.now();
      try {
        execFileSync('bun', [scriptPath], {
          stdio: 'pipe',
          timeout: 5000
        });
        results.bun.push(Date.now() - start);
      } catch {
        // Script execution failed, skip this run
      }
    }
  }
  
  // Calculate averages
  const avgNode = results.node.length > 0
    ? results.node.reduce((a, b) => a + b, 0) / results.node.length
    : 0;
  
  const avgBun = results.bun.length > 0
    ? results.bun.reduce((a, b) => a + b, 0) / results.bun.length
    : 0;
  
  const speedup = avgBun > 0 ? (avgNode / avgBun) : 0;
  
  return {
    node: parseFloat(avgNode.toFixed(2)),
    bun: parseFloat(avgBun.toFixed(2)),
    speedup: parseFloat(speedup.toFixed(2)),
    nodeRuns: results.node.length,
    bunRuns: results.bun.length
  };
}

/**
 * Benchmark file I/O operations comparing Node.js vs Bun
 * Tests: read multiple files, parse contents, write temp files, delete
 * @param {string} cwd - Working directory
 * @param {number} runs - Number of runs (default 10)
 * @returns {object} - { node: number, bun: number, speedup: number }
 */
function benchmarkFileIO(cwd, runs = 10) {
  const ioScript = `
const fs = require('fs');
const path = require('path');

// Read multiple files
const dirs = ['src/lib', 'src/commands', 'bin', 'templates', 'workflows'];
let content = '';
for (const dir of dirs) {
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      if (f.isFile() && (f.name.endsWith('.js') || f.name.endsWith('.json') || f.name.endsWith('.md'))) {
        const filePath = path.join(dir, f.name);
        content += fs.readFileSync(filePath, 'utf-8').substring(0, 500);
      }
    }
  } catch {}
}

// Write temp file
const tempPath = '.bgsd-io-temp.json';
fs.writeFileSync(tempPath, JSON.stringify({ size: content.length, timestamp: Date.now() }));

// Read temp file
const tempData = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));

// Delete temp file
fs.unlinkSync(tempPath);

console.log('Processed', content.length, 'bytes');
`;

  const scriptPath = path.join(cwd, '.bgsd-io-benchmark.cjs');
  fs.writeFileSync(scriptPath, ioScript);
  
  const results = { node: [], bun: [] };
  
  // Benchmark Node.js
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    try {
      execFileSync('node', [scriptPath], { stdio: 'pipe', timeout: 10000, cwd });
      results.node.push(Date.now() - start);
    } catch {}
  }
  
  // Benchmark Bun
  const bunStatus = detectBun();
  if (bunStatus.available) {
    for (let i = 0; i < runs; i++) {
      const start = Date.now();
      try {
        execFileSync('bun', [scriptPath], { stdio: 'pipe', timeout: 10000, cwd });
        results.bun.push(Date.now() - start);
      } catch {}
    }
  }
  
  // Cleanup
  try { fs.unlinkSync(scriptPath); } catch {}
  try { fs.unlinkSync(path.join(cwd, '.bgsd-io-temp.json')); } catch {}
  
  const avgNode = results.node.length > 0 ? results.node.reduce((a, b) => a + b, 0) / results.node.length : 0;
  const avgBun = results.bun.length > 0 ? results.bun.reduce((a, b) => a + b, 0) / results.bun.length : 0;
  const speedup = avgBun > 0 ? avgNode / avgBun : 0;
  
  return {
    node: parseFloat(avgNode.toFixed(2)),
    bun: parseFloat(avgBun.toFixed(2)),
    speedup: parseFloat(speedup.toFixed(2)),
    nodeRuns: results.node.length,
    bunRuns: results.bun.length
  };
}

/**
 * Benchmark nested directory traversal comparing Node.js vs Bun
 * Tests: recursive walk, read multiple file types, aggregate data
 * @param {string} cwd - Working directory
 * @param {number} runs - Number of runs (default 10)
 * @returns {object} - { node: number, bun: number, speedup: number }
 */
function benchmarkNested(cwd, runs = 10) {
  const nestedScript = `
const fs = require('fs');
const path = require('path');

function walkDir(dir, extensions) {
  let files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files = files.concat(walkDir(fullPath, extensions));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        try {
          const stats = fs.statSync(fullPath);
          files.push({ path: fullPath, size: stats.size });
        } catch {}
      }
    }
  } catch {}
  return files;
}

const extensions = ['.js', '.json', '.md', '.cjs', '.mjs'];
const allFiles = walkDir('src', extensions);

// Aggregate data
const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
const byExt = {};
for (const f of allFiles) {
  const ext = path.extname(f.path);
  byExt[ext] = (byExt[ext] || 0) + 1;
}

console.log('Found', allFiles.length, 'files,', totalSize, 'bytes');
`;

  const scriptPath = path.join(cwd, '.bgsd-nested-benchmark.cjs');
  fs.writeFileSync(scriptPath, nestedScript);
  
  const results = { node: [], bun: [] };
  
  // Benchmark Node.js
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    try {
      execFileSync('node', [scriptPath], { stdio: 'pipe', timeout: 15000, cwd });
      results.node.push(Date.now() - start);
    } catch {}
  }
  
  // Benchmark Bun
  const bunStatus = detectBun();
  if (bunStatus.available) {
    for (let i = 0; i < runs; i++) {
      const start = Date.now();
      try {
        execFileSync('bun', [scriptPath], { stdio: 'pipe', timeout: 15000, cwd });
        results.bun.push(Date.now() - start);
      } catch {}
    }
  }
  
  // Cleanup
  try { fs.unlinkSync(scriptPath); } catch {}
  
  const avgNode = results.node.length > 0 ? results.node.reduce((a, b) => a + b, 0) / results.node.length : 0;
  const avgBun = results.bun.length > 0 ? results.bun.reduce((a, b) => a + b, 0) / results.bun.length : 0;
  const speedup = avgBun > 0 ? avgNode / avgBun : 0;
  
  return {
    node: parseFloat(avgNode.toFixed(2)),
    bun: parseFloat(avgBun.toFixed(2)),
    speedup: parseFloat(speedup.toFixed(2)),
    nodeRuns: results.node.length,
    bunRuns: results.bun.length
  };
}

/**
 * Benchmark HTTP server startup and request cycle comparing Node.js vs Bun
 * Tests: start server, make request, shutdown, full cycle
 * @param {string} cwd - Working directory
 * @param {number} runs - Number of runs (default 10)
 * @returns {object} - { node: number, bun: number, speedup: number }
 */
function benchmarkHTTPServer(cwd, runs = 10) {
  const httpScript = `
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, timestamp: Date.now() }));
});

server.listen(0, () => {
  const port = server.address().port;
  
  // Make request to self
  const req = http.request({
    hostname: 'localhost',
    port: port,
    path: '/',
    method: 'GET'
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      server.close();
    });
  });
  
  req.on('error', () => {
    server.close();
  });
  
  req.end();
});
`;

  const scriptPath = path.join(cwd, '.bgsd-http-benchmark.cjs');
  fs.writeFileSync(scriptPath, httpScript);
  
  const results = { node: [], bun: [] };
  
  // Benchmark Node.js
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    try {
      execFileSync('node', [scriptPath], { stdio: 'pipe', timeout: 10000, cwd });
      results.node.push(Date.now() - start);
    } catch {}
  }
  
  // Benchmark Bun
  const bunStatus = detectBun();
  if (bunStatus.available) {
    for (let i = 0; i < runs; i++) {
      const start = Date.now();
      try {
        execFileSync('bun', [scriptPath], { stdio: 'pipe', timeout: 10000, cwd });
        results.bun.push(Date.now() - start);
      } catch {}
    }
  }
  
  // Cleanup
  try { fs.unlinkSync(scriptPath); } catch {}
  
  const avgNode = results.node.length > 0 ? results.node.reduce((a, b) => a + b, 0) / results.node.length : 0;
  const avgBun = results.bun.length > 0 ? results.bun.reduce((a, b) => a + b, 0) / results.bun.length : 0;
  const speedup = avgBun > 0 ? avgNode / avgBun : 0;
  
  return {
    node: parseFloat(avgNode.toFixed(2)),
    bun: parseFloat(avgBun.toFixed(2)),
    speedup: parseFloat(speedup.toFixed(2)),
    nodeRuns: results.node.length,
    bunRuns: results.bun.length
  };
}

/**
 * Clear the session cache
 * Useful for testing or forcing re-detection
 */
function clearCache() {
  sessionCache.clear();
}

/**
 * Get cached result without re-detecting
 * @returns {object|null} - Cached result or null
 */
function getCachedResult() {
  return sessionCache.get('bun') || null;
}

/**
 * Get cached Bun version from config (persisted across sessions)
 * @returns {string|null} - Cached version or null
 */
function getCachedBunVersion() {
  return configGet('bun.detected') || null;
}

module.exports = {
  detectBun,
  isRunningUnderBun,
  benchmarkStartup,
  benchmarkFileIO,
  benchmarkNested,
  benchmarkHTTPServer,
  clearCache,
  getCachedResult,
  getCachedBunVersion,
  configGet,
  configSet
};
