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
  const query = adminClient.from('tenants').select('id, name, slug, status, bio')
  const { data: tenant } = customDomain
    ? await query.eq('custom_domain', customDomain).single()
    : await query.eq('slug', slug).single()

  if (!tenant || (tenant as { status: string }).status !== 'active') notFound()

  const tenantData = tenant as { id: string; slug: string; name: string; bio: string | null }

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

  const tenantName = tenantData.name

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Hero section */}
      <div
        className="relative min-h-[380px] flex flex-col justify-between overflow-hidden"
        style={{
          background: '#0d0f14',
          backgroundImage:
            'radial-gradient(ellipse 60% 50% at 30% 20%, rgba(200,169,110,0.15), transparent)',
        }}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          {/* Logo/avatar do tenant */}
          <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center mb-6 text-3xl font-bold text-white">
            {tenantName?.[0]?.toUpperCase() || '📷'}
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">{tenantName}</h1>
          {tenantData.bio && (
            <p className="text-white/60 text-base max-w-md">{tenantData.bio}</p>
          )}
        </div>
      </div>

      {/* Eventos e Ensaios */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-6">Eventos e Ensaios</h2>

        <EventsSearchGrid events={events ?? []} tenantSlug={tenantData.slug} />
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-8 text-center">
        <p className="text-xs text-[var(--color-ink-muted)]">
          © {new Date().getFullYear()} {tenantName} — powered by FotoSaaS
        </p>
      </footer>
    </div>
  )
}
