import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEssayDelivered } from '@/lib/notifications/email'

type Params = { params: Promise<{ id: string }> }

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const DOWNLOAD_LINK_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 dias

// POST /api/essay-reviews/[id]/send — o fotógrafo termina o tratamento e envia
// a entrega final (fotos tratadas) por e-mail ao cliente, com link de download.
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role, name').eq('id', user.id).single() as
    { data: { tenant_id: string; role: string; name: string | null } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, tenant_id, status, selected_photo_ids')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single() as { data: {
      id: string; event_id: string; client_id: string; tenant_id: string
      status: string; selected_photo_ids: string[]
    } | null }

  if (!review) return NextResponse.json({ error: 'Seleção não encontrada.' }, { status: 404 })
  if (!['submitted', 'in_progress'].includes(review.status)) {
    return NextResponse.json({ error: 'Esta seleção não está pronta para envio.' }, { status: 409 })
  }
  if ((review.selected_photo_ids ?? []).length === 0) {
    return NextResponse.json({ error: 'Nenhuma foto selecionada.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: event }, { data: client }, { data: tenant }] = await Promise.all([
    (admin as any).from('events').select('title').eq('id', review.event_id).single(),
    (admin as any).from('users').select('email, name').eq('id', review.client_id).single(),
    (admin as any).from('tenants').select('slug, name').eq('id', review.tenant_id).single(),
  ]) as [
    { data: { title: string } | null },
    { data: { email: string; name: string } | null },
    { data: { slug: string; name: string } | null },
  ]

  if (!event || !client || !tenant) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (admin as any)
    .from('essay_reviews')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) {
    console.error('[POST /api/essay-reviews/[id]/send]', updateError)
    return NextResponse.json({ error: 'Erro ao marcar entrega.' }, { status: 500 })
  }

  // Gera um link de acesso (o cliente pode já ter perdido a sessão desde a
  // seleção) que loga e leva direto para a tela de download da entrega final.
  const redirectTo = `${SITE_URL}/auth/callback?next=/${tenant.slug}/ensaio-review/${review.id}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linkData, error: linkError } = await (admin as any).auth.admin.generateLink({
    type: 'magiclink',
    email: client.email,
    options: { redirectTo, expiresIn: DOWNLOAD_LINK_TTL_SECONDS },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[POST /api/essay-reviews/[id]/send] generateLink error:', linkError)
    return NextResponse.json({ error: 'Entrega marcada, mas erro ao gerar link de acesso.' }, { status: 500 })
  }

  await sendEssayDelivered({
    to: client.email,
    clientName: client.name ?? 'Cliente',
    sessionTitle: event.title,
    photoCount: review.selected_photo_ids.length,
    downloadLink: linkData.properties.action_link,
    studioName: tenant.name ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
