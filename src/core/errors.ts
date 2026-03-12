import { stableStringify, toJsonValue, type JsonValue } from './json.js';

export const EXIT_CODES = {
  success: 0,
  general: 1,
  usage: 2,
  auth: 3,
  config: 4,
  network: 5
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export interface CliJsonErrorShape {
  backend_payload?: JsonValue;
  code: string;
  exit_code: ExitCode;
  http_status?: number;
  http_status_text?: string;
  message: string;
  raw_body_preview?: string;
}

export interface CliErrorOptions {
  cause?: unknown;
  code: string;
  details?: string[];
  exitCode?: ExitCode;
  json?: CliJsonErrorShape;
  metadata?: JsonValue;
  suggestion?: string;
}

export class CliError extends Error {
  override readonly name = 'CliError';
  override readonly cause: unknown;
  readonly code: string;
  readonly details: string[];
  readonly exitCode: ExitCode;
  readonly json: CliJsonErrorShape | undefined;
  readonly metadata: JsonValue | undefined;
  readonly suggestion: string | undefined;

  constructor(message: string, options: CliErrorOptions) {
    super(message);
    this.code = options.code;
    this.exitCode = options.exitCode ?? EXIT_CODES.general;
    this.details = options.details ?? [];
    this.json = options.json;
    this.metadata = options.metadata;
    this.suggestion = options.suggestion;
    this.cause = options.cause;
  }
}

export function isCliError(error: unknown): error is CliError {
  return error instanceof CliError;
}

export interface FormatErrorOptions {
  json?: boolean;
}

export function formatError(
  error: unknown,
  options: FormatErrorOptions = {}
): string {
  if (options.json) {
    return `${stableStringify(serializeError(error))}\n`;
  }

  if (isCliError(error)) {
    const lines = [`Error: ${error.message}`];

    if (error.details.length > 0) {
      lines.push('');
      lines.push('Details:');
      lines.push(...error.details.map((detail) => `- ${detail}`));
    }

    if (error.suggestion !== undefined) {
      lines.push('');
      lines.push(`Next step: ${error.suggestion}`);
    }

    return `${lines.join('\n')}\n`;
  }

  if (error instanceof Error) {
    return `Unexpected error: ${error.message}\n`;
  }

  return 'Unexpected error: an unknown failure occurred.\n';
}

function serializeError(error: unknown): JsonValue {
  if (isCliError(error)) {
    if (error.json !== undefined) {
      return {
        error: toJsonValue(error.json)
      };
    }

    return {
      error: {
        code: error.code,
        details: error.details,
        exit_code: error.exitCode,
        message: error.message,
        metadata: error.metadata ?? null,
        suggestion: error.suggestion ?? null,
        type: 'cli'
      }
    };
  }

  if (error instanceof Error) {
    return {
      error: {
        code: 'UNEXPECTED_ERROR',
        details: [],
        exit_code: EXIT_CODES.general,
        message: error.message,
        metadata: null,
        suggestion: null,
        type: 'unexpected'
      }
    };
  }

  return {
    error: {
      code: 'UNKNOWN_ERROR',
      details: [],
      exit_code: EXIT_CODES.general,
      message: 'an unknown failure occurred.',
      metadata: {
        value: toJsonValue(error)
      },
      suggestion: null,
      type: 'unknown'
    }
  };
}
