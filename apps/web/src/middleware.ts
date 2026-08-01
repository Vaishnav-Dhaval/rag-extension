import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@rag-extension/shared/logger';
import { checkOrigin } from './lib/middleware/cors';

const logger = createLogger('web:middleware');

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const requestId = request.headers.get('x-request-id') || 'unknown';

    if (!origin) {
      logger.warn('api request missing origin header', {
        requestId,
        pathname: request.nextUrl.pathname,
        method: request.method,
      });
      return NextResponse.json(
        {
          error: {
            code: 'ORIGIN_NOT_ALLOWED',
            message: 'Missing Origin header',
            requestId,
          },
        },
        { status: 403 },
      );
    }

    const isAllowed = checkOrigin(origin);
    if (!isAllowed) {
      logger.warn('api request origin not allowed', {
        requestId,
        origin,
        pathname: request.nextUrl.pathname,
        method: request.method,
      });
      return NextResponse.json(
        {
          error: {
            code: 'ORIGIN_NOT_ALLOWED',
            message: 'Origin not allowed',
            requestId,
          },
        },
        { status: 403 },
      );
    }

    logger.debug('api request origin validated', {
      requestId,
      origin,
      pathname: request.nextUrl.pathname,
      method: request.method,
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
