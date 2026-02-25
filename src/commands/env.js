'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { output, error, debugLog } = require('../lib/output');

// --- Language Manifest Patterns -----------------------------------------------

const LANG_MANIFESTS = [
  { file: 'package.json', language: 'node', binary: 'node', versionFlag: '--version' },
  { file: 'go.mod', language: 'go', binary: 'go', versionFlag: 'version' },
  { file: 'mix.exs', language: 'elixir', binary: 'elixir', versionFlag: '--version' },
  { file: 'Cargo.toml', language: 'rust', binary: 'cargo', versionFlag: '--version' },
  { file: 'pyproject.toml', language: 'python', binary: 'python3', versionFlag: '--version' },
  { file: 'setup.py', language: 'python', binary: 'python3', versionFlag: '--version' },
  { file: 'requirements.txt', language: 'python', binary: 'python3', versionFlag: '--version' },
  { file: 'Gemfile', language: 'ruby', binary: 'ruby', versionFlag: '--version' },
  { file: 'composer.json', language: 'php', binary: 'php', versionFlag: '--version' },
  { file: 'build.gradle', language: 'java', binary: 'java', versionFlag: '--version' },
  { file: 'build.gradle.kts', language: 'kotlin', binary: 'java', versionFlag: '--version' },
  { file: 'pom.xml', language: 'java', binary: 'java', versionFlag: '--version' },
  { file: 'Package.swift', language: 'swift', binary: 'swift', versionFlag: '--version' },
  { file: 'CMakeLists.txt', language: 'cpp', binary: 'cc', versionFlag: '--version' },
  { file: 'Makefile', language: 'make', binary: 'make', versionFlag: '--version' },
  { file: 'Justfile', language: 'just', binary: 'just', versionFlag: '--version' },
  { file: 'Dockerfile', language: 'docker', binary: 'docker', versionFlag: '--version' },
  { file: 'docker-compose.yml', language: 'docker', binary: 'docker', versionFlag: '--version' },
  { file: 'docker-compose.yaml', language: 'docker', binary: 'docker', versionFlag: '--version' },
  { file: 'compose.yml', language: 'docker', binary: 'docker', versionFlag: '--version' },
  { file: 'compose.yaml', language: 'docker', binary: 'docker', versionFlag: '--version' },
  { file: 'flake.nix', language: 'nix', binary: 'nix', versionFlag: '--version' },
  { file: 'deno.json', language: 'deno', binary: 'deno', versionFlag: '--version' },
  { file: 'deno.jsonc', language: 'deno', binary: 'deno', versionFlag: '--version' },
  { file: 'bun.lockb', language: 'bun', binary: 'bun', versionFlag: '--version' },
  { file: 'bunfig.toml', language: 'bun', binary: 'bun', versionFlag: '--version' },
];

// Directories to skip during recursive scan
const SKIP_DIRS = new Set([
  'node_modules', 'vendor', 'deps', '_build', '.git', '.next', 'target',
  'dist', 'build', '__pycache__', '.elixir_ls', '.cache',
]);

// Package manager lockfile precedence (first match wins)
const PM_LOCKFILES = [
  { file: 'bun.lock', pm: 'bun' },
  { file: 'bun.lockb', pm: 'bun' },
  { file: 'pnpm-lock.yaml', pm: 'pnpm' },
  { file: 'yarn.lock', pm: 'yarn' },
  { file: 'package-lock.json', pm: 'npm' },
  // Non-Node lockfiles
  { file: 'mix.lock', pm: 'mix' },
  { file: 'go.sum', pm: 'go-modules' },
  { file: 'Cargo.lock', pm: 'cargo' },
  { file: 'Gemfile.lock', pm: 'bundler' },
  { file: 'poetry.lock', pm: 'poetry' },
  { file: 'Pipfile.lock', pm: 'pipenv' },
];

