import { createLogger } from '@rag-extension/shared/logger';
import { detectReplyTarget } from '../dom/compose-detector';
import { insertReplyText } from '../dom/text-inserter';

const logger = createLogger('extension:x-adapter');

export interface PlatformAdapter {
  detectComposeTarget(): Promise<string | null>;
  insertText(text: string): Promise<boolean>;
}

class XAdapter implements PlatformAdapter {
  async detectComposeTarget(): Promise<string | null> {
    const startTime = performance.now();
    try {
      const result = await detectReplyTarget();
      const duration = performance.now() - startTime;
      logger.debug('compose target detected', {
        platform: 'x.com',
        success: result !== null,
        durationMs: Math.round(duration),
      });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('compose target detection failed', {
        platform: 'x.com',
        durationMs: Math.round(duration),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async insertText(text: string): Promise<boolean> {
    const startTime = performance.now();
    try {
      const result = await insertReplyText(text);
      const duration = performance.now() - startTime;
      logger.debug('text insertion completed', {
        platform: 'x.com',
        success: result,
        textLength: text.length,
        durationMs: Math.round(duration),
      });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('text insertion failed', {
        platform: 'x.com',
        textLength: text.length,
        durationMs: Math.round(duration),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export function createPlatformAdapter(): PlatformAdapter {
  return new XAdapter();
}
