export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'ORIGIN_NOT_ALLOWED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_NETWORK_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'ALL_PROVIDERS_FAILED';

export interface AppErrorOptions {
  code: ErrorCode;
  statusCode: number;
  isRetryable?: boolean;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly isRetryable: boolean;
  readonly cause?: unknown;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.isRetryable = options.isRetryable ?? false;
    this.cause = options.cause;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
    };
  }
}
