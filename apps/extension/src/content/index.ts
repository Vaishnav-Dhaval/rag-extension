import { createPlatformAdapter } from './platforms/x-adapter';
import { createLogger, categorizeError } from '@rag-extension/shared/logger';
import type { ExtensionMessage } from '../types/messages';

const adapter = createPlatformAdapter();
const logger = createLogger('extension:content');

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    if (message.type === 'EXTRACT_COMPOSE_TEXT_REQUEST') {
      logger.debug('extract compose text request', { requestId: message.requestId });
      const sourceText = messageExtractComposeText(message as any);
      logger.debug('extract compose text response', { requestId: message.requestId, success: sourceText !== null });

      sendResponse({
        type: 'EXTRACT_COMPOSE_TEXT_RESPONSE',
        requestId: message.requestId,
        sourceText,
      });
    } else if (message.type === 'INSERT_REPLY_REQUEST') {
      logger.debug('insert reply request', { requestId: message.requestId, textLength: (message as any).text.length });
      messageInsertReply(message as any, sendResponse);
      return true;
    }
  },
);

function messageExtractComposeText(
  message: { type: 'EXTRACT_COMPOSE_TEXT_REQUEST'; requestId: string },
): string | null {
  try {
    const sourceText = detectReplyTargetSync();
    return sourceText;
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

// Synchronous version for immediate response
function detectReplyTargetSync(): string | null {
  try {
    const sourceText = detectReplyTargetSync_impl();
    return sourceText;
  } catch {
    return null;
  }
}

function detectReplyTargetSync_impl(): string | null {
  const COMPOSE_TEXTAREA = '[data-testid^="tweetTextarea"][contenteditable="true"]';
  const DIALOG = 'div[role="dialog"]';
  const TWEET_ARTICLE = 'article[data-testid="tweet"]';
  const TWEET_TEXT = '[data-testid="tweetText"]';

  const activeTextarea = document.activeElement?.closest(COMPOSE_TEXTAREA);
  let composeBox = activeTextarea as HTMLElement | null;

  if (!composeBox) {
    const allCompose = Array.from(document.querySelectorAll(COMPOSE_TEXTAREA));
    const dialogCompose = allCompose.find((el) => el.closest(DIALOG));
    composeBox = (dialogCompose || allCompose[0]) as HTMLElement | null;
  }

  if (!composeBox) {
    return null;
  }

  const dialog = composeBox.closest(DIALOG);
  if (!dialog) {
    return null;
  }

  const tweet = dialog.querySelector(TWEET_ARTICLE);
  if (!tweet) {
    return null;
  }

  const tweetText = tweet.querySelector(TWEET_TEXT);
  if (!tweetText) {
    return null;
  }

  const text = (tweetText as HTMLElement).innerText?.trim();
  return text && text.length > 0 ? text : null;
}
