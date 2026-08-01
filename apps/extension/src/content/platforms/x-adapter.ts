import { detectReplyTarget } from '../dom/compose-detector';
import { insertReplyText } from '../dom/text-inserter';

export interface PlatformAdapter {
  detectComposeTarget(): Promise<string | null>;
  insertText(text: string): Promise<boolean>;
}

class XAdapter implements PlatformAdapter {
  async detectComposeTarget(): Promise<string | null> {
    return detectReplyTarget();
  }

  async insertText(text: string): Promise<boolean> {
    return insertReplyText(text);
  }
}

export function createPlatformAdapter(): PlatformAdapter {
  return new XAdapter();
}
