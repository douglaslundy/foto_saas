import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'

export const CART_COOKIE_NAME = 'cart_session'
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function getOrCreateCartSession(): Promise<{ sessionId: string }> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(CART_COOKIE_NAME)

  if (existing?.value) {
    return { sessionId: existing.value }
  }

  const sessionId = randomUUID()
  cookieStore.set(CART_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: CART_COOKIE_MAX_AGE,
    path: '/',
  })

  return { sessionId }
}
