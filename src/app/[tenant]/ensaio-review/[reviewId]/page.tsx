import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasEssayAccess } from '@/lib/essay-access'
import { ReviewClient } from './_components/review-client'
import { PasswordGate } from './_components/password-gate'

type Props = { params: Promise<{ tenant: string; reviewId: string }> }

export default async function EnsaioReviewPage({ params }: Props) {
  const { tenant: tenantSlug, reviewId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, tenant_id, status, selected_photo_ids, notes, magic_link_expires_at, access_password')
    .eq('id', reviewId)
    .single() as { data: {
      id: string; event_id: string; client_id: string; tenant_id: string;
      status: string; selected_photo_ids: string[]; notes: string | null;
      magic_link_expires_at: string; access_password: string | null;
    } | null }

  if (!review) notFound()

  // Autorizado se logado como o cliente dono da revisão, OU se já passou
  // pelo portão de senha do ensaio (acesso sem precisar de conta).
  const isAuthorizedClient = !!user && review.client_id === user.id
  const isAuthorizedByPassword = !isAuthorizedClient && await hasEssayAccess(reviewId)

  if (!isAuthorizedClient && !isAuthorizedByPassword) {
    if (review.access_password) {
      return <PasswordGate reviewId={reviewId} />
    }
    if (!user) redirect(`/${tenantSlug}/login?redirect=/${tenantSlug}/ensaio-review/${reviewId}`)
    notFound()
  }

  // Link expirado e não enviado ainda
  if (new Date(review.magic_link_expires_at) < new Date() && review.status === 'pending_selection') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link expirado</h1>
          <p className="text-gray-600 text-sm">Solicite um novo link ao fotógrafo.</p>
        </div>
      </div>
    )
  }

  // Já enviou a seleção, fotógrafo ainda tratando
  if (review.status === 'submitted' || review.status === 'in_progress') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Seleção enviada!</h1>
          <p className="text-gray-600 text-sm">
            {review.status === 'in_progress'
              ? 'O fotógrafo já está tratando suas fotos. Você receberá um e-mail assim que estiverem prontas.'
              : 'Você já enviou sua seleção. O fotógrafo entrará em contato em breve.'}
          </p>
        </div>
      </div>
    )
  }

  // Entrega final pronta para download
  if (review.status === 'delivered') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-2xl">✓</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Suas fotos estão prontas!</h1>
          <p className="text-gray-600 text-sm mb-6">
            {review.selected_photo_ids?.length ?? 0} foto{(review.selected_photo_ids?.length ?? 0) !== 1 ? 's' : ''} tratada{(review.selected_photo_ids?.length ?? 0) !== 1 ? 's' : ''}, prontas para baixar.
          </p>
          <a
            href={`/api/essay-reviews/${review.id}/download-final`}
            className="inline-block w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Baixar minhas fotos
          </a>
        </div>
      </div>
    )
  }

  // Fetch event + photos + tenant name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, title, slug, session_price_cents, included_photo_count, extra_photo_price_cents, tenant_id')
    .eq('id', review.event_id)
    .single() as { data: {
      id: string; title: string; slug: string; tenant_id: string
      session_price_cents: number; included_photo_count: number; extra_photo_price_cents: number
    } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos } = await (admin as any)
    .from('photos')
    .select('id, public_storage_path, status')
    .eq('event_id', review.event_id)
    .eq('status', 'ready')
    .order('created_at', { ascending: true }) as
    { data: { id: string; public_storage_path: string | null; status: string }[] | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants').select('name').eq('slug', tenantSlug).single() as
    { data: { name: string } | null }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-semibold text-gray-900">{tenant?.name ?? tenantSlug}</span>
          {event && <span className="text-sm text-gray-500">{event.title}</span>}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <ReviewClient
          reviewId={review.id}
          photos={photos ?? []}
          sessionPriceCents={event?.session_price_cents ?? 0}
          includedPhotoCount={event?.included_photo_count ?? 0}
          extraPhotoPriceCents={event?.extra_photo_price_cents ?? 0}
          tenantSlug={tenantSlug}
        />
      </div>
    </div>
  )
}
