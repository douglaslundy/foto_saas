/**
 * @jest-environment node
 */

jest.mock('next/headers', () => ({ cookies: jest.fn() }))
jest.mock('@/lib/cart-session', () => ({
  getOrCreateCartSession: jest.fn(),
  CART_COOKIE_NAME: 'cart_session',
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/payments/stripe', () => ({ createStripePaymentIntent: jest.fn() }))
jest.mock('@/lib/payments/mercadopago', () => ({ createMercadoPagoPix: jest.fn() }))

import { NextRequest } from 'next/server'
import { getOrCreateCartSession } from '@/lib/cart-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { createStripePaymentIntent } from '@/lib/payments/stripe'
import { createMercadoPagoPix } from '@/lib/payments/mercadopago'
import { POST } from '@/app/api/checkout/route'

const mockCartItems = [
  { id: 'ci1', photo_id: 'p1', event_id: 'e1', price_cents: 2000 },
  { id: 'ci2', photo_id: 'p2', event_id: 'e1', price_cents: 2000 },
]

function buildAdminClient(cartItems = mockCartItems) {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'cart_items') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: cartItems, error: null }),
        }
      }
      if (table === 'orders') {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'order123', total_cents: 4000 },
            error: null,
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'order_items') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        }
      }
      return {}
    }),
  }
}

describe('POST /api/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'sess1' })
  })

  it('returns 400 when paymentMethod is missing', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())
    const req = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())
    const req = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'stripe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when cart is empty', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient([]))
    const req = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'stripe', email: 'test@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates Stripe checkout and returns clientSecret', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())
    ;(createStripePaymentIntent as jest.Mock).mockResolvedValue({
      paymentIntentId: 'pi_123',
      clientSecret: 'pi_123_secret',
    })

    const req = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'stripe', email: 'test@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.orderId).toBe('order123')
    expect(body.clientSecret).toBe('pi_123_secret')
    expect(body.paymentMethod).toBe('stripe')
  })

  it('creates MercadoPago PIX checkout and returns pixQrCode', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())
    ;(createMercadoPagoPix as jest.Mock).mockResolvedValue({
      pixQrCode: '00020126...',
      pixQrCodeBase64: 'base64==',
      paymentId: 'mp_456',
    })

    const req = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'pix', email: 'test@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.orderId).toBe('order123')
    expect(body.pixQrCode).toBe('00020126...')
    expect(body.paymentMethod).toBe('pix')
  })
})
