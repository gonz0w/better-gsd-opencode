import * as v from 'valibot';
import { z } from 'zod';
import { resolveValidationFlags } from './flags.js';

function mapFieldToValibot(fieldSpec) {
  let schema;

  switch (fieldSpec.type) {
    case 'coerceNumber': {
      schema = v.pipe(
        v.union([v.number(), v.string()]),
        v.transform(value => Number(value)),
        v.number()
      );
      break;
    }
    case 'enum': {
      schema = v.picklist(fieldSpec.values);
      break;
    }
    case 'string': {
      schema = v.string();
      break;
    }
    default:
      throw new Error(`Unsupported schema type: ${fieldSpec.type}`);
  }

  return fieldSpec.optional ? v.optional(schema) : schema;
}

function mapFieldToZod(fieldSpec) {
  let schema;

  switch (fieldSpec.type) {
    case 'coerceNumber': {
      schema = z.coerce.number();
      break;
    }
    case 'enum': {
      schema = z.enum(fieldSpec.values);
      break;
    }
    case 'string': {
      schema = z.string();
      break;
    }
    default:
      throw new Error(`Unsupported schema type: ${fieldSpec.type}`);
  }

  return fieldSpec.optional ? schema.optional() : schema;
}

function buildValibotSchema(schemaSpec) {
  const shape = {};
  for (const [fieldName, fieldSpec] of Object.entries(schemaSpec.shape || {})) {
    shape[fieldName] = mapFieldToValibot(fieldSpec);
  }
  return v.object(shape);
}

function buildZodSchema(schemaSpec) {
  const shape = {};
  for (const [fieldName, fieldSpec] of Object.entries(schemaSpec.shape || {})) {
    shape[fieldName] = mapFieldToZod(fieldSpec);
  }
  return z.object(shape);
}

function firstErrorMessage(result) {
  if (result.engine === 'valibot') {
    const firstIssue = result.issues && result.issues[0];
    const message = firstIssue && firstIssue.message ? firstIssue.message : 'Invalid arguments';

    if (message.includes('Expected number but received NaN')) {
      return 'Invalid input: expected number, received NaN';
    }

    return message;
  }

  const issue = result.error && result.error.issues && result.error.issues[0];
  return issue && issue.message ? issue.message : 'Invalid arguments';
}

function emitDebugMarker(toolName, engine) {
  if (process.env.GSD_DEBUG !== '1') {
    return;
  }

  process.stderr.write(`[bGSD:validation-engine] ${toolName}:${engine}\n`);
}

export function createObjectSchema(shape) {
  return { type: 'object', shape };
}

export function validateArgs(toolName, schemaSpec, input) {
  const flags = resolveValidationFlags();
  const source = input && typeof input === 'object' ? input : {};
  const engine = flags.engine;
  emitDebugMarker(toolName, engine);

  const result = engine === 'valibot'
    ? v.safeParse(buildValibotSchema(schemaSpec), source)
    : buildZodSchema(schemaSpec).safeParse(source);

  if (engine === 'valibot') {
    if (result.success) {
      return {
        ok: true,
        data: result.output,
        error: null,
      };
    }

    return {
      ok: false,
      data: null,
      error: {
        code: 'validation_error',
        message: firstErrorMessage({ ...result, engine }),
      },
    };
  }

  if (result.success) {
    return {
      ok: true,
      data: result.data,
      error: null,
    };
  }

  return {
    ok: false,
    data: null,
    error: {
      code: 'validation_error',
      message: firstErrorMessage({ ...result, engine }),
    },
  };
}
