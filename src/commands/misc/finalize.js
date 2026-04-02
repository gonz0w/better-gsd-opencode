'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { output, error } = require('../../lib/output');
const { comparablePath, inspectWorkspace } = require('../../lib/jj-workspace');
const { listManagedWorkspaces, parsePlanId } = require('../workspace');

const TOOLS_PATH = process.argv[1];
const CANONICAL_MUTATORS = [
  'verify:state complete-plan',
  'plan:roadmap update-plan-progress',
  'plan:requirements mark-complete',
];

function toWorkspaceName(target) {
  const parsed = parsePlanId(target);
  if (!parsed) return target;
  return `${parsed.phase.padStart(2, '0')}-${parsed.plan.padStart(2, '0')}`;
}

function resolveWorkspace(cwd, target) {
  const workspaceName = toWorkspaceName(target);
  return listManagedWorkspaces(cwd).find((workspace) => workspace.name === workspaceName) || null;
}

function execCanonical(cwd, args) {
  execFileSync(process.execPath, [TOOLS_PATH, ...args], {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
}

function requireTrustedMainCheckout(cwd, workspace) {
  if (!workspace) return;
  if (comparablePath(cwd) === comparablePath(workspace.path)) {
    error('execute:finalize-plan must run from trusted main-checkout state, not from the target workspace');
  }
}

function requireResultManifest(workspaceInfo) {
  if (!workspaceInfo.result_manifest?.summary_path) {
    error('Finalize blocked: missing proof or summary metadata for the workspace result manifest');
  }
  if (workspaceInfo.result_manifest.proof_buckets?.behavior === 'required' && !workspaceInfo.result_manifest.proof_path) {
    error('Finalize blocked: missing proof for a route that requires direct proof review');
  }
}

function requireHealthyEligibility(workspaceInfo) {
  if (workspaceInfo.status !== 'healthy') {
    error(`Finalize blocked: workspace status is ${workspaceInfo.status}, not healthy`);
  }
  const violation = workspaceInfo.result_manifest?.shared_planning_violation;
  if (violation?.quarantine) {
    error('Finalize blocked: quarantined or policy-violating boundary behavior must stay inspectable for human review');
  }
}

function promoteWorkspaceArtifacts(mainCwd, workspaceInfo) {
  for (const relPath of [workspaceInfo.result_manifest?.summary_path, workspaceInfo.result_manifest?.proof_path]) {
    if (!relPath) continue;
    const fromPath = path.join(workspaceInfo.path, relPath);
    const toPath = path.join(mainCwd, relPath);
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
    fs.copyFileSync(fromPath, toPath);
  }
}

function readPlanRequirements(mainCwd, planId) {
  const phasesDir = path.join(mainCwd, '.planning', 'phases');
  for (const entry of fs.readdirSync(phasesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const planPath = path.join(phasesDir, entry.name, `${planId}-PLAN.md`);
    if (!fs.existsSync(planPath)) continue;
    const content = fs.readFileSync(planPath, 'utf-8');
    const match = content.match(/requirements:\n((?:\s+-\s+[^\n]+\n?)+)/i);
    if (!match) return [];
    return match[1]
      .split('\n')
      .map((line) => line.match(/-\s+(.+)$/))
      .filter(Boolean)
      .map((entryMatch) => entryMatch[1].trim());
  }
  return [];
}

function cmdExecuteFinalizePlan(cwd, target, raw) {
  if (!target) {
    error('Usage: bgsd-tools execute:finalize-plan <plan-id|workspace-name>');
  }

  const workspace = resolveWorkspace(cwd, target);
  if (!workspace) {
    error(`No managed workspace found for ${target}.`);
  }

  requireTrustedMainCheckout(cwd, workspace);

  const workspaceInfo = inspectWorkspace(workspace);
  requireHealthyEligibility(workspaceInfo);
  requireResultManifest(workspaceInfo);

  const planId = workspaceInfo.plan_id || target;
  const parsed = parsePlanId(planId);
  const requirements = readPlanRequirements(cwd, planId);

  promoteWorkspaceArtifacts(cwd, workspaceInfo);
  execCanonical(cwd, ['verify:state', 'complete-plan', '--phase', parsed.phase, '--plan', parsed.plan, '--duration', '1 min', '--tasks', '2', '--files', '7', '--stopped-at', `Completed ${planId}-PLAN.md`, '--resume-file', 'None']);
  execCanonical(cwd, ['plan:roadmap', 'update-plan-progress', parsed.phase]);
  if (requirements.length > 0) {
    execCanonical(cwd, ['plan:requirements', 'mark-complete', ...requirements]);
  }

  output({
    finalized: true,
    workspace: {
      name: workspaceInfo.name,
      plan_id: workspaceInfo.plan_id,
      path: workspaceInfo.path,
    },
    result_manifest: workspaceInfo.result_manifest,
    mutators: CANONICAL_MUTATORS,
  }, raw);
}

module.exports = {
  cmdExecuteFinalizePlan,
};
