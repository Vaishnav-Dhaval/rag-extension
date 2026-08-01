import { AppError } from '../errors/app-error';

export class TimeoutError extends AppError {
  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`, {
      code: 'INTERNAL_ERROR',
      statusCode: 504,
      isRetryable: false,
    });
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}
