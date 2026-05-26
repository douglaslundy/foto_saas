describe('env', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns NEXT_PUBLIC_SUPABASE_URL when set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000'

    const { env } = await import('@/lib/env')
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co')
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    await expect(import('@/lib/env')).rejects.toThrow()
  })
})
