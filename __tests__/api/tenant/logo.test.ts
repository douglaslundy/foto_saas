/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { POST } from '@/app/api/tenant/logo/route'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeFile(name = 'logo.png', type = 'image/png', sizeBytes = 1024): File {
  const buffer = new Uint8Array(sizeBytes)
  return new File([buffer], name, { type })
}

function makeFormData(file: File | null): FormData {
  const fd = new FormData()
  if (file) fd.append('file', file)
  return fd
}

function buildStorageMock(uploadResult: { error: { message: string } | null } = { error: null }) {
  return {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockResolvedValue(uploadResult),
    }),
  }
}

function buildDbMock(overrides: {
  profile?: { tenant_id: string; role: string } | null
  profileError?: { message: string } | null
  updateError?: { message: string } | null
} = {}) {
  const profile = overrides.profile !== undefined
    ? overrides.profile
    : { tenant_id: 'tenant-abc', role: 'photographer' }
  const profileError = overrides.profileError ?? null
  const updateError = overrides.updateError ?? null

  const usersChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: profile, error: profileError }),
  }

  const tenantsChain = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: updateError }),
  }

  return jest.fn().mockImplementation((table: string) => {
    if (table === 'users') return usersChain
    if (table === 'tenants') return tenantsChain
    return tenantsChain
  })
}

function setupMocks(overrides: {
  user?: { id: string } | null
  profile?: { tenant_id: string; role: string } | null
  profileError?: { message: string } | null
  uploadError?: { message: string } | null
  updateError?: { message: string } | null
} = {}) {
  const user = overrides.user !== undefined ? overrides.user : { id: 'user-1' }

  ;(createClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
  })

  const fromDb = buildDbMock({
    profile: overrides.profile,
    profileError: overrides.profileError,
    updateError: overrides.updateError,
  })

  const storageMock = buildStorageMock(
    overrides.uploadError ? { error: overrides.uploadError } : { error: null }
  )

  ;(createAdminClient as jest.Mock).mockReturnValue({
    from: fromDb,
    storage: storageMock,
  })

  return { fromDb, storageMock }
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('POST /api/tenant/logo', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    setupMocks({ user: null })

    const fd = makeFormData(makeFile())
    const req = new NextRequest('http://localhost/api/tenant/logo', {
      method: 'POST',
      body: fd,
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when no file provided (message contains "arquivo")', async () => {
    setupMocks()

    const fd = makeFormData(null)
    const req = new NextRequest('http://localhost/api/tenant/logo', {
      method: 'POST',
      body: fd,
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.toLowerCase()).toContain('arquivo')
  })

  it('returns 400 for unsupported file type (message contains "formato")', async () => {
    setupMocks()

    const file = makeFile('logo.gif', 'image/gif')
    const fd = makeFormData(file)
    const req = new NextRequest('http://localhost/api/tenant/logo', {
      method: 'POST',
      body: fd,
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.toLowerCase()).toContain('formato')
  })

  it('returns 200 with logoUrl containing logos/{tenantId} on success', async () => {
    const { storageMock } = setupMocks()

    const file = makeFile('logo.png', 'image/png')
    const fd = makeFormData(file)
    const req = new NextRequest('http://localhost/api/tenant/logo', {
      method: 'POST',
      body: fd,
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.logoUrl).toContain('logos/tenant-abc')
    // Verify storage upload was called
    expect(storageMock.from).toHaveBeenCalledWith('photos-public')
    expect(storageMock.from('photos-public').upload).toHaveBeenCalledWith(
      'logos/tenant-abc/logo.png',
      expect.any(Buffer),
      expect.objectContaining({ upsert: true, contentType: 'image/png' })
    )
  })
})
