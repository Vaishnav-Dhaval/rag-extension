import pino, { type Logger, type LoggerOptions } from 'pino';

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

  if (!isProduction) {
    return pino(options, pino.transport({ target: 'pino-pretty' }));
  }

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

export function createLogger(scope: string): Logger {
  const logger = createPinoLogger(scope);

  return {
    ...logger,
    debug: (msg, obj?, ...rest) => logger.debug(obj ? { data: redactSensitive(obj) } : {}, msg, ...rest),
    info: (msg, obj?, ...rest) => logger.info(obj ? { data: redactSensitive(obj) } : {}, msg, ...rest),
    warn: (msg, obj?, ...rest) => logger.warn(obj ? { data: redactSensitive(obj) } : {}, msg, ...rest),
    error: (msg, obj?, ...rest) => logger.error(obj ? { data: redactSensitive(obj) } : {}, msg, ...rest),
  };
}
