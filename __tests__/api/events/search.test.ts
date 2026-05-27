/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { POST } from '@/app/api/events/[id]/search/route'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockPublishedEvent = {
  id: 'event-1',
  tenant_id: 'tenant-1',
  status: 'published',
  facial_recognition_enabled: true,
}

function createMockChain(single: unknown = { data: null, error: null }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'order', 'limit']
  methods.forEach((m) => { chain[m] = jest.fn().mockReturnThis() })
  chain['single'] = jest.fn().mockResolvedValue(single)
  chain['maybeSingle'] = jest.fn().mockResolvedValue({ data: null, error: null })
  chain['range'] = jest.fn().mockResolvedValue({ data: [], count: 0, error: null })
  chain['then'] = jest.fn().mockImplementation(
    (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
  )
  return chain
}

function setupEventMock(eventData: unknown) {
  ;(createAdminClient as jest.Mock).mockReturnValue({
    from: jest.fn().mockImplementation(() =>
      createMockChain({ data: eventData, error: eventData ? null : { message: 'Not found' } })
    ),
  })
}

function makeSelfieRequest(eventId = 'event-1') {
  const formData = new FormData()
  formData.append('selfie', new Blob(['fake-image'], { type: 'image/jpeg' }), 'selfie.jpg')
  return new NextRequest(`http://localhost/api/events/${eventId}/search`, {
    method: 'POST',
    body: formData,
  })
}

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  setupEventMock(mockPublishedEvent)
})

describe('POST /api/events/[id]/search', () => {
  it('returns photo_ids when face-service responds successfully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ photo_ids: ['p1', 'p2'], count: 2 }),
    })

    const res = await POST(makeSelfieRequest(), { params: Promise.resolve({ id: 'event-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.photo_ids).toEqual(['p1', 'p2'])
    expect(body.count).toBe(2)
  })

  it('returns 422 when face-service detects no face', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'No face detected' }),
    })

    const res = await POST(makeSelfieRequest(), { params: Promise.resolve({ id: 'event-1' }) })

    expect(res.status).toBe(422)
  })

  it('returns 502 when face-service is unavailable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

    const res = await POST(makeSelfieRequest(), { params: Promise.resolve({ id: 'event-1' }) })

    expect(res.status).toBe(502)
  })

  it('returns 404 for non-existent event', async () => {
    setupEventMock(null)

    const res = await POST(makeSelfieRequest(), { params: Promise.resolve({ id: 'bad-id' }) })

    expect(res.status).toBe(404)
  })

  it('does not call storage — selfie is not persisted', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ photo_ids: [], count: 0 }),
    })

    // Verify only one fetch call was made (the face-service proxy) — no storage upload
    await POST(makeSelfieRequest(), { params: Promise.resolve({ id: 'event-1' }) })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toContain('/search')
  })
})
