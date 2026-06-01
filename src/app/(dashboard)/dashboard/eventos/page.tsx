import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EventCard } from '@/components/events/event-card'

type EventItem = {
  id: string
  title: string
  slug: string
  type: 'event' | 'session'
  event_date: string | null
  status: string
}

export default async function EventosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = (await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()) as { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    redirect('/login')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow } = (await (adminClient as any)
    .from('tenants')
    .select('slug')
    .eq('id', profile.tenant_id)
    .single()) as { data: { slug: string } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events } = (await (adminClient as any)
    .from('events')
    .select('id, title, slug, type, event_date, status')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .range(0, 49)) as { data: EventItem[] | null }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Eventos e Ensaios
          </h1>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1">
            Gerencie seus eventos e ensaios fotográficos
          </p>
        </div>
        <Link
          href="/dashboard/eventos/novo"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
        >
          <span>+</span> Novo Evento
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!events || events.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <svg
              className="mx-auto mb-4 opacity-30"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p className="font-display text-xl font-semibold text-[var(--color-ink)] mt-4">
              Nenhum evento ainda.
            </p>
            <p className="text-[var(--color-ink-muted)] text-sm mt-2">
              Crie seu primeiro evento para começar.
            </p>
            <Link
              href="/dashboard/eventos/novo"
              className="inline-flex mt-4 px-5 py-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-sm font-medium hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              + Criar Evento
            </Link>
          </div>
        ) : (
          events.map((event) => (
            <EventCard key={event.id} event={event} tenantSlug={tenantRow?.slug} />
          ))
        )}
      </div>
    </div>
  )
}
