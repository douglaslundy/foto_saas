// src/lib/tenant.ts

const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'api', 'app', 'dashboard'])

/**
 * Extracts tenant slug from hostname.
 * Returns null if not a valid tenant subdomain.
 */
export function extractTenantSlug(
  hostname: string,
  rootDomain: string
): string | null {
  const host = hostname.split(':')[0]
  const root = rootDomain.split(':')[0]

  if (!host.endsWith(`.${root}`)) return null

  const subdomain = host.slice(0, host.length - root.length - 1)

  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return null

  return subdomain
}

/**
 * Returns true if hostname is a custom domain (not a subdomain of rootDomain).
 */
export function isCustomDomain(hostname: string, rootDomain: string): boolean {
  const host = hostname.split(':')[0]
  const root = rootDomain.split(':')[0]
  return host !== root && !host.endsWith(`.${root}`)
}
