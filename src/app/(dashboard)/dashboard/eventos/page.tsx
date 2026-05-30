import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Eventos e Ensaios</h1>
        <Button asChild>
          <Link href="/dashboard/eventos/novo">+ Novo Evento</Link>
        </Button>
      </div>

      {!events || events.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhum evento criado ainda.{' '}
          <Link href="/dashboard/eventos/novo" className="underline">
            Crie o primeiro.
          </Link>
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} tenantSlug={tenantRow?.slug} />
          ))}
        </div>
      )}
    </div>
  )
}
