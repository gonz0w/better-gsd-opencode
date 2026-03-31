import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const LEGACY_INSTALL_DIRS = ['bgsd-oc', 'get-shit-done'];
const MAX_ANCESTOR_DEPTH = 4;

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean).map((candidate) => resolve(candidate)))];
}

function collectAncestorDirs(startDir, maxDepth = MAX_ANCESTOR_DEPTH) {
  const dirs = [];
  let current = resolve(startDir);

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    dirs.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return dirs;
}

export function resolveBundledCliPath(options = {}) {
  const moduleUrl = options.moduleUrl || import.meta.url;
  const envPluginDir = options.envPluginDir === undefined ? process.env.BGSD_PLUGIN_DIR : options.envPluginDir;
  const currentDir = dirname(fileURLToPath(moduleUrl));
  const roots = uniquePaths([
    envPluginDir,
    ...collectAncestorDirs(currentDir),
  ]);

  const candidates = [];
  for (const root of roots) {
    candidates.push(join(root, 'bin', 'bgsd-tools.cjs'));
    for (const installDir of LEGACY_INSTALL_DIRS) {
      candidates.push(join(root, installDir, 'bin', 'bgsd-tools.cjs'));
    }
  }

  for (const candidate of uniquePaths(candidates)) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error('Could not locate bgsd-tools.cjs');
}
