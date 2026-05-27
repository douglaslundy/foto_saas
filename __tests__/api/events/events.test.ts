/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed'), compare: jest.fn() }))

import { POST, GET } from '@/app/api/events/route'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── helpers ────────────────────────────────────────────────────────────────

const mockEvent = {
  id: 'event-1',
  tenant_id: 'tenant-1',
  title: 'Corrida SP',
  slug: 'corrida-sp',
  type: 'event',
  status: 'draft',
  price_cents: 0,
  is_public: true,
  facial_recognition_enabled: false,
  event_date: null,
  created_at: '2026-01-01T00:00:00Z',
}

function createMockChain(terminals: {
  single?: unknown
  maybeSingle?: unknown
  range?: unknown
  direct?: unknown
} = {}) {
  const directValue = terminals.direct ?? { data: null, error: null }
  const chain: Record<string, unknown> = {}
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'order', 'limit', 'offset', 'or', 'not',
    'lte', 'gte', 'filter', 'in', 'is',
  ]
  chainMethods.forEach((m) => {
    chain[m] = jest.fn().mockReturnThis()
  })
  chain['single'] = jest.fn().mockResolvedValue(terminals.single ?? { data: null, error: null })
  chain['maybeSingle'] = jest.fn().mockResolvedValue(terminals.maybeSingle ?? { data: null, error: null })
  chain['range'] = jest.fn().mockResolvedValue(terminals.range ?? { data: [], count: 0, error: null })
  // thenable for direct `await adminClient.from(...).delete().eq(...)` patterns
  chain['then'] = jest.fn().mockImplementation(
    (resolve: (v: unknown) => unknown) => Promise.resolve(directValue).then(resolve),
  )
  return chain
}

function setupAuthMocks(overrides: {
  profile?: unknown
  event?: unknown
  duplicateSlug?: unknown
  eventsList?: unknown[]
  eventsCount?: number
} = {}) {
  const authUser = { id: 'user-1' }
  const mockSupabase = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: authUser } }) },
  }
  ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

  const usersChain = createMockChain({
    single: { data: overrides.profile ?? { tenant_id: 'tenant-1', role: 'photographer' }, error: null },
  })
  const eventsChain = createMockChain({
    maybeSingle: { data: overrides.duplicateSlug ?? null, error: null },
    single: { data: overrides.event ?? mockEvent, error: null },
    range: {
      data: overrides.eventsList ?? [mockEvent],
      count: overrides.eventsCount ?? 1,
      error: null,
    },
  })

  ;(createAdminClient as jest.Mock).mockReturnValue({
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'users') return usersChain
      return eventsChain
    }),
  })
}

// ─── GET /api/events ─────────────────────────────────────────────────────────

describe('GET /api/events', () => {
  it('returns only events for the authenticated tenant', async () => {
    setupAuthMocks({ eventsList: [mockEvent], eventsCount: 1 })

    const req = new NextRequest('http://localhost/api/events')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.events).toHaveLength(1)
    expect(body.events[0].id).toBe('event-1')
    expect(body.total).toBe(1)
  })

  it('returns 401 when not authenticated', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const req = new NextRequest('http://localhost/api/events')
    const res = await GET(req)

    expect(res.status).toBe(401)
  })
})

// ─── POST /api/events ────────────────────────────────────────────────────────

describe('POST /api/events', () => {
  it('creates event and returns 201', async () => {
    setupAuthMocks()

    const req = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Corrida SP',
        slug: 'corrida-sp',
        type: 'event',
        price_cents: 0,
        is_public: true,
        facial_recognition_enabled: false,
      }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe('event-1')
    expect(body.status).toBe('draft')
  })

  it('returns 409 for duplicate slug within tenant', async () => {
    setupAuthMocks({ duplicateSlug: { id: 'other-event' } })

    const req = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Corrida SP',
        slug: 'corrida-sp',
        type: 'event',
        price_cents: 0,
        is_public: true,
        facial_recognition_enabled: false,
      }),
    })
    const res = await POST(req)

    expect(res.status).toBe(409)
  })
})
