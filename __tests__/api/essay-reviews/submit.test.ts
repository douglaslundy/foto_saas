/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/notifications/email', () => ({
  sendEssaySubmitted: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/payments/stripe', () => ({
  createStripePaymentIntent: jest.fn().mockResolvedValue({
    paymentIntentId: 'pi_test',
    clientSecret: 'pi_test_secret',
  }),
}))

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/essay-reviews/[id]/submit/route'

const mockUser = { id: 'client-1' }
const mockReview = {
  id: 'review-1',
  event_id: 'event-1',
  client_id: 'client-1',
  tenant_id: 'tenant-1',
  status: 'pending_selection',
  magic_link_expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
}

function buildMockAdmin() {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'essay_reviews') {
        return {
          select: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockReview, error: null }),
        }
      }
      if (table === 'events') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'event-1', title: 'Ensaio', price_cents: 2000, tenant_id: 'tenant-1' },
            error: null,
          }),
        }
      }
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { email: 'foto@studio.com', name: 'Fotógrafo' },
            error: null,
          }),
        }
      }
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { slug: 'studio-x' },
            error: null,
          }),
        }
      }
      if (table === 'photo_packages') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null }) }
    }),
  }
}

describe('POST /api/essay-reviews/[id]/submit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser } }) },
    })
  })

  it('returns 401 when not authenticated', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    })
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews/review-1/submit', {
      method: 'POST',
      body: JSON.stringify({ selected_photo_ids: ['p1', 'p2'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'review-1' }) })
    expect(res.status).toBe(401)
  })

  it('submits selection with manual payment', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews/review-1/submit', {
      method: 'POST',
      body: JSON.stringify({
        selected_photo_ids: ['p1', 'p2', 'p3'],
        notes: 'Prefiro as 3 primeiras',
        payment_method: 'manual',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'review-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.payment_method).toBe('manual')
  })

  it('returns 400 when selected_photo_ids is empty', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews/review-1/submit', {
      method: 'POST',
      body: JSON.stringify({ selected_photo_ids: [] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'review-1' }) })
    expect(res.status).toBe(400)
  })
})