// Version manager files
const VERSION_MANAGERS = [
  { file: '.tool-versions', name: 'asdf' },
  { file: 'mise.toml', name: 'mise' },
  { file: '.mise.toml', name: 'mise' },
  { file: '.nvmrc', name: 'nvm' },
  { file: '.node-version', name: 'node-version' },
  { file: '.python-version', name: 'pyenv' },
  { file: '.ruby-version', name: 'rbenv' },
  { file: '.go-version', name: 'goenv' },
];

// CI config patterns
const CI_CONFIGS = [
  { check: 'dir', path: '.github/workflows', platform: 'github-actions' },
  { check: 'file', path: '.gitlab-ci.yml', platform: 'gitlab-ci' },
  { check: 'dir', path: '.circleci', platform: 'circleci' },
  { check: 'file', path: 'Jenkinsfile', platform: 'jenkins' },
  { check: 'file', path: '.travis.yml', platform: 'travis' },
];

// Test framework config patterns
const TEST_CONFIGS = [
  { pattern: 'jest.config.*', name: 'jest' },
  { pattern: 'vitest.config.*', name: 'vitest' },
  { pattern: '.mocharc.*', name: 'mocha' },
  { pattern: 'pytest.ini', name: 'pytest' },
  { pattern: 'setup.cfg', name: 'pytest', check: '[tool:pytest]' },
  { pattern: 'tox.ini', name: 'tox' },
];

// Linter/formatter config patterns
const LINT_CONFIGS = [
  { pattern: '.eslintrc*', name: 'eslint', type: 'linter' },
  { pattern: 'eslint.config.*', name: 'eslint', type: 'linter' },
  { pattern: '.prettierrc*', name: 'prettier', type: 'formatter' },
  { pattern: 'prettier.config.*', name: 'prettier', type: 'formatter' },
  { pattern: 'biome.json', name: 'biome', type: 'both' },
  { pattern: 'biome.jsonc', name: 'biome', type: 'both' },
  { pattern: '.credo.exs', name: 'credo', type: 'linter' },
  { pattern: '.golangci.yml', name: 'golangci-lint', type: 'linter' },
  { pattern: '.golangci.yaml', name: 'golangci-lint', type: 'linter' },
  { pattern: 'rustfmt.toml', name: 'rustfmt', type: 'formatter' },
  { pattern: '.rubocop.yml', name: 'rubocop', type: 'both' },
];

// Well-known script names to capture
const WELL_KNOWN_SCRIPTS = ['test', 'build', 'lint', 'start', 'deploy', 'format', 'check'];


// --- Scanning Functions -------------------------------------------------------

/**
 * Recursively scan directory for manifest files up to a depth limit.
 * Returns array of { language, file, path (relative), depth, binary, versionFlag }.
 */
function scanManifests(rootDir, maxDepth) {
  const results = [];

  function walk(dir, depth) {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // Permission denied or other error — skip
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name), depth + 1);
        }
      } else if (entry.isFile()) {
        for (const manifest of LANG_MANIFESTS) {
          if (entry.name === manifest.file) {
            results.push({
              language: manifest.language,
              file: manifest.file,
              path: path.relative(rootDir, path.join(dir, entry.name)),
              depth,
              binary: manifest.binary,
              versionFlag: manifest.versionFlag,
            });
          }
        }
      }
    }
  }

  walk(rootDir, 0);
  return results;
}

/**
 * Determine primary language from detected manifests.
 * Priority: root manifest (depth 0), count at depth 0, then total count.
 */
function determinePrimaryLanguage(manifests) {
  if (manifests.length === 0) return null;

  // Group by language
  const langStats = {};
  for (const m of manifests) {
    if (!langStats[m.language]) {
      langStats[m.language] = { rootCount: 0, totalCount: 0 };
    }
    langStats[m.language].totalCount++;
    if (m.depth === 0) langStats[m.language].rootCount++;
  }

  // Sort: most root manifests first, then most total manifests
  const sorted = Object.entries(langStats).sort((a, b) => {
    if (b[1].rootCount !== a[1].rootCount) return b[1].rootCount - a[1].rootCount;
    return b[1].totalCount - a[1].totalCount;
  });

  return sorted[0][0];
}

