import { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function sitemap({ params }: { params: { tenant: string } }): Promise<MetadataRoute.Sitemap> {
  const { tenant } = await Promise.resolve(params)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const admin = createAdminClient()

  // Get tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow } = await (admin as any)
    .from('tenants')
    .select('id')
    .eq('slug', tenant)
    .single()

  if (!tenantRow) return []

  // Get published events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events } = await (admin as any)
    .from('events')
    .select('slug, created_at, type')
    .eq('tenant_id', tenantRow.id)
    .eq('status', 'published')

  const base = [
    {
      url: `${appUrl}/${tenant}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
  ]

  const eventUrls = (events ?? []).map((e: { slug: string; created_at: string; type: string }) => ({
    url: `${appUrl}/${tenant}/${e.type === 'ensaio' ? 'ensaio' : 'evento'}/${e.slug}`,
    lastModified: new Date(e.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...base, ...eventUrls]
}
