/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidateTag: jest.fn() }))

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/admin/platform/favicon/route'

function buildMockAdmin() {
  return {
    from: jest.fn().mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: { path: 'favicon/global.png' }, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'http://storage/favicon/global.png' } }),
      }),
    },
  }
}

describe('POST /api/admin/platform/favicon', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
    })
  })

  it('returns 401 when not authenticated', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    })
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())
    const req = new NextRequest('http://localhost/api/admin/platform/favicon', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when no file or url provided', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      ...buildMockAdmin(),
      from: jest.fn().mockImplementation((t: string) => {
        if (t === 'users') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }) }
        return { upsert: jest.fn().mockResolvedValue({ error: null }) }
      }),
    })
    const req = new NextRequest('http://localhost/api/admin/platform/favicon', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('saves URL directly when url provided in JSON body', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      ...buildMockAdmin(),
      from: jest.fn().mockImplementation((t: string) => {
        if (t === 'users') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }) }
        return { upsert: jest.fn().mockResolvedValue({ error: null }) }
      }),
    })
    const req = new NextRequest('http://localhost/api/admin/platform/favicon', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/icon.png' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.url).toBe('https://example.com/icon.png')
  })
})
