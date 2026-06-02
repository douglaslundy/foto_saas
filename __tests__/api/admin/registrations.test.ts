/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/notifications/email', () => ({
  sendRegistrationApproved: jest.fn().mockResolvedValue(undefined),
  sendRegistrationRejected: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET } from '@/app/api/admin/registrations/route'
import { PATCH as approve } from '@/app/api/admin/registrations/[tenantId]/approve/route'
import { PATCH as reject } from '@/app/api/admin/registrations/[tenantId]/reject/route'

const adminUser = { id: 'admin-1' }
const adminProfile = { role: 'admin', tenant_id: null }

function buildMock() {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: adminProfile }),
        }
      }
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'tenant-1', name: 'Studio X', status: 'pending' },
          }),
        }
      }
      if (table === 'tenant_registrations') {
        return {
          select: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { phone: '11999', cpf_cnpj: '123', city: 'SP' } }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: [], error: null }), single: jest.fn().mockResolvedValue({ data: null }) }
    }),
  }
}

describe('GET /api/admin/registrations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: adminUser } }) },
    })
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMock())
  })

  it('returns 401 when not authenticated', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    })
    const req = new NextRequest('http://localhost/api/admin/registrations')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { role: 'photographer' } }),
      }),
    })
    const req = new NextRequest('http://localhost/api/admin/registrations')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/admin/registrations/[tenantId]/approve', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: adminUser } }) },
    })
  })

  it('returns 200 and approves tenant', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMock())
    const req = new NextRequest('http://localhost/api/admin/registrations/tenant-1/approve', {
      method: 'PATCH',
    })
    const res = await approve(req, { params: Promise.resolve({ tenantId: 'tenant-1' }) })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/admin/registrations/[tenantId]/reject', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: adminUser } }) },
    })
  })

  it('returns 200 and rejects tenant', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMock())
    const req = new NextRequest('http://localhost/api/admin/registrations/tenant-1/reject', {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'Dados incompletos.' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await reject(req, { params: Promise.resolve({ tenantId: 'tenant-1' }) })
    expect(res.status).toBe(200)
  })
})
