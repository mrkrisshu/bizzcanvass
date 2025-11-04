import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Neutral middleware: allow requests to proceed
export async function middleware(_request: NextRequest) {
  return NextResponse.next()
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/auth/:path*',
  ],
}
