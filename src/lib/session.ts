import { cookies } from 'next/headers'
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session'

export interface SessionData {
  partnerId?: string
  pendingPartnerId?: string
}

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is not set')
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'cwp_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}
