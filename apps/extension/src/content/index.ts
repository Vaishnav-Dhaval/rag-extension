import { createPlatformAdapter } from './platforms/x-adapter';
import { detectReplyTarget } from './dom/compose-detector';
import { createLogger, categorizeError } from '@rag-extension/shared/logger';
import type { ExtensionMessage } from '../types/messages';

const adapter = createPlatformAdapter();
const logger = createLogger('extension:content');

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean => {
    // Liveness probe used by the popup to decide whether it must inject this
    // script before messaging it. Must stay cheap and dependency-free.
    if (message.type === 'PING') {
      sendResponse({ type: 'PONG', requestId: message.requestId });
      return false;
    }

    if (message.type === 'EXTRACT_COMPOSE_TEXT_REQUEST') {
      logger.debug('extract compose text request', { requestId: message.requestId });
      const sourceText = messageExtractComposeText(message);
      logger.debug('extract compose text response', { requestId: message.requestId, success: sourceText !== null });

      sendResponse({
        type: 'EXTRACT_COMPOSE_TEXT_RESPONSE',
        requestId: message.requestId,
        sourceText,
      });
      return false;
    }

    if (message.type === 'INSERT_REPLY_REQUEST') {
      logger.debug('insert reply request', { requestId: message.requestId, textLength: message.text.length });
      messageInsertReply(message, sendResponse);
      // Keeps the message channel open for the async sendResponse above.
      return true;
    }

    return false;
  },
);

function messageExtractComposeText(
  message: { type: 'EXTRACT_COMPOSE_TEXT_REQUEST'; requestId: string },
): string | null {
  try {
    return detectReplyTarget();
  } catch (error) {
    logger.error('extract compose text failed', {
      requestId: message.requestId,
      errorType: categorizeError(error).type,
    });
    return null;
  }
}

function messageInsertReply(
  message: { type: 'INSERT_REPLY_REQUEST'; requestId: string; text: string },
  sendResponse: (response?: unknown) => void,
): void {
  adapter
    .insertText(message.text)
    .then((success) => {
      if (success) {
        logger.info('reply inserted successfully', { requestId: message.requestId });
      } else {
        logger.warn('reply insertion failed', {
          requestId: message.requestId,
          reason: 'Failed to locate or insert into compose box',
        });
      }
      sendResponse({
        type: 'INSERT_REPLY_RESPONSE',
        requestId: message.requestId,
        success,
        reason: success ? undefined : 'Failed to locate or insert into compose box',
      });
    })
    .catch((error) => {
      const errorCategory = categorizeError(error);
      logger.error('reply insertion failed', {
        requestId: message.requestId,
        errorType: errorCategory.type,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      sendResponse({
        type: 'INSERT_REPLY_RESPONSE',
        requestId: message.requestId,
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    });
}
