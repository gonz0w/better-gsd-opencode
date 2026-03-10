const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);

function normalizeFlag(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (ENABLED_VALUES.has(normalized)) {
    return true;
  }
  if (DISABLED_VALUES.has(normalized)) {
    return false;
  }
  return null;
}

export function resolveValidationFlags(env = process.env) {
  const valibotFlag = normalizeFlag(env.BGSD_DEP_VALIBOT);
  const fallbackFlag = normalizeFlag(env.BGSD_DEP_VALIBOT_FALLBACK);

  const valibotEnabled = valibotFlag !== false;
  const forceFallback = fallbackFlag === true;
  const engine = forceFallback || !valibotEnabled ? 'zod' : 'valibot';

  return {
    valibotEnabled,
    forceFallback,
    engine,
  };
}
