import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
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

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: firstPhoto } = await (adminClient as any)
    .from('photos')
    .select('public_storage_path')
    .eq('event_id', event.id)
    .eq('status', 'ready')
    .not('public_storage_path', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`
  const ogImage = firstPhoto?.public_storage_path
    ? `${storageBase}/${firstPhoto.public_storage_path}`
    : undefined

  return {
    title: event.title,
    description: event.description ?? `Fotos do evento ${event.title}`,
    openGraph: {
      title: event.title,
      description: event.description ?? `Fotos do evento ${event.title}`,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  }
}

export default async function EventoPage({ params }: Props) {
  const { tenant: tenantSlug, slug } = await params
  const event = await getEvent(tenantSlug, slug)

  if (!event || event.status !== 'published') notFound()

  // Check if the logged-in user is the photographer/owner of this event
  let isManager = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const adminClient2 = createAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (adminClient2 as any)
        .from('users')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single() as { data: { tenant_id: string; role: string } | null }
      isManager =
        profile?.tenant_id === event.tenant_id &&
        ['photographer', 'sub_photographer', 'admin'].includes(profile?.role ?? '')
    }
  } catch {}

  // Fetch first 48 photos server-side for SSR
  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, count } = (await (adminClient as any)
    .from('photos')
    .select('id, public_storage_path, status, updated_at', { count: 'exact' })
    .eq('event_id', event.id)
    .eq('status', 'ready')
    .order('created_at', { ascending: true })
    .range(0, 47)) as { data: Photo[] | null; count: number | null }

  const needsPassword = !!event.password_hash
  const photoCount = count ?? 0

  const content = (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb + info */}
      <div className="border-b border-[#e5e7eb] bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <a
            href={`/${tenantSlug}`}
            className="text-sm text-[#6b7280] hover:text-[#111827] transition-colors inline-flex items-center gap-1 mb-3"
          >
            ← Voltar
          </a>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">{event.title}</h1>
              {event.event_date && (
                <p className="text-sm text-[#6b7280] mt-0.5">
                  {new Date(event.event_date).toLocaleDateString('pt-BR', {
                    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
                  })}
                </p>
              )}
            </div>
            <p className="text-sm text-[#6b7280] shrink-0">{photoCount} fotos</p>
          </div>
          {event.description && (
            <p className="text-sm text-[#6b7280] mt-2">{event.description}</p>
          )}
        </div>
      </div>

      {/* Busca facial */}
      {event.facial_recognition_enabled && (
        <div className="bg-[#eff6ff] border-b border-[#bfdbfe] px-6 py-3">
          <div className="max-w-6xl mx-auto">
            <EventoPageClient
              eventId={event.id}
              initialPhotos={photos ?? []}
              total={photoCount}
              isManager={isManager}
            />
          </div>
        </div>
      )}

      {/* Grid de fotos */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {!event.facial_recognition_enabled && (
          <PhotoGrid
            initialPhotos={photos ?? []}
            eventId={event.id}
            total={photoCount}
            isManager={isManager}
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
