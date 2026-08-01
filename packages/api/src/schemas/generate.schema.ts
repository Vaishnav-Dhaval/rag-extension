import { z } from 'zod';
import { MAX_POST_LENGTH } from '@rag-extension/shared/constants';

export const GenerateRequestSchema = z.object({
  post: z.string()
    .trim()
    .min(1, 'post must not be empty')
    .max(MAX_POST_LENGTH, `post must be ${MAX_POST_LENGTH} characters or fewer`),
}).strict();

export const GenerateResponseSchema = z.object({
  reply: z.string().min(1),
});

export const ErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.array(ErrorDetailSchema).optional(),
  }),
});
