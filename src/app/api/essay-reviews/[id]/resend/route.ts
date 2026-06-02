import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEssayReviewLink } from '@/lib/notifications/email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const MAGIC_LINK_TTL_SECONDS = 72 * 60 * 60

type Props = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role, name').eq('id', user.id).single() as
    { data: { tenant_id: string; role: string; name: string | null } | null }

  if (!profile?.tenant_id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, tenant_id, status')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single() as { data: { id: string; event_id: string; client_id: string; tenant_id: string; status: string } | null }

  if (!review) return NextResponse.json({ error: 'Review não encontrado.' }, { status: 404 })
  if (review.status === 'submitted') {
    return NextResponse.json({ error: 'Seleção já enviada. Reenvio não necessário.' }, { status: 409 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clientData } = await (admin as any)
    .from('users').select('email, name').eq('id', review.client_id).single() as
    { data: { email: string; name: string } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants').select('slug').eq('id', review.tenant_id).single() as
    { data: { slug: string } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events').select('title').eq('id', review.event_id).single() as
    { data: { title: string } | null }

  if (!clientData || !tenant || !event) {
    return NextResponse.json({ error: 'Dados insuficientes para reenvio.' }, { status: 500 })
  }

  const newExpiresAt = new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000).toISOString()
  const redirectTo = `${SITE_URL}/auth/callback?next=/${tenant.slug}/ensaio-review/${review.id}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linkData, error: linkError } = await (admin as any).auth.admin.generateLink({
    type: 'magiclink',
    email: clientData.email,
    options: { redirectTo, expiresIn: MAGIC_LINK_TTL_SECONDS },
  })

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: 'Erro ao gerar link.' }, { status: 500 })
  }

  // Update expiration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('essay_reviews')
    .update({ magic_link_expires_at: newExpiresAt })
    .eq('id', review.id)

  await sendEssayReviewLink({
    to: clientData.email,
    clientName: clientData.name,
    reviewLink: linkData.properties.action_link,
    sessionTitle: event.title,
    studioName: profile.name ?? undefined,
  })

  return NextResponse.json({ success: true })
}
