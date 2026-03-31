function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function hasPattern(value, pattern) {
  return pattern.test(normalizeText(value));
}

function extractSection(state, sectionName) {
  if (!state) return null;
  if (typeof state.getSection === 'function') {
    return state.getSection(sectionName);
  }

  const raw = String(state.raw || '');
  if (!raw) return null;

  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp(`##\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i'));
  return match ? match[1].trim() : null;
}

function extractBlockerLines(state) {
  const section = extractSection(state, 'Blockers/Concerns');
  if (!section) return [];
  return section
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(line => line && !/^none(?:\.|\s|$)/i.test(line));
}

function extractContinuityText(state) {
  const section = extractSection(state, 'Session Continuity');
  return normalizeText(section || '');
}

function parsePhaseNumber(state, currentPhase) {
  const fromState = String(state?.phase || '').match(/^(\d+(?:\.\d+)?)/);
  if (fromState) return fromState[1];
  return currentPhase?.number ? String(currentPhase.number) : null;
}

function parsePlanNumber(state) {
  const match = String(state?.currentPlan || '').match(/(\d+)/);
  return match ? match[1].padStart(2, '0') : null;
}

function deriveWorkflowLabel(state) {
  const status = normalizeText(state?.status);
  const continuity = extractContinuityText(state);
  const signal = `${status} ${continuity}`;

  if (/\bverif(?:y|ying|ication)\b/.test(signal)) return 'Verifying';
  if (/\bplan(?:ning)?\b/.test(signal) || /ready to plan/.test(signal)) return 'Planning';
  if (/\bexecut(?:e|ing|ion)?\b/.test(signal) || /\bin progress\b/.test(signal) || /\bworking\b/.test(signal) || /\brunning\b/.test(signal)) {
    return 'Executing';
  }

  return null;
}

function isHumanGate(state) {
  const signal = `${normalizeText(state?.status)} ${extractContinuityText(state)} ${extractBlockerLines(state).join(' ')}`;
  return /(ready to plan|input needed|await(?:ing)? (?:reply|response|approval|review|decision)|needs? (?:reply|response|approval|review|decision)|checkpoint|manual (?:setup|action|step)|auth|login|sign in|required reply|human action)/.test(signal);
}

function hasHardStop(state, notificationHistory) {
  if (hasPattern(state?.status, /\bblocked\b|hard stop|cannot continue|fatal|failure|failed|error/)) {
    return !isHumanGate(state);
  }

  const blockerLines = extractBlockerLines(state);
  if (blockerLines.some(line => /(cannot continue|hard stop|fatal|failure|broken|repair required|critical)/i.test(line))
    && blockerLines.every(line => !/(auth|manual|decision|approval|reply|review)/i.test(line))) {
    return true;
  }

  return (notificationHistory || []).some(entry => normalizeText(entry?.severity) === 'critical');
}

function hasWarningOverlay(state, notificationHistory) {
  if ((notificationHistory || []).some(entry => normalizeText(entry?.severity) === 'warning')) {
    return true;
  }
  return hasPattern(state?.status, /warning|stale|spinning|degraded|attention/);
}

function isComplete(state, currentPhase) {
  if (typeof state?.progress === 'number' && state.progress >= 100) return true;
  if (hasPattern(state?.status, /complete|completed|done|finished/)) return true;
  return normalizeText(currentPhase?.status) === 'complete';
}

function isActive(state) {
  const workflowLabel = deriveWorkflowLabel(state);
  if (workflowLabel) return true;
  return hasPattern(state?.status, /in progress|working|active|running/);
}

function isFresh(lastActivity) {
  if (!lastActivity) return false;
  const timestamp = Date.parse(lastActivity);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= 36 * 60 * 60 * 1000;
}

function buildStructuralLabel(state, currentPhase) {
  const phaseNumber = parsePhaseNumber(state, currentPhase);
  const planNumber = parsePlanNumber(state);
  if (phaseNumber && planNumber) return `Phase ${phaseNumber} P${planNumber}`;
  if (phaseNumber) return `Phase ${phaseNumber}`;
  return null;
}

export function derivePrimaryState(projectState) {
  const state = projectState?.state || {};
  const currentPhase = projectState?.currentPhase || null;
  const notificationHistory = projectState?.notificationHistory || [];

  if (isHumanGate(state)) return { label: 'Input needed', reason: 'human-gated', priority: 6 };
  if (hasHardStop(state, notificationHistory)) return { label: 'Blocked', reason: 'hard-stop', priority: 5 };
  if (hasWarningOverlay(state, notificationHistory)) return { label: 'Warning', reason: 'warning-overlay', priority: 4 };
  if (isActive(state)) return { label: 'Working', reason: 'active-work', priority: 3 };
  if (isComplete(state, currentPhase)) return { label: 'Complete', reason: 'complete', priority: 2 };
  return { label: 'Idle', reason: 'idle', priority: 1 };
}

export function deriveContextLabel(projectState) {
  const state = projectState?.state || {};
  const currentPhase = projectState?.currentPhase || null;

  const workflowLabel = deriveWorkflowLabel(state);
  if (workflowLabel) {
    return { label: workflowLabel, source: 'workflow', trustworthy: true };
  }

  const structuralLabel = buildStructuralLabel(state, currentPhase);
  if (structuralLabel) {
    return { label: structuralLabel, source: 'structure', trustworthy: true };
  }

  return { label: null, source: 'none', trustworthy: false };
}

export function deriveProgressSignal(projectState) {
  const state = projectState?.state || {};
  const currentPhase = projectState?.currentPhase || null;

  if (typeof state.progress === 'number' && Number.isFinite(state.progress)) {
    const phaseNumber = parsePhaseNumber(state, currentPhase);
    return {
      mode: 'exact',
      value: Math.max(0, Math.min(100, state.progress)) / 100,
      label: phaseNumber ? `Phase ${phaseNumber}` : 'Progress',
    };
  }

  if (isActive(state) && isFresh(state.lastActivity || null)) {
    const workflowLabel = deriveWorkflowLabel(state);
    return {
      mode: 'activity',
      label: workflowLabel || 'Active',
    };
  }

  return { mode: 'hidden' };
}

export function deriveCmuxSidebarSnapshot(projectState) {
  return {
    status: derivePrimaryState(projectState),
    context: deriveContextLabel(projectState),
    progress: deriveProgressSignal(projectState),
  };
}
