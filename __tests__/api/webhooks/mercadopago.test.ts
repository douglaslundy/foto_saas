/**
 * @jest-environment node
 */

jest.mock('@/lib/payments/mercadopago', () => ({ verifyMercadoPagoWebhook: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Payment: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue({
      id: 'mp_456',
      status: 'approved',
      external_reference: 'order123',
    }),
  })),
}))

import { NextRequest } from 'next/server'
import { verifyMercadoPagoWebhook } from '@/lib/payments/mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/webhooks/mercadopago/route'

function buildAdminClient() {
  const chain: Record<string, jest.Mock> = {}
  chain.from = jest.fn().mockReturnValue(chain)
  chain.update = jest.fn().mockReturnThis()
  chain.eq = jest.fn().mockResolvedValue({ error: null })
  return chain
}

describe('POST /api/webhooks/mercadopago', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 200 when signature verification fails (avoid MP retries)', async () => {
    ;(verifyMercadoPagoWebhook as jest.Mock).mockReturnValue(false)

    const req = new NextRequest('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ type: 'payment', data: { id: '123' } }),
      headers: { 'Content-Type': 'application/json', 'x-signature': 'bad-sig' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('marks order as paid when payment is approved', async () => {
    ;(verifyMercadoPagoWebhook as jest.Mock).mockReturnValue(true)
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())

    const payload = JSON.stringify({
      type: 'payment',
      data: { id: 'mp_456' },
    })

    const req = new NextRequest('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        'x-signature': 'valid-sig',
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })
})
