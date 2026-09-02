import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/login/change-password', '/login/verify', '/login/enroll']

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
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
