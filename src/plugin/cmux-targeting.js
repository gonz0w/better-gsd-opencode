import fs from 'node:fs';
import path from 'node:path';
import { capabilities, identify, listWorkspaces, ping, sidebarState } from './cmux-cli.js';

const REQUIRED_SIDEBAR_METHODS = ['set-status', 'clear-status', 'set-progress', 'clear-progress', 'log'];

function normalizeAccessMode(value) {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'allowall' || normalized === 'allow-all' || normalized === 'allow_all') return 'allowAll';
  if (normalized === 'off') return 'off';
  if (normalized === 'cmux processes only' || normalized === 'cmuxonly' || normalized === 'cmux-only' || normalized === 'cmux_only') {
    return 'cmuxOnly';
  }
  return value;
}

function extractCapabilitiesPayload(capabilityResult) {
  if (!capabilityResult || !capabilityResult.json) return null;
  return capabilityResult.json.result || capabilityResult.json;
}

function extractMethods(payload) {
  const candidates = [
    payload?.methods,
    payload?.available_methods,
    payload?.capabilities,
    payload?.result?.methods,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map((entry) => String(entry));
    }
  }

  return [];
}

function resolveAccessMode(payload) {
  return normalizeAccessMode(
    payload?.access_mode
    || payload?.accessMode
    || payload?.socket_mode
    || payload?.socketMode
    || payload?.socket?.mode
  );
}

function hasManagedEnv(env) {
  return Boolean(env?.CMUX_WORKSPACE_ID || env?.CMUX_SURFACE_ID);
}

function hasCompleteManagedEnv(env) {
  return Boolean(env?.CMUX_WORKSPACE_ID && env?.CMUX_SURFACE_ID);
}

function extractJsonPayload(result) {
  if (!result?.json) return null;
  return result.json.result || result.json;
}

function extractWorkspaceId(payload) {
  return payload?.workspace?.id
    || payload?.workspace_id
    || payload?.workspaceId
    || payload?.id
    || null;
}

function extractSurfaceId(payload) {
  return payload?.surface?.id
    || payload?.surface_id
    || payload?.surfaceId
    || null;
}

