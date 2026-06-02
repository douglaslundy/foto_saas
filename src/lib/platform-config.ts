// src/lib/platform-config.ts
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const getPlatformConfig = unstable_cache(
  async (): Promise<{ platformName: string; faviconUrl: string | null }> => {
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (admin as any)
      .from('system_settings')
      .select('key, value')
      .in('key', ['platform_name', 'platform_favicon_url']) as
      { data: { key: string; value: string | null }[] | null }

    const map: Record<string, string> = {}
    for (const row of rows ?? []) {
      if (row.value) map[row.key] = row.value
    }

    return {
      platformName: map['platform_name']?.trim() || 'FotoSaaS',
      faviconUrl: map['platform_favicon_url'] || null,
    }
  },
  ['platform-config'],
  { revalidate: 60, tags: ['platform-config'] }
)

export async function getTenantFavicon(tenantSlug: string): Promise<string | null> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('tenants')
    .select('favicon_url')
    .eq('slug', tenantSlug)
    .single() as { data: { favicon_url: string | null } | null }
  return data?.favicon_url ?? null
}
