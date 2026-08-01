import { NextRequest, NextResponse } from 'next/server';
import { createLogger, generateRequestId, withTimeout } from '@rag-extension/shared';
import { REQUEST_TIMEOUT_MS } from '@rag-extension/shared/constants';
import { generateReply } from '@rag-extension/ai';
import { readBodyWithSizeGuard, safeJsonParse } from '@/lib/http/body-parser';
import { validateGenerateRequest } from '@/validators/generate-request.validator';
import { toErrorResponse } from '@/lib/http/error-response';
import type { GenerateResponse } from '@rag-extension/api';

export const runtime = 'nodejs';
export const maxDuration = 25;

const logger = createLogger('api-generate');

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();

  try {
    const rawBody = await readBodyWithSizeGuard(request);
    const json = safeJsonParse(rawBody);
    const parsed = validateGenerateRequest(json);

    const result = await withTimeout(
      generateReply({ sourceText: parsed.post, requestId }, request.signal),
      REQUEST_TIMEOUT_MS,
    );

    logger.info('request.success', {
      requestId,
      provider: result.providerName,
      attempt: result.attempt,
      latencyMs: result.latencyMs,
    });

    const response: GenerateResponse = {
      reply: result.reply,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    const { status, body } = toErrorResponse(err, requestId);

    logger.error('request.failure', {
      requestId,
      code: body.error.code,
      status,
    });

    return NextResponse.json(body, { status });
  }
}
