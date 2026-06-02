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
  sendEssayReviewLink: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEssayReviewLink } from '@/lib/notifications/email'
import { POST } from '@/app/api/essay-reviews/route'

const mockUser = { id: 'user-1' }
const mockProfile = { tenant_id: 'tenant-1', role: 'photographer', email: 'foto@studio.com', name: 'Studio X' }
const mockEvent = { id: 'event-1', title: 'Ensaio Família', tenant_id: 'tenant-1', type: 'session', slug: 'ensaio-familia' }
const mockTenant = { slug: 'studio-x' }
const mockReview = { id: 'review-1' }

function buildMockAdmin() {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { ...mockProfile }, error: null }),
          upsert: jest.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'events') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockEvent, error: null }),
        }
      }
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockTenant, error: null }),
        }
      }
      if (table === 'essay_reviews') {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockReview, error: null }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null }) }
    }),
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'new-client-1' } }, error: null }),
        generateLink: jest.fn().mockResolvedValue({
          data: { properties: { action_link: 'http://supabase/verify?token=abc' } },
          error: null,
        }),
        listUsers: jest.fn().mockResolvedValue({ data: { users: [] } }),
      },
    },
  }
}

describe('POST /api/essay-reviews', () => {
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

    const req = new NextRequest('http://localhost/api/essay-reviews', {
      method: 'POST',
      body: JSON.stringify({ event_id: 'event-1', client_id: 'client-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates review for existing client and sends email', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews', {
      method: 'POST',
      body: JSON.stringify({ event_id: 'event-1', client_id: 'client-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toHaveProperty('review_id')
    expect(sendEssayReviewLink).toHaveBeenCalled()
  })

  it('creates new client account when client data provided', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews', {
      method: 'POST',
      body: JSON.stringify({
        event_id: 'event-1',
        client: { name: 'João Silva', email: 'joao@email.com', cpf: '123.456.789-00' },
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 when neither client_id nor client provided', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews', {
      method: 'POST',
      body: JSON.stringify({ event_id: 'event-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
