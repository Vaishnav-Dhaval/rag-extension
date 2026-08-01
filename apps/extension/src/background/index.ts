import { createGenerateClient } from '@rag-extension/api/client';
import type { ExtensionMessage } from '../types/messages';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const client = createGenerateClient(apiBaseUrl);

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    if (message.type === 'GENERATE_REPLY_REQUEST') {
      messageGenerateReply(message as any, sendResponse);
      return true;
    }
  },
);

async function messageGenerateReply(
  message: { type: 'GENERATE_REPLY_REQUEST'; requestId: string; sourceText: string },
  sendResponse: (response?: unknown) => void,
): Promise<void> {
  try {
    const result = await client.generate({ post: message.sourceText });

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode =
      error instanceof Error && 'code' in error ? (error.code as string) : 'INTERNAL_ERROR';

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
