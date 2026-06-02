import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Props = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, tenant_id, status, selected_photo_ids, notes, payment_status, sent_at, submitted_at, magic_link_expires_at')
    .eq('id', id)
    .single() as { data: {
      id: string; event_id: string; client_id: string; tenant_id: string;
      status: string; selected_photo_ids: string[]; notes: string | null;
      payment_status: string; sent_at: string; submitted_at: string | null;
      magic_link_expires_at: string;
    } | null }

  if (!review) return NextResponse.json({ error: 'Review não encontrado.' }, { status: 404 })

  // Permission: client of the review OR photographer of the tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null }

  const isClient = review.client_id === user.id
  const isPhotographer = profile?.tenant_id === review.tenant_id &&
    ['photographer', 'sub_photographer', 'admin'].includes(profile?.role ?? '')

  if (!isClient && !isPhotographer) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // Fetch event + photos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, title, slug, price_cents')
    .eq('id', review.event_id)
    .single() as { data: { id: string; title: string; slug: string; price_cents: number } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos } = await (admin as any)
    .from('photos')
    .select('id, public_storage_path, status')
    .eq('event_id', review.event_id)
    .eq('status', 'ready')
    .order('created_at', { ascending: true }) as
    { data: { id: string; public_storage_path: string | null; status: string }[] | null }

  // Client data — only for photographer
  let clientData: { name: string; email: string } | null = null
  if (isPhotographer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: c } = await (admin as any)
      .from('users').select('name, email').eq('id', review.client_id).single() as
      { data: { name: string; email: string } | null }
    clientData = c
  }

  // Packages for price calculation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packages } = await (admin as any)
    .from('photo_packages')
    .select('name, min_quantity, discount_percent')
    .eq('tenant_id', review.tenant_id)
    .eq('active', true)
    .order('min_quantity', { ascending: false }) as
    { data: { name: string; min_quantity: number; discount_percent: number }[] | null }

  return NextResponse.json({
    review,
    event: event ?? null,
    photos: photos ?? [],
    client: clientData,
    packages: packages ?? [],
  })
}
