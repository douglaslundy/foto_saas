import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { FotosManager } from '@/components/photos/fotos-manager'
import { SendToClientButton } from '@/components/essay/send-to-client-button'
import { SendFinalDeliveryButton } from '@/components/essay/send-final-delivery-button'
import { ReviewPasswordCard } from '@/components/essay/review-password-card'
import { getDashboardFallbackPath } from '@/lib/dashboard-access'

type Props = { params: Promise<{ id: string }> }

type Photo = {
  id: string
  status: string
  thumbnail_path: string | null
  public_storage_path: string | null
  created_at: string
  updated_at: string
}

type EssayReview = {
  id: string
  status: string
  magic_link_expires_at: string
  submitted_at: string | null
  selected_photo_ids: string[]
  access_password: string | null
}

const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending_selection: 'Aguardando seleção do cliente',
  submitted: 'Seleção recebida',
  in_progress: 'Em tratamento',
  delivered: 'Entregue',
}

const REVIEW_STATUS_COLOR: Record<string, string> = {
  pending_selection: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
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
    redirect(getDashboardFallbackPath(profile as { role?: string | null; tenant_id?: string | null } | null))
  }

  const [eventResult, photosResult, reviewResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('events')
      .select('id, title, slug, status, type')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single() as Promise<{ data: { id: string; title: string; slug: string; status: string; type: string } | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('photos')
      .select('id, status, thumbnail_path, public_storage_path, created_at, updated_at')
      .eq('event_id', id)
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false }) as Promise<{ data: Photo[] | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('essay_reviews')
      .select('id, status, magic_link_expires_at, submitted_at, selected_photo_ids, access_password')
      .eq('event_id', id)
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as Promise<{ data: EssayReview | null }>,
  ])

  const event = eventResult.data
  const photos = photosResult.data ?? []
  const review = reviewResult.data
  if (!event) notFound()

  const isSession = event.type === 'session'
  const isLinkExpired = review?.status === 'pending_selection' &&
    new Date(review.magic_link_expires_at) < new Date()

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
        <Link href="/dashboard/eventos" className="hover:text-[var(--color-ink)] transition-colors">
          Eventos
        </Link>
        <span>/</span>
        <span className="text-[var(--color-ink)]">{event.title}</span>
        <span>/</span>
        <span>Fotos</span>
      </nav>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            {event.title}
          </h1>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-gold-light)] text-[var(--color-gold)] border border-[var(--color-gold)]/30">
            {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
          </span>
          {review && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${REVIEW_STATUS_COLOR[review.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {REVIEW_STATUS_LABEL[review.status] ?? review.status}
              {review.status === 'submitted' && ` (${review.selected_photo_ids?.length ?? 0} fotos)`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/eventos/${id}/visualizar`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-sm font-medium hover:bg-[var(--color-surface-alt)] transition-colors"
            title={isSession ? 'Ver as fotos como o cliente vai ver, antes de enviar' : 'Ver as fotos como aparecem na galeria'}
          >
            👁 Visualizar
          </Link>
          {isSession && (
            <SendToClientButton
              eventId={id}
              hasActiveReview={!!review && !isLinkExpired && review.status === 'pending_selection'}
              canResend={!!review && isLinkExpired}
              reviewId={review?.id}
            />
          )}
          {isSession && review && ['submitted', 'in_progress', 'delivered'].includes(review.status) && (
            <a
              href={`/api/essay-reviews/${review.id}/download-zip`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-sm font-medium hover:bg-[var(--color-surface-alt)] transition-colors"
              title="Baixar as fotos que o cliente selecionou, em um arquivo .zip"
            >
              ⬇ Baixar seleção ({review.selected_photo_ids?.length ?? 0})
            </a>
          )}
          {isSession && review && ['submitted', 'in_progress'].includes(review.status) && (
            <SendFinalDeliveryButton reviewId={review.id} photoCount={review.selected_photo_ids?.length ?? 0} />
          )}
          <Link
            href={`/dashboard/eventos/${id}/editar`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-sm font-medium hover:bg-[var(--color-surface-alt)] transition-colors"
          >
            ← Voltar ao Evento
          </Link>
        </div>
      </div>

      {isSession && review && (
        <ReviewPasswordCard reviewId={review.id} initialPassword={review.access_password} />
      )}

      <FotosManager eventId={id} initialPhotos={photos} storageBase={storageBase} />
    </div>
  )
}
