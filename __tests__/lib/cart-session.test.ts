/**
 * @jest-environment node
 */

import { getOrCreateCartSession, CART_COOKIE_NAME, CART_COOKIE_MAX_AGE } from '@/lib/cart-session'

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

import { cookies } from 'next/headers'

describe('cart-session', () => {
  const mockGet = jest.fn()
  const mockSet = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(cookies as jest.Mock).mockResolvedValue({
      get: mockGet,
      set: mockSet,
    })
  })

  describe('getOrCreateCartSession', () => {
    it('returns existing session id from cookie', async () => {
      const existingId = 'existing-uuid-1234'
      mockGet.mockReturnValue({ value: existingId })

      const result = await getOrCreateCartSession()

      expect(result.sessionId).toBe(existingId)
      expect(mockSet).not.toHaveBeenCalled()
    })

    it('creates a new UUID session when no cookie exists', async () => {
      mockGet.mockReturnValue(undefined)

      const result = await getOrCreateCartSession()

      expect(result.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
      expect(mockSet).toHaveBeenCalledWith(
        CART_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          maxAge: CART_COOKIE_MAX_AGE,
          path: '/',
        })
      )
    })

    it('exports correct constants', () => {
      expect(CART_COOKIE_NAME).toBe('cart_session')
      expect(CART_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 30)
    })
  })
})
