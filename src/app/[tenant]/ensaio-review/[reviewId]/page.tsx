import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReviewClient } from './_components/review-client'

type Props = { params: Promise<{ tenant: string; reviewId: string }> }

export default async function EnsaioReviewPage({ params }: Props) {
  const { tenant: tenantSlug, reviewId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${tenantSlug}/login?redirect=/${tenantSlug}/ensaio-review/${reviewId}`)
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, tenant_id, status, selected_photo_ids, notes, magic_link_expires_at')
    .eq('id', reviewId)
    .single() as { data: {
      id: string; event_id: string; client_id: string; tenant_id: string;
      status: string; selected_photo_ids: string[]; notes: string | null;
      magic_link_expires_at: string;
    } | null }

  if (!review) notFound()

  // Only the review's client can access
  if (review.client_id !== user.id) notFound()

  // Link expired and not yet submitted
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

  // Already submitted
  if (review.status === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Seleção enviada!</h1>
          <p className="text-gray-600 text-sm">Você já enviou sua seleção. O fotógrafo entrará em contato em breve.</p>
        </div>
      </div>
    )
  }

  // Fetch event + photos + packages + tenant name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, title, slug, price_cents, tenant_id')
    .eq('id', review.event_id)
    .single() as { data: { id: string; title: string; slug: string; price_cents: number; tenant_id: string } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos } = await (admin as any)
    .from('photos')
    .select('id, public_storage_path, status')
    .eq('event_id', review.event_id)
    .eq('status', 'ready')
    .order('created_at', { ascending: true }) as
    { data: { id: string; public_storage_path: string | null; status: string }[] | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packages } = await (admin as any)
    .from('photo_packages')
    .select('name, min_quantity, discount_percent')
    .eq('tenant_id', review.tenant_id)
    .eq('active', true)
    .order('min_quantity', { ascending: false }) as
    { data: { name: string; min_quantity: number; discount_percent: number }[] | null }

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
          pricePerPhotoCents={event?.price_cents ?? 0}
          packages={packages ?? []}
          tenantSlug={tenantSlug}
        />
      </div>
    </div>
  )
}
