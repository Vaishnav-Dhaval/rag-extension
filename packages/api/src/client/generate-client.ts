import { GenerateRequestSchema, GenerateResponseSchema } from '../schemas';
import type { GenerateRequest, GenerateResponse } from '../types';
import { AppError } from '@rag-extension/shared';

export interface GenerateClientOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
}

export class GenerateClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: GenerateClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const validated = GenerateRequestSchema.safeParse(request);
    if (!validated.success) {
      throw new AppError('Invalid request', {
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(validated.data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData: Record<string, unknown> | undefined;
        try {
          errorData = await response.json();
        } catch {
          // Ignore JSON parse errors for non-ok responses
        }

        const errorCode = (errorData?.error as Record<string, unknown>)?.code || 'INTERNAL_ERROR';
        const errorMessage = (errorData?.error as Record<string, unknown>)?.message || response.statusText;

        throw new AppError(String(errorMessage), {
          code: errorCode as any,
          statusCode: response.status,
        });
      }

      const body = await response.json();
      const result = GenerateResponseSchema.safeParse(body);

      if (!result.success) {
        throw new AppError('Invalid response from server', {
          code: 'INTERNAL_ERROR',
          statusCode: 500,
        });
      }

      return result.data;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof AppError) {
        throw err;
      }

      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new AppError('Network error', {
          code: 'INTERNAL_ERROR',
          statusCode: 502,
          cause: err,
        });
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new AppError('Request timeout', {
          code: 'INTERNAL_ERROR',
          statusCode: 504,
          cause: err,
        });
      }

      throw new AppError(err instanceof Error ? err.message : 'Unknown error', {
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        cause: err,
      });
    }
  }
}

export function createGenerateClient(baseUrl: string, options?: Partial<GenerateClientOptions>): GenerateClient {
  return new GenerateClient({ baseUrl, ...options });
}
