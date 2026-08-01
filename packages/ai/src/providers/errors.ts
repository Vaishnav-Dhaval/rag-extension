import { AppError } from '@rag-extension/shared';

export class ProviderTimeoutError extends AppError {
  constructor(providerName: string, timeoutMs: number) {
    super(`${providerName} timed out after ${timeoutMs}ms`, {
      code: 'PROVIDER_TIMEOUT',
      statusCode: 504,
      isRetryable: true,
    });
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderRateLimitError extends AppError {
  constructor(providerName: string) {
    super(`${providerName} rate limited`, {
      code: 'PROVIDER_RATE_LIMITED',
      statusCode: 429,
      isRetryable: true,
    });
    this.name = 'ProviderRateLimitError';
  }
}

export class ProviderNetworkError extends AppError {
  constructor(providerName: string, cause: unknown) {
    super(`${providerName} network error`, {
      code: 'PROVIDER_NETWORK_ERROR',
      statusCode: 502,
      isRetryable: true,
      cause,
    });
    this.name = 'ProviderNetworkError';
  }
}

export class ProviderUnavailableError extends AppError {
  constructor(providerName: string, statusCode: number = 503) {
    super(`${providerName} unavailable`, {
      code: 'PROVIDER_UNAVAILABLE',
      statusCode,
      isRetryable: true,
    });
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderInternalError extends AppError {
  constructor(providerName: string, message: string, cause?: unknown) {
    super(`${providerName} internal error: ${message}`, {
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      isRetryable: true,
      cause,
    });
    this.name = 'ProviderInternalError';
  }
}

export class AllProvidersFailedError extends AppError {
  constructor(
    readonly attempts: ReadonlyArray<{ provider: string; error: AppError }>,
    requestId: string,
  ) {
    super(`All AI providers failed to generate a reply after ${attempts.length} attempts`, {
      code: 'ALL_PROVIDERS_FAILED',
      statusCode: 502,
      isRetryable: false,
    });
    this.name = 'AllProvidersFailedError';
  }
}
