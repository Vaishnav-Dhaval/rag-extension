import { createLogger } from '@rag-extension/shared';
import { getServerEnv } from '@rag-extension/shared/env';
import type { AIProvider } from './provider';
import { GroqProvider } from './groq-provider';
import { GeminiProvider } from './gemini-provider';
import { AllProvidersFailedError } from './errors';
import type { AppError } from '@rag-extension/shared';

const logger = createLogger('ai-coordinator');

export interface GenerateReplyResult {
  readonly reply: string;
  readonly providerName: string;
  readonly attempt: number;
  readonly latencyMs: number;
}

export function createProviderChain(): AIProvider[] {
  const env = getServerEnv();

  return [
    new GroqProvider({
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
      timeoutMs: env.GROQ_TIMEOUT_MS,
    }),
    new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      timeoutMs: env.GEMINI_TIMEOUT_MS,
    }),
  ];
}

export async function generateReply(
  request: { sourceText: string; requestId: string },
  signal: AbortSignal,
): Promise<GenerateReplyResult> {
  const providers = createProviderChain();
  const failures: Array<{ provider: string; error: AppError }> = [];

  for (const [i, provider] of providers.entries()) {
    const attempt = i + 1;
    const start = Date.now();

    const providerSignal = AbortSignal.any([signal, AbortSignal.timeout(provider.timeoutMs)]);

    try {
      const result = await provider.generateReply(
        { sourceText: request.sourceText, requestId: request.requestId },
        providerSignal,
      );

      const latencyMs = Date.now() - start;
      logger.info('provider.success', {
        requestId: request.requestId,
        provider: provider.name,
        attempt,
        latencyMs,
      });

      return {
        reply: result.text,
        providerName: provider.name,
        attempt,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;

      if (err instanceof Error && 'code' in err && 'statusCode' in err) {
        const appError = err as AppError;
        failures.push({ provider: provider.name, error: appError });

        logger.warn('provider.failure', {
          requestId: request.requestId,
          provider: provider.name,
          attempt,
          code: appError.code,
          statusCode: appError.statusCode,
          latencyMs,
        });
      } else {
        logger.error('provider.failure', {
          requestId: request.requestId,
          provider: provider.name,
          attempt,
          error: err instanceof Error ? err.message : String(err),
          latencyMs,
        });
      }
    }
  }

  throw new AllProvidersFailedError(failures);
}

export { type AIProvider, type GenerateReplyParams, type GenerateReplyOutput } from './provider';
export { AllProvidersFailedError } from './errors';
