import { getRouteType } from '@/lib/route-utils'

describe('getRouteType — /auth paths', () => {
  it('classifies /auth/callback as auth route', () => {
    expect(getRouteType('/auth/callback', null)).toBe('auth')
  })

  it('classifies /auth/callback with tenant slug as auth (not tenant)', () => {
    expect(getRouteType('/auth/callback', 'my-studio')).toBe('auth')
  })

  it('classifies /auth/error as auth route', () => {
    expect(getRouteType('/auth/error', null)).toBe('auth')
  })
})
