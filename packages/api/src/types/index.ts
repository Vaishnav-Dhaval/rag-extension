import { z } from 'zod';
import { GenerateRequestSchema, GenerateResponseSchema, ErrorResponseSchema, ErrorDetailSchema } from '../schemas';

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
