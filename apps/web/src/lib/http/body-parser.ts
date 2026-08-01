import { AppError } from '@rag-extension/shared';
import { MAX_PAYLOAD_BYTES } from '@rag-extension/shared/constants';

export async function readBodyWithSizeGuard(request: Request, maxBytes: number = MAX_PAYLOAD_BYTES): Promise<string> {
  const contentLength = request.headers.get('content-length');

  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxBytes) {
      throw new AppError('Payload too large', {
        code: 'PAYLOAD_TOO_LARGE',
        statusCode: 413,
      });
    }
  }

  try {
    const text = await request.text();

    if (text.length > maxBytes) {
      throw new AppError('Payload too large', {
        code: 'PAYLOAD_TOO_LARGE',
        statusCode: 413,
      });
    }

    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError('Failed to read request body', {
      code: 'INTERNAL_ERROR',
      statusCode: 400,
      cause: error,
    });
  }
}

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AppError('Invalid JSON', {
      code: 'INVALID_JSON',
      statusCode: 400,
      cause: error,
    });
  }
}
