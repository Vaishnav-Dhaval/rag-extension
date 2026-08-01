interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are an expert social media writing assistant specialized in crafting thoughtful replies to X (Twitter) posts.

Generate a natural, friendly, and professional reply to the given X post.

Requirements:
- Keep it natural and human-like (avoid sounding like AI)
- Keep it under 280 characters
- Be professional and respectful
- Don't invent facts or make unsupported claims
- Avoid aggressive or confrontational tone
- Respect the original post's context and intent
- Use emojis only if appropriate and natural
- Use hashtags only if relevant and useful
- Avoid repetitive phrases and clichés

Return ONLY the reply text, nothing else.`;

const DELIMITER_START = '<!-- TWEET_START -->';
const DELIMITER_END = '<!-- TWEET_END -->';

export function buildReplyMessages(sourceText: string): ChatMessage[] {
  // Escape delimiters in the source text to prevent prompt injection
  const sanitized = sourceText
    .replace(/<!--/g, '&lt;!--')
    .replace(/-->/g, '--&gt;');

  const userMessage = `${DELIMITER_START}
${sanitized}
${DELIMITER_END}

Please write a thoughtful reply to this X post.`;

  return [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: userMessage,
    },
  ];
}
