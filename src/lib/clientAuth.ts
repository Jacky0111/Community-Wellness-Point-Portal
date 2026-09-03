/**
 * Session-expiry guard for client components that call protected `/api/`
 * routes. The middleware returns a 401 JSON response (rather than an HTML
 * redirect) for an unauthenticated API request, so client fetches can detect
 * it directly instead of failing silently on `res.json()`. This sends the
 * user to `/login` whenever that happens — e.g. their session cookie expired,
 * or their account was deactivated mid-session.
 *
 * Returns `true` if a redirect was triggered (callers should stop processing
 * the response in that case), `false` otherwise.
 */
export function redirectIfUnauthorized(res: Response, router: { push: (href: string) => void }): boolean {
  if (res.status === 401) {
    router.push('/login')
    return true
  }
  return false
}
