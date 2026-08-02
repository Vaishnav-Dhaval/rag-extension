import { AppError, createLogger } from '@rag-extension/shared';
import { ZodError } from 'zod';

const logger = createLogger('http-error-response');

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Array<{ path: string; message: string }>;
  };
}

export function toErrorResponse(error: unknown, requestId: string): { status: number; body: ErrorResponseBody } {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: Array<{ path: string; message: string }> | undefined;

  if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    // Zod 4 renamed ZodError.errors to .issues.
    details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (error instanceof AppError) {
    status = error.statusCode;
    code = error.code;
    message = error.message;

    if (status >= 500) {
      logger.error('app-error', {
        requestId,
        code,
        message,
        cause: error.cause,
      });
    } else {
      logger.warn('app-error', {
        requestId,
        code,
        message,
      });
    }
  } else if (error instanceof Error) {
    logger.error('unknown-error', {
      requestId,
      message: error.message,
      stack: error.stack,
    });
  } else {
    logger.error('unknown-error', {
      requestId,
      error: String(error),
    });
  }

  return {
    status,
    body: {
      error: {
        code,
        message,
        requestId,
        // Omit the key entirely rather than set it to undefined, which
        // exactOptionalPropertyTypes rejects for an optional property.
        ...(details && { details }),
      },
    },
  };
}
