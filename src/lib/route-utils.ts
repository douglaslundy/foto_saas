// src/lib/route-utils.ts
export type RouteType = 'admin' | 'dashboard' | 'auth' | 'tenant' | 'root'

export function getRouteType(pathname: string, tenantSlug: string | null): RouteType {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname === '/login' || pathname.startsWith('/esqueci-minha-senha')) return 'auth'
  if (tenantSlug) return 'tenant'
  return 'root'
}
