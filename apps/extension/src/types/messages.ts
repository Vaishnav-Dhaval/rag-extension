export type ExtensionMessage =
  | { type: 'EXTRACT_COMPOSE_TEXT_REQUEST'; requestId: string }
  | { type: 'EXTRACT_COMPOSE_TEXT_RESPONSE'; requestId: string; sourceText: string | null }
  | { type: 'GENERATE_REPLY_REQUEST'; requestId: string; sourceText: string }
  | { type: 'GENERATE_REPLY_RESPONSE'; requestId: string; reply: string }
  | { type: 'GENERATE_REPLY_ERROR'; requestId: string; error: { code: string; message: string } }
  | { type: 'INSERT_REPLY_REQUEST'; requestId: string; text: string }
  | { type: 'INSERT_REPLY_RESPONSE'; requestId: string; success: boolean; reason?: string };

export interface ExtensionMessage {
  type: string;
  requestId: string;
}
