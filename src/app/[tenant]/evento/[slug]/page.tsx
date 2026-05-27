import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { PasswordGate } from '@/components/events/password-gate'
import { PhotoGrid, type Photo } from './_components/photo-grid'
import { EventoPageClient } from './_components/evento-page-client'

type Props = { params: Promise<{ tenant: string; slug: string }> }

type EventRow = {
  id: string
  title: string
  slug: string
  description: string | null
  event_date: string | null
  status: string
  is_public: boolean
  password_hash: string | null
  facial_recognition_enabled: boolean
  tenant_id: string
}

async function getEvent(tenantSlug: string, eventSlug: string): Promise<EventRow | null> {
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = (await (adminClient as any)
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single()) as { data: { id: string } | null }

  if (!tenant) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = (await (adminClient as any)
    .from('events')
    .select('id, title, slug, description, event_date, status, is_public, password_hash, facial_recognition_enabled, tenant_id')
    .eq('slug', eventSlug)
    .eq('tenant_id', tenant.id)
    .eq('type', 'event')
    .single()) as { data: EventRow | null }

  return event
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant, slug } = await params
  const event = await getEvent(tenant, slug)
  if (!event || event.status !== 'published') return {}
  return {
    title: event.title,
    description: event.description ?? `Fotos do evento ${event.title}`,
    openGraph: {
      title: event.title,
      description: event.description ?? `Fotos do evento ${event.title}`,
    },
  }
}

export default async function EventoPage({ params }: Props) {
  const { tenant, slug } = await params
  const event = await getEvent(tenant, slug)

  if (!event || event.status !== 'published') notFound()

  // Fetch first 48 photos server-side for SSR
  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, count } = (await (adminClient as any)
    .from('photos')
    .select('id, public_storage_path, status', { count: 'exact' })
    .eq('event_id', event.id)
    .eq('status', 'ready')
    .order('created_at', { ascending: true })
    .range(0, 47)) as { data: Photo[] | null; count: number | null }

  const needsPassword = !!event.password_hash

  const content = (
    <div className="p-6 space-y-6">
      {/* Event header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">{event.title}</h1>
        {event.event_date && (
          <p className="text-muted-foreground">
            {new Date(event.event_date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
        )}
        {event.description && (
          <p className="text-muted-foreground">{event.description}</p>
        )}
      </div>

      {/* Facial search island */}
      {event.facial_recognition_enabled && (
        <EventoPageClient
          eventId={event.id}
          initialPhotos={photos ?? []}
          total={count ?? 0}
        />
      )}

      {/* Photo grid (no facial search) */}
      {!event.facial_recognition_enabled && (
        <PhotoGrid
          initialPhotos={photos ?? []}
          eventId={event.id}
          total={count ?? 0}
        />
      )}
    </div>
  )

  if (needsPassword) {
    return <PasswordGate eventId={event.id}>{content}</PasswordGate>
  }

  return content
}
