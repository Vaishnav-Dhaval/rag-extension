import { createGenerateClient } from '@rag-extension/api/client';
import { createLogger, categorizeError } from '@rag-extension/shared/logger';
import type { ExtensionMessage } from '../types/messages';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const client = createGenerateClient(apiBaseUrl);
const logger = createLogger('extension:background');

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    if (message.type === 'GENERATE_REPLY_REQUEST') {
      logger.debug('message received', { type: message.type, tabId: sender.tab?.id });
      messageGenerateReply(message as any, sendResponse);
      return true;
    }
  },
);

async function messageGenerateReply(
  message: { type: 'GENERATE_REPLY_REQUEST'; requestId: string; sourceText: string },
  sendResponse: (response?: unknown) => void,
): Promise<void> {
  const startTime = performance.now();
  try {
    logger.debug('generating reply', { requestId: message.requestId, sourceTextLength: message.sourceText.length });
    const result = await client.generate({ post: message.sourceText });
    const duration = performance.now() - startTime;

    logger.info('reply generated successfully', {
      requestId: message.requestId,
      durationMs: Math.round(duration),
      replyLength: result.reply.length,
    });

    sendResponse({
      type: 'GENERATE_REPLY_RESPONSE',
      requestId: message.requestId,
      reply: result.reply,
    });

    await chrome.storage.local.set({
      lastRequest: {
        requestId: message.requestId,
        status: 'success',
        reply: result.reply,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorCategory = categorizeError(error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode =
      error instanceof Error && 'code' in error ? (error.code as string) : 'INTERNAL_ERROR';

    logger.error('reply generation failed', {
      requestId: message.requestId,
      errorMessage,
      errorCode,
      errorType: errorCategory.type,
      isRetryable: errorCategory.isRetryable,
      durationMs: Math.round(duration),
    });

    sendResponse({
      type: 'GENERATE_REPLY_ERROR',
      requestId: message.requestId,
      error: {
        code: errorCode,
        message: errorMessage,
      },
    });

    await chrome.storage.local.set({
      lastRequest: {
        requestId: message.requestId,
        status: 'error',
        error: {
          code: errorCode,
          message: errorMessage,
        },
        timestamp: Date.now(),
      },
    });
  }
}
