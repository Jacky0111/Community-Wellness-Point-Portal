import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/login/change-password', '/login/verify', '/login/enroll']

// middleware.ts runs in the Edge runtime, which cannot load bcrypt or Prisma.
// src/lib/session.ts already throws a clear error when SESSION_SECRET is
// missing, but only its *type* is imported here (see the `import type` above),
// so that check never actually runs for requests handled by the middleware.
// Importing session.ts as a value (not just its type) would pull bcrypt/Prisma
// into the Edge bundle, so this check is duplicated standalone instead.
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is not set')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/')
  ) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, {
    password: process.env.SESSION_SECRET as string,
    cookieName: 'cwp_session',
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
  })

  if (!session.partnerId) {
    // API requests get a JSON 401 instead of an HTML redirect — client code
    // calls res.json() on the response, and redirecting would hand it an
    // HTML login page to parse as JSON, failing silently. Page requests keep
    // the redirect.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
