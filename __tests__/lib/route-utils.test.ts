import { getRouteType } from '@/lib/route-utils'

describe('getRouteType', () => {
  it('identifies admin routes', () => {
    expect(getRouteType('/admin', null)).toBe('admin')
    expect(getRouteType('/admin/fotografos', null)).toBe('admin')
  })

  it('identifies dashboard routes', () => {
    expect(getRouteType('/dashboard', null)).toBe('dashboard')
    expect(getRouteType('/dashboard/eventos', null)).toBe('dashboard')
  })

  it('identifies auth routes', () => {
    expect(getRouteType('/login', null)).toBe('auth')
    expect(getRouteType('/esqueci-minha-senha', null)).toBe('auth')
  })

  it('identifies tenant public site when slug present', () => {
    expect(getRouteType('/', 'joaosilva')).toBe('tenant')
    expect(getRouteType('/evento/festa-2026', 'joaosilva')).toBe('tenant')
  })

  it('identifies root when no slug and not a named route', () => {
    expect(getRouteType('/', null)).toBe('root')
  })
})