/**
 * Build language entries from manifests. Groups by language.
 */
function buildLanguageEntries(manifests, primaryLang) {
  const byLang = {};

  for (const m of manifests) {
    if (!byLang[m.language]) {
      byLang[m.language] = {
        name: m.language,
        primary: m.language === primaryLang,
        manifests: [],
        binary: { name: m.binary, versionFlag: m.versionFlag, available: false, version: null, path: null },
      };
    }
    byLang[m.language].manifests.push({ file: m.file, path: m.path, depth: m.depth });
  }

  return Object.values(byLang);
}

/**
 * Check binary availability and version.
 * Returns { available, version, path }.
 */
function checkBinary(binaryName, versionFlag) {
  const result = { available: false, version: null, path: null };
  const timeout = 3000;

  try {
    const whichResult = execSync(`which ${binaryName}`, {
      encoding: 'utf-8', timeout, stdio: 'pipe',
    }).trim();

    if (whichResult) {
      result.available = true;
      result.path = whichResult;

      try {
        const versionOut = execSync(`${binaryName} ${versionFlag}`, {
          encoding: 'utf-8', timeout, stdio: 'pipe',
        }).trim();

        const versionMatch = versionOut.match(/(\d+\.\d+[\.\d]*)/);
        if (versionMatch) {
          result.version = versionMatch[1];
        }
      } catch {
        // Binary found but version check failed
        debugLog('env.binary', `version check failed for ${binaryName}`);
      }
    }
  } catch {
    // Binary not found
    debugLog('env.binary', `${binaryName} not found on PATH`);
  }

  return result;
}

/**
 * Detect package manager from lockfiles and packageManager field.
 */
function detectPackageManager(rootDir) {
  const result = { name: null, version: null, source: null, detected_from: null };

  // Check packageManager field in package.json first (highest precedence)
  const pkgJsonPath = path.join(rootDir, 'package.json');
  try {
    if (fs.existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkg.packageManager) {
        const match = pkg.packageManager.match(/^([^@]+)(?:@(.+))?$/);
        if (match) {
          result.name = match[1];
          result.version = match[2] || null;
          result.source = 'packageManager-field';
          result.detected_from = 'package.json';
          return result;
        }
      }
    }
  } catch {
    debugLog('env.pm', 'package.json parse failed');
  }

  // Fall back to lockfile detection
  for (const lockfile of PM_LOCKFILES) {
    if (fs.existsSync(path.join(rootDir, lockfile.file))) {
      result.name = lockfile.pm;
      result.source = 'lockfile';
      result.detected_from = lockfile.file;
      return result;
    }
  }

  return result;
}

/**
 * Detect version managers and their configured versions.
 */
function detectVersionManagers(rootDir) {
  const results = [];

  for (const vm of VERSION_MANAGERS) {
    const filePath = path.join(rootDir, vm.file);
    if (fs.existsSync(filePath)) {
      const entry = { name: vm.name, file: vm.file, configured_versions: {} };

      try {
        const content = fs.readFileSync(filePath, 'utf-8').trim();

        if (vm.file === '.nvmrc' || vm.file === '.node-version') {
          entry.configured_versions.node = content.replace(/^v/, '');
        } else if (vm.file === '.python-version') {
          entry.configured_versions.python = content;
        } else if (vm.file === '.ruby-version') {
          entry.configured_versions.ruby = content;
        } else if (vm.file === '.go-version') {
          entry.configured_versions.go = content;
        } else if (vm.file === '.tool-versions') {
          // Parse asdf .tool-versions: each line is "tool version"
          for (const line of content.split('\n')) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2 && !parts[0].startsWith('#')) {
              entry.configured_versions[parts[0]] = parts[1];
            }
          }
        } else if (vm.file === 'mise.toml' || vm.file === '.mise.toml') {
          // Simplified mise.toml parsing: look for [tools] section
          const toolsMatch = content.match(/\[tools\]\s*\n((?:.*\n?)*?)(?:\n\[|$)/);
          if (toolsMatch) {
            for (const line of toolsMatch[1].split('\n')) {
              const kvMatch = line.match(/^\s*(\w+)\s*=\s*["']?([^"'\s]+)["']?/);
              if (kvMatch) {
                entry.configured_versions[kvMatch[1]] = kvMatch[2];
              }
            }
          }
        }
      } catch {
        debugLog('env.vm', `failed to parse ${vm.file}`);
      }

      results.push(entry);
    }
  }

  return results;
}

