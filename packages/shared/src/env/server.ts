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

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const missing = Object.keys(parsed.error.flatten().fieldErrors);
    throw new Error(`Missing or invalid environment variables: ${missing.join(', ')}`);
  }

  cached = parsed.data;
  return cached;
}
