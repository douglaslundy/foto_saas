import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { FotosManager } from '@/components/photos/fotos-manager'

type Props = { params: Promise<{ id: string }> }

type Photo = {
  id: string
  status: string
  thumbnail_path: string | null
  public_storage_path: string | null
  created_at: string
}

export default async function FotosEventoPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  const [eventResult, photosResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('events')
      .select('id, title, slug, status')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single() as Promise<{ data: { id: string; title: string; slug: string; status: string } | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('photos')
      .select('id, status, thumbnail_path, public_storage_path, created_at')
      .eq('event_id', id)
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false }) as Promise<{ data: Photo[] | null }>,
  ])

  const event = eventResult.data
  const photos = photosResult.data ?? []
  if (!event) notFound()

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
        <Link
          href="/dashboard/eventos"
          className="hover:text-[var(--color-ink)] transition-colors"
        >
          Eventos
        </Link>
        <span>/</span>
        <span className="text-[var(--color-ink)]">{event.title}</span>
        <span>/</span>
        <span>Fotos</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            {event.title}
          </h1>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-gold-light)] text-[var(--color-gold)] border border-[var(--color-gold)]/30">
            {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
          </span>
        </div>
        <Link
          href={`/dashboard/eventos/${id}/editar`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-sm font-medium hover:bg-[var(--color-surface-alt)] transition-colors"
        >
          ← Voltar ao Evento
        </Link>
      </div>

      <FotosManager eventId={id} initialPhotos={photos} storageBase={storageBase} />
    </div>
  )
}
