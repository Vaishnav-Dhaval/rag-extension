import { getServerEnv } from '@rag-extension/shared';

export function checkOrigin(origin: string): boolean {
  const env = getServerEnv();
  const allowedOrigins = env.ALLOWED_EXTENSION_ORIGINS.split(',').map((o) => o.trim());

  return allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;

    if (allowed.endsWith('*')) {
      const prefix = allowed.slice(0, -1);
      return origin.startsWith(prefix);
    }

    return origin === allowed;
  });
}
