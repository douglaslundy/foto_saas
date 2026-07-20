import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEssayReviewLink } from '@/lib/notifications/email'
import { sendWhatsAppMessage } from '@/lib/notifications/whatsapp'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const MAGIC_LINK_TTL_SECONDS = 72 * 60 * 60 // 72h

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single() as
    { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reviews, error } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, status, payment_status, sent_at, submitted_at, magic_link_expires_at')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false }) as
    { data: unknown[] | null; error: unknown }

  if (error) return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  return NextResponse.json({ reviews: reviews ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role, name, email')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string; name: string | null; email: string } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  let body: {
    event_id?: string
    client_id?: string
    client?: { name: string; email: string; cpf: string; phone?: string }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { event_id, client_id, client: newClient } = body

  if (!event_id) return NextResponse.json({ error: 'event_id é obrigatório.' }, { status: 400 })
  if (!client_id && !newClient) {
    return NextResponse.json({ error: 'Informe client_id ou dados do novo cliente.' }, { status: 400 })
  }
  if (newClient && (!newClient.name || !newClient.email || !newClient.cpf)) {
    return NextResponse.json({ error: 'Nome, email e CPF são obrigatórios para novo cliente.' }, { status: 400 })
  }

  // Verify event belongs to tenant and is type session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, title, slug, tenant_id, type')
    .eq('id', event_id)
    .eq('tenant_id', profile.tenant_id)
    .eq('type', 'session')
    .single() as { data: { id: string; title: string; slug: string; tenant_id: string; type: string } | null }

  if (!event) return NextResponse.json({ error: 'Ensaio não encontrado.' }, { status: 404 })

  // Get tenant slug for redirect URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants')
    .select('slug')
    .eq('id', profile.tenant_id)
    .single() as { data: { slug: string } | null }

  if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado.' }, { status: 404 })

  // Resolve client_id — create account if needed
  let resolvedClientId = client_id
  let clientEmail = ''
  let clientName = ''
  let clientPhone: string | null = null

  if (newClient) {
    // Senha temporária forte — o cliente normalmente entra pelo magic link
    // enviado por e-mail/WhatsApp, mas a conta precisa de uma senha real
    // (não previsível) para permitir login manual em /login também.
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: createError } = await (admin as any).auth.admin.createUser({
      email: newClient.email,
      password: tempPassword,
      email_confirm: true,
    })
    if (createError) {
      // If already exists, find by email in users table
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingUsers } = await (admin as any)
        .from('users')
        .select('id')
        .eq('email', newClient.email)
        .limit(1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (existingUsers as any[] | null)?.[0]
      if (!existing) return NextResponse.json({ error: 'Erro ao criar conta do cliente.' }, { status: 500 })
      resolvedClientId = existing.id
    } else {
      resolvedClientId = created.user.id
    }
    // Upsert in users table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('users').upsert({
      id: resolvedClientId,
      tenant_id: profile.tenant_id,
      email: newClient.email,
      name: newClient.name,
      cpf: newClient.cpf,
      phone: newClient.phone ?? null,
      role: 'client',
    }, { onConflict: 'id' })

    clientEmail = newClient.email
    clientName = newClient.name
    clientPhone = newClient.phone ?? null
  } else {
    // Fetch existing client's email, name and phone
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientData } = await (admin as any)
      .from('users')
      .select('email, name, phone')
      .eq('id', resolvedClientId)
      .eq('tenant_id', profile.tenant_id)
      .single() as { data: { email: string; name: string; phone: string | null } | null }

    if (!clientData) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    clientEmail = clientData.email
    clientName = clientData.name
    clientPhone = clientData.phone
  }

  // Create essay_reviews record. Toda revisão já nasce com uma senha de acesso
  // (6 dígitos) — o cliente pode entrar só com ela, sem precisar de conta/magic
  // link, e o fotógrafo pode trocá-la depois na tela de fotos do ensaio.
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000).toISOString()
  const accessPassword = String(Math.floor(100000 + Math.random() * 900000))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review, error: reviewError } = await (admin as any)
    .from('essay_reviews')
    .insert({
      tenant_id: profile.tenant_id,
      event_id,
      client_id: resolvedClientId,
      magic_link_expires_at: expiresAt,
      access_password: accessPassword,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown }

  if (reviewError || !review) {
    console.error('[POST /api/essay-reviews]', reviewError)
    return NextResponse.json({ error: 'Erro ao criar revisão.' }, { status: 500 })
  }

  // Generate magic link
  const redirectTo = `${SITE_URL}/auth/callback?next=/${tenant.slug}/ensaio-review/${review.id}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linkData, error: linkError } = await (admin as any).auth.admin.generateLink({
    type: 'magiclink',
    email: clientEmail,
    options: { redirectTo, expiresIn: MAGIC_LINK_TTL_SECONDS },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[POST /api/essay-reviews] generateLink error:', linkError)
    return NextResponse.json({ error: 'Erro ao gerar link.' }, { status: 500 })
  }

  const reviewLink = linkData.properties.action_link
  const directLink = `${SITE_URL}/${tenant.slug}/ensaio-review/${review.id}`

  // Send email to client
  await sendEssayReviewLink({
    to: clientEmail,
    clientName,
    reviewLink,
    directLink,
    accessPassword,
    sessionTitle: event.title,
    studioName: profile.name ?? undefined,
  })

  // Send WhatsApp message to client (se telefone cadastrado e Evolution API configurada)
  if (clientPhone) {
    await sendWhatsAppMessage(
      clientPhone,
      `Olá, ${clientName}! 📸\n\nSeu ensaio *${event.title}* está pronto para seleção de fotos.\n\nAcesse o link abaixo para escolher suas fotos favoritas (válido por 72 horas):\n${reviewLink}\n\nSe pedir login, use o link direto e a senha do ensaio:\n${directLink}\nSenha: ${accessPassword}`
    )
  }

  return NextResponse.json({ review_id: review.id }, { status: 201 })
}
