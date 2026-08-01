import { GoogleGenerativeAI } from '@google/generative-ai';
import { createLogger } from '@rag-extension/shared';
import {
  ProviderTimeoutError,
  ProviderRateLimitError,
  ProviderNetworkError,
  ProviderUnavailableError,
  ProviderInternalError,
} from './errors';
import { AIProvider, GenerateReplyParams, GenerateReplyOutput, ProviderConfig } from './provider';
import { buildReplyMessages } from '../prompts';

const logger = createLogger('gemini-provider');

function classifyGeminiError(error: unknown, timeoutMs: number): Error {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new ProviderTimeoutError('Gemini', timeoutMs);
    }

    const message = error.message.toLowerCase();

    if (message.includes('429') || message.includes('rate')) {
      return new ProviderRateLimitError('Gemini');
    }

    if (message.includes('5') || message.includes('500') || message.includes('503')) {
      return new ProviderUnavailableError('Gemini');
    }

    if (message.includes('econnrefused') || message.includes('enotfound') || message.includes('network')) {
      return new ProviderNetworkError('Gemini', error);
    }
  }

  return new ProviderInternalError('Gemini', error instanceof Error ? error.message : String(error), error);
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly timeoutMs: number;
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  constructor(config: ProviderConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
  }

  async generateReply(params: GenerateReplyParams, signal: AbortSignal): Promise<GenerateReplyOutput> {
    try {
      const messages = buildReplyMessages(params.sourceText);
      const model = this.client.getGenerativeModel({ model: this.model });

      const result = await Promise.race([
        model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ text: messages[messages.length - 1]!.content }],
            },
          ],
          systemInstruction: messages[0]?.role === 'system' ? messages[0].content : undefined,
          generationConfig: {
            maxOutputTokens: 400,
            temperature: 0.7,
          },
        }),
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('AbortError')));
        }),
      ]);

      const text = result.response.text().trim();
      if (!text) {
        throw new ProviderInternalError('Gemini', 'Empty completion returned');
      }

      return { text };
    } catch (error) {
      throw classifyGeminiError(error, this.timeoutMs);
    }
  }
}
