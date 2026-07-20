import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getDashboardFallbackPath } from '@/lib/dashboard-access'

type Props = { params: Promise<{ id: string }> }

type Photo = {
  id: string
  public_storage_path: string | null
  updated_at: string
}

const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

function photoUrl(photo: Photo): string | null {
  if (!photo.public_storage_path) return null
  const v = photo.updated_at ? new Date(photo.updated_at).getTime() : ''
  return `${STORAGE_URL}/${photo.public_storage_path}?v=${v}`
}

export default async function VisualizarEventoPage({ params }: Props) {
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
    redirect(getDashboardFallbackPath(profile as { role?: string | null; tenant_id?: string | null } | null))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = (await (adminClient as any)
    .from('events')
    .select('id, title, type')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()) as { data: { id: string; title: string; type: string } | null }

  if (!event) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos } = (await (adminClient as any)
    .from('photos')
    .select('id, public_storage_path, updated_at')
    .eq('event_id', id)
    .eq('tenant_id', profile.tenant_id)
    .eq('status', 'ready')
    .order('created_at', { ascending: true })) as { data: Photo[] | null }

  const readyPhotos = photos ?? []

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
        <Link href="/dashboard/eventos" className="hover:text-[var(--color-ink)] transition-colors">
          Eventos
        </Link>
        <span>/</span>
        <span className="text-[var(--color-ink)]">{event.title}</span>
        <span>/</span>
        <span>Visualizar</span>
      </nav>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            {event.title}
          </h1>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1">
            Prévia de como {event.type === 'session' ? 'o cliente verá as fotos do ensaio' : 'as fotos aparecem na galeria'} — {readyPhotos.length} foto{readyPhotos.length !== 1 ? 's' : ''} pronta{readyPhotos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href={`/dashboard/eventos/${id}/fotos`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-sm font-medium hover:bg-[var(--color-surface-alt)] transition-colors"
        >
          ← Gerenciar fotos
        </Link>
      </div>

      {readyPhotos.length === 0 ? (
        <div className="py-16 text-center">
          <svg className="mx-auto mb-4 text-[var(--color-ink-muted)]" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="font-display text-lg font-semibold text-[var(--color-ink)]">Nenhuma foto pronta ainda.</p>
          <p className="text-sm text-[var(--color-ink-muted)] mt-1">Fotos em processamento não aparecem aqui — só as já tratadas, exatamente como o cliente verá.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {readyPhotos.map((photo) => {
            const src = photoUrl(photo)
            return (
              <div
                key={photo.id}
                className="relative aspect-square rounded-[var(--radius-sm)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-alt)]"
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="w-full h-full object-cover" draggable="false" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xs text-[var(--color-ink-muted)]">Sem preview</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
