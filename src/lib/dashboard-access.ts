export type DashboardProfile = {
  role?: string | null
  tenant_id?: string | null
} | null

export function getDashboardFallbackPath(profile: DashboardProfile): string {
  if (profile?.role === 'admin') {
    return '/admin'
  }

  if (profile?.role === 'photographer' && !profile.tenant_id) {
    return '/conta-em-analise'
  }

  return '/dashboard'
}

