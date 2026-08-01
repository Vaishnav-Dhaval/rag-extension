import Groq from 'groq-sdk';
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

const logger = createLogger('groq-provider');

function classifyGroqError(error: unknown, timeoutMs: number): Error {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new ProviderTimeoutError('Groq', timeoutMs);
    }

    if (error.message.includes('429')) {
      return new ProviderRateLimitError('Groq');
    }

    if (error.message.includes('5')) {
      return new ProviderUnavailableError('Groq');
    }

    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      return new ProviderNetworkError('Groq', error);
    }
  }

  return new ProviderInternalError('Groq', error instanceof Error ? error.message : String(error), error);
}

export class GroqProvider implements AIProvider {
  readonly name = 'groq';
  readonly timeoutMs: number;
  private readonly client: Groq;
  private readonly model: string;

  constructor(config: ProviderConfig) {
    this.client = new Groq({ apiKey: config.apiKey });
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
  }

  async generateReply(params: GenerateReplyParams, signal: AbortSignal): Promise<GenerateReplyOutput> {
    try {
      const messages = buildReplyMessages(params.sourceText);

      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          messages,
          max_tokens: 400,
          temperature: 0.7,
        },
        {
          signal,
          timeout: this.timeoutMs,
        },
      );

      const text = completion.choices[0]?.message.content?.trim();
      if (!text) {
        throw new ProviderInternalError('Groq', 'Empty completion returned');
      }

      return { text };
    } catch (error) {
      throw classifyGroqError(error, this.timeoutMs);
    }
  }
}
