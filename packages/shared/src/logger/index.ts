import pino, { type Logger, type LoggerOptions } from 'pino';

declare const window: unknown | undefined;

const createPinoLogger = (scope: string): Logger => {
  const isProduction = process.env.NODE_ENV === 'production';

  const options: LoggerOptions = {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    base: { scope },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      bindings: (bindings) => {
        const { pid, hostname, ...rest } = bindings;
        return rest;
      },
      level: (label) => {
        return { level: label };
      },
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  };

  // No pretty-print transport: this module also runs in the browser (content
  // script) and on Next's Edge runtime (middleware), where pino resolves to its
  // browser build and exposes no `transport`. Worker-based transports are a
  // Node-only feature, so calling one here throws before any log is emitted.
  return pino(options);
};

function redactSensitive(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date || obj instanceof Error) return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      key.toLowerCase().includes('key') ||
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('password')
    ) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSensitive(value);
    }
  }
  return result;
}

export type { Logger };

export interface ErrorCategory {
  type: 'network' | 'validation' | 'auth' | 'unknown';
  isRetryable: boolean;
  code?: string;
}

export function categorizeError(err: unknown): ErrorCategory {
  if (!(err instanceof Error)) {
    return { type: 'unknown', isRetryable: false };
  }

  const message = err.message.toLowerCase();
  const code = (err as any).code?.toString().toUpperCase() || '';

  // Network errors → retryable
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    message.includes('timeout') ||
    message.includes('econnrefused')
  ) {
    return { type: 'network', isRetryable: true, code };
  }

  // HTTP status errors
  if ((err as any).status || (err as any).statusCode) {
    const status = (err as any).status || (err as any).statusCode;
    if (status >= 500) return { type: 'network', isRetryable: true, code: status.toString() };
    if (status === 401 || status === 403) return { type: 'auth', isRetryable: false, code: status.toString() };
    if (status >= 400 && status < 500) return { type: 'validation', isRetryable: false, code: status.toString() };
  }

  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    return { type: 'validation', isRetryable: false };
  }

  // Auth errors
  if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('auth')) {
    return { type: 'auth', isRetryable: false };
  }

  return { type: 'unknown', isRetryable: false };
}

export function logStructuredError(
  logger: ScopedLogger,
  err: unknown,
  context?: Record<string, unknown>,
  message?: string
): void {
  const category = categorizeError(err);
  const errorObj = err instanceof Error ? err : new Error(String(err));

  logger.error(message || 'error occurred', {
    ...context,
    errorType: category.type,
    isRetryable: category.isRetryable,
    errorCode: category.code,
    errorMessage: errorObj.message,
  });
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger returned by {@link createLogger}. Deliberately narrower than pino's
 * `Logger`: every method takes the event name first and an optional structured
 * payload second, which is the reverse of pino's own argument order.
 */
export interface ScopedLogger {
  debug(event: string, data?: unknown): void;
  info(event: string, data?: unknown): void;
  warn(event: string, data?: unknown): void;
  error(event: string, data?: unknown): void;
}

export function createLogger(scope: string): ScopedLogger {
  const logger = createPinoLogger(scope);

  const emit =
    (level: LogLevel) =>
    (event: string, data?: unknown): void => {
      logger[level](data === undefined ? {} : { data: redactSensitive(data) }, event);
    };

  return {
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
  };
}
