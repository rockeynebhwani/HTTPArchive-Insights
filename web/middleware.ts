import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

function expectedHash(): string {
  const pw = process.env.SITE_PASSWORD ?? ''
  const secret = process.env.AUTH_SECRET ?? 'httparchive-insights'
  return createHash('sha256').update(pw + secret).digest('hex')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow login page and auth API
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get('auth_session')?.value
  if (cookie && cookie === expectedHash()) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
