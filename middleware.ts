import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=self, microphone=self')
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  response.headers.set('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws: wss:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:;")

  return response
}

export const config = {
  matcher: '/:path*',
}

