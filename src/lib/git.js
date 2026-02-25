const { execFileSync } = require('child_process');
const { debugLog } = require('./output');

// ─── Git Execution ───────────────────────────────────────────────────────────

/**
 * Execute a git command without spawning a shell.
 * Uses execFileSync('git', args) instead of execSync('git ' + escaped)
 * to bypass shell interpretation overhead (~2ms savings per call).
 */
function execGit(cwd, args) {
  try {
    const stdout = execFileSync('git', args, {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    debugLog('git.exec', 'exec failed', err);
    return {
      exitCode: err.status ?? 1,
      stdout: (err.stdout ?? '').toString().trim(),
      stderr: (err.stderr ?? '').toString().trim(),
    };
  }
}

module.exports = { execGit };
