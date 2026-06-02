/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/notifications/email', () => ({
  sendRegistrationNotification: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/auth/register/route'

const validBody = {
  name: 'João Silva',
  email: 'joao@studio.com',
  password: '12345678',
  phone: '11999999999',
  cpf_cnpj: '123.456.789-00',
  studio_name: 'Studio Silva',
  city: 'São Paulo',
}

function buildMockAdmin() {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          insert: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'tenant-id', name: 'Studio Silva', slug: 'studio-silva' } }),
        }
      }
      return {
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null }),
      }
    }),
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'new-user-id' } },
          error: null,
        }),
      },
    },
  }
}

describe('POST /api/auth/register', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when required fields are missing', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is too short', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...validBody, password: '123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 201 on successful registration', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
