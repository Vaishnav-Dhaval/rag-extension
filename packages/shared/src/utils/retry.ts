import { AppError } from '../errors/app-error';

export interface RetryOptions {
  readonly maxAttempts: number;
  readonly backoffMs?: number;
  readonly backoffMultiplier?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  const backoff = options.backoffMs ?? 100;
  const multiplier = options.backoffMultiplier ?? 2;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof AppError && err.isRetryable;
      const isLastAttempt = attempt === options.maxAttempts;

      if (!isRetryable || isLastAttempt) {
        throw err;
      }

      const delayMs = backoff * Math.pow(multiplier, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
