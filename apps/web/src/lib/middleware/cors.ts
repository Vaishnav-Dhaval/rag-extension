import { getServerEnv } from '@rag-extension/shared';
import { createLogger } from '@rag-extension/shared/logger';

const logger = createLogger('web:cors');

export function checkOrigin(origin: string): boolean {
  const env = getServerEnv();
  const allowedOrigins = env.ALLOWED_EXTENSION_ORIGINS.split(',').map((o) => o.trim());

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
      reason: 'origin not in allowed list',
    });
  } else {
    logger.debug('origin validation passed', {
      origin,
      allowedOriginsCount: allowedOrigins.length,
    });
  }

  return isAllowed;
}
