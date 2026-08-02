import { z } from 'zod';
import { MAX_POST_LENGTH, MAX_PAYLOAD_BYTES, REQUEST_TIMEOUT_MS, GROQ_TIMEOUT_MS, GEMINI_TIMEOUT_MS } from '../constants/limits';

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  GROQ_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GEMINI_MODEL: z.string().default('gemini-3-flash'),
  GROQ_TIMEOUT_MS: z.coerce.number().default(GROQ_TIMEOUT_MS),
  GEMINI_TIMEOUT_MS: z.coerce.number().default(GEMINI_TIMEOUT_MS),

  MAX_POST_LENGTH: z.coerce.number().default(MAX_POST_LENGTH),
  MAX_PAYLOAD_BYTES: z.coerce.number().default(MAX_PAYLOAD_BYTES),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(REQUEST_TIMEOUT_MS),

  ALLOWED_EXTENSION_ORIGINS: z.string(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  // Each variable must be referenced statically. Bundlers that inline env vars
  // (Next on the Edge runtime, Vite) cannot see through a bulk read of
  // `process.env`, so passing the object wholesale yields undefined values.
  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GROQ_TIMEOUT_MS: process.env.GROQ_TIMEOUT_MS,
    GEMINI_TIMEOUT_MS: process.env.GEMINI_TIMEOUT_MS,
    MAX_POST_LENGTH: process.env.MAX_POST_LENGTH,
    MAX_PAYLOAD_BYTES: process.env.MAX_PAYLOAD_BYTES,
    REQUEST_TIMEOUT_MS: process.env.REQUEST_TIMEOUT_MS,
    ALLOWED_EXTENSION_ORIGINS: process.env.ALLOWED_EXTENSION_ORIGINS,
  });

  if (!parsed.success) {
    const missing = Object.keys(parsed.error.flatten().fieldErrors);
    throw new Error(`Missing or invalid environment variables: ${missing.join(', ')}`);
  }

  cached = parsed.data;
  return cached;
}
