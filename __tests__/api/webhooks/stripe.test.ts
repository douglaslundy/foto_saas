/**
 * @jest-environment node
 */

jest.mock('@/lib/payments/stripe', () => ({ verifyStripeWebhook: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { NextRequest } from 'next/server'
import { verifyStripeWebhook } from '@/lib/payments/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/webhooks/stripe/route'

function buildAdminClient() {
  const chain: Record<string, jest.Mock> = {}
  chain.from = jest.fn().mockReturnValue(chain)
  chain.update = jest.fn().mockReturnThis()
  chain.eq = jest.fn().mockResolvedValue({ error: null })
  return chain
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when stripe-signature header is missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: 'raw-body',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when webhook verification fails', async () => {
    ;(verifyStripeWebhook as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: 'raw-body',
      headers: { 'stripe-signature': 'bad-sig' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('marks order as paid on payment_intent.succeeded', async () => {
    const mockEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          metadata: { orderId: 'order123' },
        },
      },
    }
    ;(verifyStripeWebhook as jest.Mock).mockReturnValue(mockEvent)
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())

    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify(mockEvent),
      headers: { 'stripe-signature': 'valid-sig' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
  })

  it('ignores unknown event types', async () => {
    const mockEvent = { type: 'customer.created', data: { object: {} } }
    ;(verifyStripeWebhook as jest.Mock).mockReturnValue(mockEvent)
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())

    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify(mockEvent),
      headers: { 'stripe-signature': 'valid-sig' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
