// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { extractTenantSlug, isCustomDomain } from '@/lib/tenant'
import { getRouteType } from '@/lib/route-utils'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const { pathname } = request.nextUrl

  // Skip assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const tenantSlug = extractTenantSlug(hostname, ROOT_DOMAIN)
  const customDomain = isCustomDomain(hostname, ROOT_DOMAIN) ? hostname : null

  const routeType = getRouteType(pathname, tenantSlug ?? customDomain)

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes
  if ((routeType === 'admin' || routeType === 'dashboard') && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (routeType === 'auth' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Rewrite tenant hostname to /[tenant] route segment
  if (routeType === 'tenant') {
    const slug = tenantSlug ?? '__custom__'
    const url = request.nextUrl.clone()
    url.pathname = `/${slug}${pathname}`
    response = NextResponse.rewrite(url)
  }

  // Pass tenant info to layouts via headers
  if (tenantSlug) {
    response.headers.set('x-tenant-slug', tenantSlug)
  }
  if (customDomain) {
    response.headers.set('x-custom-domain', customDomain)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
