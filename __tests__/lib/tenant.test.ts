import { extractTenantSlug, isCustomDomain } from '@/lib/tenant'

describe('extractTenantSlug', () => {
  const rootDomain = 'fotosaas.com.br'

  it('extracts slug from subdomain', () => {
    expect(extractTenantSlug('joaosilva.fotosaas.com.br', rootDomain))
      .toBe('joaosilva')
  })

  it('returns null for root domain', () => {
    expect(extractTenantSlug('fotosaas.com.br', rootDomain)).toBeNull()
  })

  it('returns null for www subdomain', () => {
    expect(extractTenantSlug('www.fotosaas.com.br', rootDomain)).toBeNull()
  })

  it('returns null for admin subdomain', () => {
    expect(extractTenantSlug('admin.fotosaas.com.br', rootDomain)).toBeNull()
  })

  it('returns null for custom domain (not a subdomain of root)', () => {
    expect(extractTenantSlug('www.joaosilva.com.br', rootDomain)).toBeNull()
  })

  it('extracts slug from localhost subdomain in development', () => {
    expect(extractTenantSlug('joaosilva.localhost:3000', 'localhost:3000'))
      .toBe('joaosilva')
  })

  it('returns null for plain localhost', () => {
    expect(extractTenantSlug('localhost:3000', 'localhost:3000')).toBeNull()
  })
})

describe('isCustomDomain', () => {
  const rootDomain = 'fotosaas.com.br'

  it('returns true for a custom domain', () => {
    expect(isCustomDomain('www.joaosilva.com.br', rootDomain)).toBe(true)
  })

  it('returns false for root domain', () => {
    expect(isCustomDomain('fotosaas.com.br', rootDomain)).toBe(false)
  })

  it('returns false for subdomain of root', () => {
    expect(isCustomDomain('joaosilva.fotosaas.com.br', rootDomain)).toBe(false)
  })
})
