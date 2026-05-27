/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/delivery', () => ({ generateDownloadUrls: jest.fn() }))

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDownloadUrls } from '@/lib/delivery'
import { GET as getOrder } from '@/app/api/orders/[id]/route'
import { GET as getDownload } from '@/app/api/orders/[id]/download/route'

const mockOrder = {
  id: 'order123',
  status: 'paid',
  client_email: 'test@test.com',
  total_cents: 4000,
  payment_method: 'stripe',
  created_at: '2026-01-01T00:00:00Z',
}

const mockOrderItems = [
  { id: 'oi1', photo_id: 'p1', event_id: 'e1', price_cents: 2000 },
]

function buildAdminClient(
  order: typeof mockOrder | { status: string } = mockOrder,
  orderItems = mockOrderItems
) {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: order,
            error: order ? null : { message: 'not found' },
          }),
        }
      }
      if (table === 'order_items') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: orderItems, error: null }),
        }
      }
      return {}
    }),
  }
}

describe('GET /api/orders/[id]', () => {
  it('returns order details for a paid order', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())
    const req = new NextRequest('http://localhost/api/orders/order123')
    const res = await getOrder(req, { params: Promise.resolve({ id: 'order123' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe('order123')
    expect(body.status).toBe('paid')
  })

  it('returns 404 when order not found', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      }),
    })
    const req = new NextRequest('http://localhost/api/orders/nonexistent')
    const res = await getOrder(req, { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/orders/[id]/download', () => {
  it('returns 403 when order is not paid', async () => {
    const unpaidOrder = { ...mockOrder, status: 'pending' }
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient(unpaidOrder))

    const req = new NextRequest('http://localhost/api/orders/order123/download')
    const res = await getDownload(req, { params: Promise.resolve({ id: 'order123' }) })
    expect(res.status).toBe(403)
  })

  it('returns signed download URLs for paid order', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())
    ;(generateDownloadUrls as jest.Mock).mockResolvedValue([
      {
        photoId: 'p1',
        url: 'https://storage.example.com/signed-url',
        expiresAt: '2026-01-02T00:00:00Z',
      },
    ])

    const req = new NextRequest('http://localhost/api/orders/order123/download')
    const res = await getDownload(req, { params: Promise.resolve({ id: 'order123' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.downloads).toHaveLength(1)
    expect(body.downloads[0].url).toContain('signed-url')
  })
})
