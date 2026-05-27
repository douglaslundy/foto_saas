import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { EventsSearchGrid } from './_components/events-search-grid'

type Props = { params: Promise<{ tenant: string }> }

export default async function TenantHomePage({ params }: Props) {
  const { tenant: slug } = await params
  const headersList = await headers()
  const customDomain = headersList.get('x-custom-domain')

  const adminClient = createAdminClient()

  // Resolve tenant
  const query = adminClient.from('tenants').select('id, name, slug, status')
  const { data: tenant } = customDomain
    ? await query.eq('custom_domain', customDomain).single()
    : await query.eq('slug', slug).single()

  if (!tenant || (tenant as { status: string }).status !== 'active') notFound()

  const tenantData = tenant as { id: string; slug: string }

  // Fetch published events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events } = (await (adminClient as any)
    .from('events')
    .select('id, title, slug, type, event_date, created_at')
    .eq('tenant_id', tenantData.id)
    .eq('status', 'published')
    .order('event_date', { ascending: false })
    .range(0, 49)) as {
    data: {
      id: string
      title: string
      slug: string
      type: 'event' | 'session'
      event_date: string | null
      created_at: string
    }[] | null
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Eventos e Ensaios</h1>
      <EventsSearchGrid events={events ?? []} tenantSlug={tenantData.slug} />
    </div>
  )
}