function extractWorkspaceEntries(payload) {
  const candidates = [
    payload?.workspaces,
    payload?.items,
    payload?.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function extractSidebarCwd(payload) {
  return payload?.cwd
    || payload?.workspace?.cwd
    || payload?.state?.cwd
    || null;
}

function normalizeComparablePath(targetPath) {
  if (!targetPath) return null;

  try {
    return fs.realpathSync.native(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

function buildVerdict(overrides = {}) {
  return Object.freeze({
    available: false,
    attached: false,
    mode: 'none',
    suppressionReason: null,
    workspaceId: null,
    surfaceId: null,
    accessMode: null,
    methods: [],
    writeProven: false,
    ...overrides,
  });
}

function inferPingSuppressionReason(result) {
  if (result?.error?.type === 'missing-cli') return 'cmux-missing';
  if (result?.timedOut) return 'cmux-timeout';
  return 'cmux-unreachable';
}

function buildCmuxClient(options = {}) {
  if (options.cmux) return options.cmux;

  const shared = {
    command: options.command,
    cwd: options.projectDir,
    env: options.env,
    timeoutMs: options.timeoutMs,
    maxBuffer: options.maxBuffer,
  };

  return {
    ping: (callOptions = {}) => ping({ ...shared, ...callOptions }),
    capabilities: (callOptions = {}) => capabilities({ ...shared, ...callOptions }),
    identify: (callOptions = {}) => identify({ ...shared, ...callOptions }),
    listWorkspaces: (callOptions = {}) => listWorkspaces({ ...shared, ...callOptions }),
    sidebarState: (callOptions = {}) => sidebarState({ ...shared, ...callOptions }),
  };
}

export async function resolveManagedWorkspaceTarget(options = {}) {
  const env = options.env || process.env;
  const workspaceId = env.CMUX_WORKSPACE_ID || null;
  const surfaceId = env.CMUX_SURFACE_ID || null;

  if (!workspaceId || !surfaceId) {
    return {
      ok: false,
      mode: 'managed',
      suppressionReason: 'missing-env',
      workspaceId: null,
      surfaceId: null,
    };
  }

  const identifyResult = await options.cmux.identify();
  if (!identifyResult.ok) {
    return {
      ok: false,
      mode: 'managed',
      suppressionReason: 'identify-unavailable',
      workspaceId: null,
      surfaceId: null,
    };
  }

  const identifyPayload = extractJsonPayload(identifyResult);
  const identifiedWorkspaceId = extractWorkspaceId(identifyPayload?.workspace ? identifyPayload : identifyPayload?.result || identifyPayload);
  const identifiedSurfaceId = extractSurfaceId(identifyPayload?.surface ? identifyPayload : identifyPayload?.result || identifyPayload);

  if (identifiedWorkspaceId !== workspaceId) {
    return {
      ok: false,
      mode: 'managed',
      suppressionReason: 'workspace-mismatch',
      workspaceId: null,
      surfaceId: null,
    };
  }

  if (identifiedSurfaceId !== surfaceId) {
    return {
      ok: false,
      mode: 'managed',
      suppressionReason: 'surface-mismatch',
      workspaceId: null,
      surfaceId: null,
    };
  }

  return {
    ok: true,
    mode: 'managed',
    workspaceId,
    surfaceId,
    suppressionReason: null,
  };
}

export async function resolveAlongsideWorkspaceTarget(options = {}) {
  const projectDir = normalizeComparablePath(options.projectDir);
  if (!projectDir) {
    return {
      ok: false,
      mode: 'alongside',
      suppressionReason: 'ambiguous-cwd',
      workspaceId: null,
      surfaceId: null,
    };
  }

  const workspacesResult = await options.cmux.listWorkspaces();
  if (!workspacesResult.ok) {
    return {
      ok: false,
      mode: 'alongside',
      suppressionReason: 'ambiguous-cwd',
      workspaceId: null,
      surfaceId: null,
    };
  }

  const workspacesPayload = extractJsonPayload(workspacesResult);
  const matches = [];

  for (const workspace of extractWorkspaceEntries(workspacesPayload)) {
    const workspaceId = extractWorkspaceId(workspace);
    if (!workspaceId) continue;

    const sidebarResult = await options.cmux.sidebarState({ workspace: workspaceId });
    if (!sidebarResult.ok) continue;

    const sidebarPayload = extractJsonPayload(sidebarResult);
    const workspaceCwd = normalizeComparablePath(extractSidebarCwd(sidebarPayload));
    if (workspaceCwd === projectDir) {
      matches.push(workspaceId);
    }
  }

  if (matches.length !== 1) {
    return {
      ok: false,
      mode: 'alongside',
      suppressionReason: 'ambiguous-cwd',
      workspaceId: null,
      surfaceId: null,
    };
  }

  return {
    ok: true,
    mode: 'alongside',
    workspaceId: matches[0],
    surfaceId: null,
    suppressionReason: null,
  };
}

export function suppressionReason(value) {
  if (!value || typeof value !== 'object') return null;
  return value.suppressionReason || value.verdict?.suppressionReason || null;
}

export function createNoopCmuxAdapter(verdict = {}) {
  const normalizedVerdict = buildVerdict(verdict);

  async function suppressed(action, details = {}) {
    return {
      ok: false,
      suppressed: true,
      action,
      reason: normalizedVerdict.suppressionReason || 'not-attached',
      mode: normalizedVerdict.mode,
      available: normalizedVerdict.available,
      attached: normalizedVerdict.attached,
      workspaceId: normalizedVerdict.workspaceId,
      surfaceId: normalizedVerdict.surfaceId,
      details,
    };
  }

  return Object.freeze({
    ...normalizedVerdict,
    verdict: normalizedVerdict,
    getVerdict() {
      return normalizedVerdict;
    },
    setStatus(key, value, options = {}) {
      return suppressed('set-status', { key, value, options });
    },
    clearStatus(key, options = {}) {
      return suppressed('clear-status', { key, options });
    },
    setProgress(progress, options = {}) {
      return suppressed('set-progress', { progress, options });
    },
    clearProgress(options = {}) {
      return suppressed('clear-progress', { options });
    },
    log(message, options = {}) {
      return suppressed('log', { message, options });
    },
  });
}

export async function resolveCmuxAvailability(options = {}) {
  const env = options.env || process.env;
  const cmux = buildCmuxClient(options);
  const mode = hasManagedEnv(env) ? 'managed' : 'alongside';

  const pingResult = await cmux.ping();
  if (!pingResult.ok) {
    return buildVerdict({
      mode: 'none',
      suppressionReason: inferPingSuppressionReason(pingResult),
    });
  }

  const capabilitiesResult = await cmux.capabilities();
  if (!capabilitiesResult.ok) {
    return buildVerdict({
      mode,
      suppressionReason: 'capabilities-unavailable',
    });
  }

  const payload = extractCapabilitiesPayload(capabilitiesResult);
  const accessMode = resolveAccessMode(payload);
  const methods = extractMethods(payload);
  const missingMethods = methods.length > 0
    ? REQUIRED_SIDEBAR_METHODS.filter((method) => !methods.includes(method))
    : [];

  if (accessMode === 'off') {
    return buildVerdict({
      mode,
      accessMode,
      methods,
      suppressionReason: 'access-mode-off',
    });
  }

  if (missingMethods.length > 0) {
    return buildVerdict({
      mode,
      accessMode,
      methods,
      suppressionReason: 'missing-methods',
    });
  }

  if (hasManagedEnv(env) && !hasCompleteManagedEnv(env)) {
    return buildVerdict({
      mode: 'managed',
      accessMode,
      methods,
      suppressionReason: 'missing-env',
    });
  }

  if (hasManagedEnv(env)) {
    const managedTarget = await resolveManagedWorkspaceTarget({ env, cmux });
    if (!managedTarget.ok) {
      return buildVerdict({
        mode: 'managed',
        accessMode,
        methods,
        workspaceId: null,
        surfaceId: null,
        suppressionReason: managedTarget.suppressionReason,
      });
    }

    return buildVerdict({
      available: true,
      mode: 'managed',
      workspaceId: managedTarget.workspaceId,
      surfaceId: managedTarget.surfaceId,
      accessMode,
      methods,
    });
  }

  if (accessMode && accessMode !== 'allowAll') {
    return buildVerdict({
      mode: 'alongside',
      accessMode,
      methods,
      suppressionReason: 'access-mode-blocked',
    });
  }

  const alongsideTarget = await resolveAlongsideWorkspaceTarget({
    cmux,
    projectDir: options.projectDir,
  });

  if (!alongsideTarget.ok) {
    return buildVerdict({
      mode: 'alongside',
      accessMode,
      methods,
      workspaceId: null,
      surfaceId: null,
      suppressionReason: alongsideTarget.suppressionReason,
    });
  }

  return buildVerdict({
    available: true,
    mode: 'alongside',
    workspaceId: alongsideTarget.workspaceId,
    surfaceId: null,
    accessMode,
    methods,
  });
}
