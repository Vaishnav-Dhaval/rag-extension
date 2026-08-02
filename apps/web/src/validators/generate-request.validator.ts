import { GenerateRequestSchema } from '@rag-extension/api';
import type { GenerateRequest } from '@rag-extension/api';

export function validateGenerateRequest(data: unknown): GenerateRequest {
  const result = GenerateRequestSchema.safeParse(data);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}
