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
  const { tenant: tenantSlug, slug } = await params
  const event = await getEvent(tenantSlug, slug)

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
  const photoCount = count ?? 0

  const content = (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Imersive header */}
      <div
        className="relative h-64 overflow-hidden flex flex-col justify-end"
        style={{
          background: '#0d0f14',
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(200,169,110,0.12), transparent)',
        }}
      >
        <a
          href={`/${tenantSlug}`}
          className="absolute top-5 left-6 text-white/70 hover:text-white text-sm flex items-center gap-1 transition-colors"
        >
          ← Voltar
        </a>
        <div className="px-6 pb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-gold)] mb-2 block">
            Evento
          </span>
          <h1 className="text-3xl font-bold text-white">{event.title}</h1>
          {event.event_date && (
            <p className="text-white/60 text-sm mt-1">
              {new Date(event.event_date).toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Sticky action bar */}
        <div
          className="sticky top-0 z-10 -mx-6 px-6 py-3 mb-6 flex items-center justify-between border-b border-[var(--color-border)]"
          style={{
            background: 'rgba(245,244,240,0.92)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <p className="text-sm text-[var(--color-ink-muted,#6b6b6b)]">
            {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}
          </p>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-[var(--color-ink-muted,#6b6b6b)] text-sm mb-6">{event.description}</p>
        )}

        {/* Facial search island */}
        {event.facial_recognition_enabled && (
          <EventoPageClient
            eventId={event.id}
            initialPhotos={photos ?? []}
            total={photoCount}
          />
        )}

        {/* Photo grid (no facial search) */}
        {!event.facial_recognition_enabled && (
          <PhotoGrid
            initialPhotos={photos ?? []}
            eventId={event.id}
            total={photoCount}
          />
        )}
      </div>
    </div>
  )

  if (needsPassword) {
    return <PasswordGate eventId={event.id}>{content}</PasswordGate>
  }

  return content
}
