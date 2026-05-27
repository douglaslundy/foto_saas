/**
 * @jest-environment node
 */

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

jest.mock('@/lib/cart-session', () => ({
  getOrCreateCartSession: jest.fn(),
  CART_COOKIE_NAME: 'cart_session',
  CART_COOKIE_MAX_AGE: 2592000,
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { getOrCreateCartSession } from '@/lib/cart-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET, POST } from '@/app/api/cart/route'
import { DELETE } from '@/app/api/cart/[photoId]/route'

describe('GET /api/cart', () => {
  it('returns cart items for session', async () => {
    const sessionId = 'test-session-uuid'
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId })

    const mockItems = [
      {
        id: 'item1',
        photo_id: 'photo1',
        event_id: 'evt1',
        price_cents: 2000,
        photos: { public_storage_path: 'path/to/photo.jpg' },
      },
    ]

    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockItems, error: null }),
      }),
    })

    const req = new NextRequest('http://localhost/api/cart')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('items')
    expect(body.items).toHaveLength(1)
  })

  it('returns empty array when no cart items', async () => {
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'empty-session' })

    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })

    const req = new NextRequest('http://localhost/api/cart')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items).toEqual([])
  })
})

describe('POST /api/cart', () => {
  it('adds a photo to the cart', async () => {
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'test-session' })

    const mockPhoto = { id: 'photo1', event_id: 'evt1', status: 'ready' }
    const mockEvent = { id: 'evt1', price_cents: 2000, status: 'published' }
    const mockItem = { id: 'item1', photo_id: 'photo1', price_cents: 2000 }

    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'photos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockPhoto, error: null }),
          }
        }
        if (table === 'events') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockEvent, error: null }),
          }
        }
        if (table === 'cart_items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            insert: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockItem, error: null }),
          }
        }
        return {}
      }),
    })

    const req = new NextRequest('http://localhost/api/cart', {
      method: 'POST',
      body: JSON.stringify({ photoId: 'photo1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toHaveProperty('id')
  })

  it('returns 400 when photoId missing', async () => {
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'test-session' })
    ;(createAdminClient as jest.Mock).mockReturnValue({})

    const req = new NextRequest('http://localhost/api/cart', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when photo not found', async () => {
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'test-session' })

    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'photos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }
        }
        return {}
      }),
    })

    const req = new NextRequest('http://localhost/api/cart', {
      method: 'POST',
      body: JSON.stringify({ photoId: 'nonexistent' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/cart/[photoId]', () => {
  it('removes a photo from the cart', async () => {
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'test-session' })

    // Support chaining: .delete().eq().eq() — last eq resolves
    const deleteChain: Record<string, jest.Mock> = {}
    deleteChain.delete = jest.fn().mockReturnValue(deleteChain)
    deleteChain.eq = jest.fn().mockImplementation(() => {
      // Return a thenable on the second call (simulate final resolution)
      return {
        ...deleteChain,
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
        eq: jest.fn().mockResolvedValue({ error: null }),
      }
    })

    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(deleteChain),
    })

    const req = new NextRequest('http://localhost/api/cart/photo1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ photoId: 'photo1' }) })
    expect(res.status).toBe(204)
  })
})
