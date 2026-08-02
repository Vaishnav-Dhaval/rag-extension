import { createLogger } from '@rag-extension/shared/logger';

const logger = createLogger('web:cors');

/**
 * Read only the origin allowlist rather than the full server env.
 *
 * This module is imported by middleware, which runs on the Edge runtime. Next
 * inlines every statically referenced variable into that bundle, so pulling in
 * `getServerEnv()` here would ship GROQ_API_KEY and GEMINI_API_KEY to every
 * edge location. Origin checking never needs them.
 */
function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_EXTENSION_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function checkOrigin(origin: string): boolean {
  const allowedOrigins = getAllowedOrigins();

  const isAllowed = allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;

    if (allowed.endsWith('*')) {
      const prefix = allowed.slice(0, -1);
      return origin.startsWith(prefix);
    }

    return origin === allowed;
  });

  if (!isAllowed) {
    logger.warn('origin validation failed', {
      origin,
      allowedOriginsCount: allowedOrigins.length,
      reason:
        allowedOrigins.length === 0
          ? 'ALLOWED_EXTENSION_ORIGINS is empty or unset'
          : 'origin not in allowed list',
    });
  } else {
    logger.debug('origin validation passed', {
      origin,
      allowedOriginsCount: allowedOrigins.length,
    });
  }

  return isAllowed;
}

/**
 * Headers that actually grant the request. Validating an origin is not enough:
 * without these the browser rejects the response, and rejects the preflight
 * before the real request is ever sent.
 *
 * `Vary: Origin` stops a cache from serving one origin's grant to another.
 */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-request-id',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}