/**
 * Detect CI platform.
 */
function detectCI(rootDir) {
  for (const ci of CI_CONFIGS) {
    const fullPath = path.join(rootDir, ci.path);
    try {
      if (ci.check === 'dir') {
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
          return { platform: ci.platform, config_file: ci.path };
        }
      } else {
        if (fs.existsSync(fullPath)) {
          return { platform: ci.platform, config_file: ci.path };
        }
      }
    } catch {
      // Skip on permission errors
    }
  }
  return null;
}

/**
 * Detect test frameworks from config files and directories.
 */
function detectTestFrameworks(rootDir) {
  const results = [];
  const seen = new Set();

  for (const tc of TEST_CONFIGS) {
    try {
      // Simple glob-like matching for patterns with wildcards
      const dir = fs.readdirSync(rootDir);
      for (const entry of dir) {
        if (matchSimpleGlob(entry, tc.pattern)) {
          if (tc.check) {
            // Need to verify content
            const content = fs.readFileSync(path.join(rootDir, entry), 'utf-8');
            if (!content.includes(tc.check)) continue;
          }
          if (!seen.has(tc.name)) {
            seen.add(tc.name);
            results.push({ name: tc.name, config_file: entry });
          }
        }
      }
    } catch {
      // Skip
    }
  }

  // Also check for test directories
  for (const testDir of ['test', 'tests', 'spec', '__tests__']) {
    try {
      const fullPath = path.join(rootDir, testDir);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        results.push({ name: testDir, config_file: null });
      }
    } catch {
      // Skip
    }
  }

  return results;
}

/**
 * Detect linters and formatters from config files.
 */
function detectLintFormat(rootDir) {
  const linters = [];
  const formatters = [];
  const seen = new Set();

  try {
    const dir = fs.readdirSync(rootDir);
    for (const entry of dir) {
      for (const lc of LINT_CONFIGS) {
        if (matchSimpleGlob(entry, lc.pattern) && !seen.has(lc.name)) {
          seen.add(lc.name);
          const item = { name: lc.name, config_file: entry };
          if (lc.type === 'linter' || lc.type === 'both') linters.push(item);
          if (lc.type === 'formatter' || lc.type === 'both') formatters.push(item);
        }
      }
    }
  } catch {
    // Skip
  }

  return { linters, formatters };
}

/**
 * Simple glob matching: supports * wildcard at end of pattern.
 * e.g., "jest.config.*" matches "jest.config.js", "jest.config.ts"
 * e.g., ".eslintrc*" matches ".eslintrc", ".eslintrc.json", ".eslintrc.js"
 */
function matchSimpleGlob(name, pattern) {
  if (!pattern.includes('*')) return name === pattern;

  const starIdx = pattern.indexOf('*');
  const prefix = pattern.slice(0, starIdx);
  const suffix = pattern.slice(starIdx + 1);

  if (suffix) {
    return name.startsWith(prefix) && name.endsWith(suffix);
  }
  return name.startsWith(prefix);
}

/**
 * Detect well-known scripts from package.json, Makefile, and Justfile.
 */
