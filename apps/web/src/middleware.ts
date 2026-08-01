import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin } from './lib/middleware/cors';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');

    if (!origin) {
      return NextResponse.json(
        {
          error: {
            code: 'ORIGIN_NOT_ALLOWED',
            message: 'Missing Origin header',
            requestId: request.headers.get('x-request-id') || 'unknown',
          },
        },
        { status: 403 },
      );
    }

    const isAllowed = checkOrigin(origin);
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: {
            code: 'ORIGIN_NOT_ALLOWED',
            message: 'Origin not allowed',
            requestId: request.headers.get('x-request-id') || 'unknown',
          },
        },
        { status: 403 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
