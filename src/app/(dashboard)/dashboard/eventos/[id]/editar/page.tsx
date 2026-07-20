import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { EventForm } from '@/components/events/event-form'
import { getDashboardFallbackPath } from '@/lib/dashboard-access'

type Props = { params: Promise<{ id: string }> }

export default async function EditarEventoPage({ params }: Props) {
  const { id } = await params

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
    redirect(getDashboardFallbackPath(profile as { role?: string | null; tenant_id?: string | null } | null))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = (await (adminClient as any)
    .from('events')
    .select('id, title, slug, type, event_date, description, is_public, price_cents, facial_recognition_enabled, session_price_cents, included_photo_count, extra_photo_price_cents')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()) as {
    data: {
      id: string
      title: string
      slug: string
      type: 'event' | 'session'
      event_date: string | null
      description: string | null
      is_public: boolean
      price_cents: number
      facial_recognition_enabled: boolean
      session_price_cents: number
      included_photo_count: number
      extra_photo_price_cents: number
    } | null
  }

  if (!event) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Editar Evento
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">
          Atualize os dados do evento ou ensaio
        </p>
      </div>
      <EventForm
        mode="edit"
        defaultValues={{
          id: event.id,
          title: event.title,
          slug: event.slug,
          type: event.type,
          event_date: event.event_date ?? undefined,
          description: event.description ?? undefined,
          is_public: event.is_public,
          price_cents: event.price_cents,
          facial_recognition_enabled: event.facial_recognition_enabled,
          session_price_cents: event.session_price_cents,
          included_photo_count: event.included_photo_count,
          extra_photo_price_cents: event.extra_photo_price_cents,
        }}
      />
    </div>
  )
}
