import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@rag-extension/shared/logger';
import { checkOrigin, corsHeaders } from './lib/middleware/cors';

const logger = createLogger('web:middleware');

function withHeaders(response: NextResponse, headers: Record<string, string>): NextResponse {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

function forbidden(code: string, message: string, requestId: string): NextResponse {
  // Deliberately no CORS headers: a rejected origin should surface to the
  // browser as a CORS failure rather than let the caller read the body.
  return NextResponse.json({ error: { code, message, requestId } }, { status: 403 });
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin');
  const requestId = request.headers.get('x-request-id') || 'unknown';

  if (!origin) {
    logger.warn('api request missing origin header', {
      requestId,
      pathname: request.nextUrl.pathname,
      method: request.method,
    });
    return forbidden('ORIGIN_NOT_ALLOWED', 'Missing Origin header', requestId);
  }

  if (!checkOrigin(origin)) {
    logger.warn('api request origin not allowed', {
      requestId,
      origin,
      pathname: request.nextUrl.pathname,
      method: request.method,
    });
    return forbidden('ORIGIN_NOT_ALLOWED', 'Origin not allowed', requestId);
  }

  // A cross-origin JSON POST is preflighted. The preflight never reaches the
  // route handler, so it has to be answered here or the real request is never
  // sent.
  if (request.method === 'OPTIONS') {
    logger.debug('cors preflight allowed', {
      requestId,
      origin,
      pathname: request.nextUrl.pathname,
    });
    return withHeaders(new NextResponse(null, { status: 204 }), corsHeaders(origin));
  }

  logger.debug('api request origin validated', {
    requestId,
    origin,
    pathname: request.nextUrl.pathname,
    method: request.method,
  });

  return withHeaders(NextResponse.next(), corsHeaders(origin));
}

export const config = {
  matcher: ['/api/:path*'],
};