function detectScripts(rootDir) {
  const scripts = {};

  // package.json scripts
  try {
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts) {
        for (const name of WELL_KNOWN_SCRIPTS) {
          if (pkg.scripts[name]) {
            scripts[name] = pkg.scripts[name];
          }
        }
      }
    }
  } catch {
    debugLog('env.scripts', 'package.json parse failed');
  }

  // Makefile targets
  try {
    const makefilePath = path.join(rootDir, 'Makefile');
    if (fs.existsSync(makefilePath)) {
      const content = fs.readFileSync(makefilePath, 'utf-8');
      const targets = [];
      for (const line of content.split('\n')) {
        const match = line.match(/^([a-zA-Z_][\w-]*):/);
        if (match && !match[1].startsWith('.')) {
          targets.push(match[1]);
        }
      }
      if (targets.length > 0) {
        scripts._makefile_targets = targets;
      }
    }
  } catch {
    debugLog('env.scripts', 'Makefile parse failed');
  }

  // Justfile targets
  try {
    const justfilePath = path.join(rootDir, 'Justfile');
    if (fs.existsSync(justfilePath)) {
      const content = fs.readFileSync(justfilePath, 'utf-8');
      const targets = [];
      for (const line of content.split('\n')) {
        const match = line.match(/^([a-zA-Z_][\w-]*)(?:\s.*)?:/);
        if (match) {
          targets.push(match[1]);
        }
      }
      if (targets.length > 0) {
        scripts._justfile_targets = targets;
      }
    }
  } catch {
    debugLog('env.scripts', 'Justfile parse failed');
  }

  // mix aliases (if mix.exs exists)
  try {
    const mixPath = path.join(rootDir, 'mix.exs');
    if (fs.existsSync(mixPath)) {
      const result = execSync('mix help --names', {
        cwd: rootDir, encoding: 'utf-8', timeout: 3000, stdio: 'pipe',
      }).trim();
      if (result) {
        const aliases = result.split('\n').filter(l => l.trim());
        if (aliases.length > 0) {
          scripts._mix_tasks = aliases.slice(0, 20); // Cap to avoid bloat
        }
      }
    }
  } catch {
    debugLog('env.scripts', 'mix help failed');
  }

  return scripts;
}

/**
 * Detect infrastructure services from docker-compose files.
 */
function detectInfraServices(rootDir) {
  const dockerServices = [];
  const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];

  for (const file of composeFiles) {
    const filePath = path.join(rootDir, file);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Simple YAML parsing: find services: section and extract top-level keys
        const servicesMatch = content.match(/^services:\s*\n((?:[ \t]+\S.*\n?)*)/m);
        if (servicesMatch) {
          // Each service is an indented key followed by colon
          const serviceLines = servicesMatch[1].split('\n');
          for (const line of serviceLines) {
            const match = line.match(/^[ \t]{2}(\w[\w-]*):/);
            if (match) {
              dockerServices.push(match[1]);
            }
          }
        }
      }
    } catch {
      debugLog('env.infra', `failed to parse ${file}`);
    }
  }

  return dockerServices;
}

/**
 * Detect MCP servers from .mcp.json.
 */
function detectMcpServers(rootDir) {
  const servers = [];

  try {
    const mcpPath = path.join(rootDir, '.mcp.json');
    if (fs.existsSync(mcpPath)) {
      const content = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      if (content.mcpServers && typeof content.mcpServers === 'object') {
        for (const name of Object.keys(content.mcpServers)) {
          servers.push(name);
        }
      }
    }
  } catch {
    debugLog('env.mcp', '.mcp.json parse failed');
  }

  return servers;
}

/**
 * Detect monorepo/workspace configuration.
 */
function detectMonorepo(rootDir) {
  // npm/yarn/pnpm workspaces
  try {
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.workspaces) {
        const members = Array.isArray(pkg.workspaces)
          ? pkg.workspaces
          : (pkg.workspaces.packages || []);
        return { type: 'npm-workspaces', members };
      }
    }
  } catch {
    // Skip
  }

  // pnpm-workspace.yaml
  try {
    const pnpmWsPath = path.join(rootDir, 'pnpm-workspace.yaml');
    if (fs.existsSync(pnpmWsPath)) {
      const content = fs.readFileSync(pnpmWsPath, 'utf-8');
      const members = [];
      const packagesMatch = content.match(/packages:\s*\n((?:\s*-\s*.+\n?)*)/);
      if (packagesMatch) {
        for (const line of packagesMatch[1].split('\n')) {
          const m = line.match(/^\s*-\s*['"]?(.+?)['"]?\s*$/);
          if (m) members.push(m[1]);
        }
      }
      return { type: 'pnpm-workspaces', members };
    }
  } catch {
    // Skip
  }

  // Go workspace
  try {
    const goWorkPath = path.join(rootDir, 'go.work');
    if (fs.existsSync(goWorkPath)) {
      const content = fs.readFileSync(goWorkPath, 'utf-8');
      const members = [];
      const useMatch = content.match(/use\s*\(([\s\S]*?)\)/);
      if (useMatch) {
        for (const line of useMatch[1].split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('//')) {
            members.push(trimmed);
          }
        }
      }
      return { type: 'go-workspace', members };
    }
  } catch {
    // Skip
  }

  // Elixir umbrella
  try {
    const mixPath = path.join(rootDir, 'mix.exs');
    if (fs.existsSync(mixPath)) {
      const content = fs.readFileSync(mixPath, 'utf-8');
      if (content.includes('apps_path')) {
        // Try to list apps directory
        const appsDir = path.join(rootDir, 'apps');
        if (fs.existsSync(appsDir) && fs.statSync(appsDir).isDirectory()) {
          const members = fs.readdirSync(appsDir).filter(d => {
            try {
              return fs.statSync(path.join(appsDir, d)).isDirectory();
            } catch { return false; }
          });
          return { type: 'elixir-umbrella', members };
        }
      }
    }
  } catch {
    // Skip
  }

  return null;
}


// --- Main Command Function ----------------------------------------------------

/**
 * cmdEnvScan - Environment detection engine.
 * Scans a project for languages, package managers, tools, and binary availability.
 *
 * @param {string} cwd - Project root directory
 * @param {string[]} args - CLI arguments (after 'env scan')
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdEnvScan(cwd, args, raw) {
  const startMs = Date.now();
  const force = args.includes('--force');

  // 1. Scan for manifest files (fast path — file existence only)
  const manifests = scanManifests(cwd, 3);

  // 2. Determine primary language
  const primaryLang = determinePrimaryLanguage(manifests);

  // 3. Build language entries
  const languages = buildLanguageEntries(manifests, primaryLang);

  // 4. Check binary availability for each detected language
  for (const lang of languages) {
    const binaryResult = checkBinary(lang.binary.name, lang.binary.versionFlag);
    lang.binary.available = binaryResult.available;
    lang.binary.version = binaryResult.version;
    lang.binary.path = binaryResult.path;
  }

  // Elixir special case: also check 'mix' binary
  const elixirLang = languages.find(l => l.name === 'elixir');
  if (elixirLang) {
    const mixResult = checkBinary('mix', '--version');
    elixirLang.binary.extra = { name: 'mix', ...mixResult };
  }

  // 5. Detect package manager
  const packageManager = detectPackageManager(cwd);

  // 6. Detect version managers
  const versionManagers = detectVersionManagers(cwd);

  // 7. Detect tools
  const ci = detectCI(cwd);
  const testFrameworks = detectTestFrameworks(cwd);
  const { linters, formatters } = detectLintFormat(cwd);

  // 8. Detect scripts
  const scripts = detectScripts(cwd);

  // 9. Detect infrastructure
  const dockerServices = detectInfraServices(cwd);
  const mcpServers = detectMcpServers(cwd);

  // 10. Detect monorepo
  const monorepo = detectMonorepo(cwd);

  const detectionMs = Date.now() - startMs;

  const result = {
    languages,
    package_manager: packageManager,
    version_managers: versionManagers,
    tools: {
      ci,
      test_frameworks: testFrameworks,
      linters,
      formatters,
    },
    scripts,
    infrastructure: {
      docker_services: dockerServices,
      mcp_servers: mcpServers,
    },
    monorepo,
    detection_ms: detectionMs,
    scanned_at: new Date().toISOString(),
  };

  output(result, raw);
}

module.exports = { cmdEnvScan, LANG_MANIFESTS, scanManifests, checkBinary, detectPackageManager, matchSimpleGlob };
