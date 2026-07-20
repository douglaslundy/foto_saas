import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailQueue } from '@/lib/queues/email-queue'
import { sendWhatsAppMessage } from '@/lib/notifications/whatsapp'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  let body: { email?: string; name?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { email, name, phone } = body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  }

  // Verificar se já é cliente deste tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from('users')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('email', email)
    .eq('role', 'client')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Este e-mail já é cliente cadastrado.' }, { status: 409 })
  }

  // Gerar senha temporária
  const tempPassword = Math.random().toString(36).slice(-8) + 'A1!'

  // Verificar se usuário já existe no GoTrue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allUsers } = await (admin as any).auth.admin.listUsers()
  const existingAuth = (allUsers?.users ?? []).find((u: { email: string }) => u.email === email)

  let clientUserId: string

  if (existingAuth) {
    clientUserId = existingAuth.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).auth.admin.updateUserById(existingAuth.id, { password: tempPassword })
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newUser, error: createError } = await (admin as any).auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: name ?? '', role: 'client', tenant_id: profile.tenant_id },
    })
    if (createError) {
      console.error('[invite client]', createError)
      return NextResponse.json({ error: 'Erro ao criar cliente.' }, { status: 500 })
    }
    clientUserId = newUser.user.id
  }

  // Buscar info do tenant para o email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants')
    .select('slug, name')
    .eq('id', profile.tenant_id)
    .single() as { data: { slug: string; name: string } | null }

  // Upsert em public.users como client deste tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('users').upsert({
    id: clientUserId,
    email,
    role: 'client',
    tenant_id: profile.tenant_id,
    name: name ?? null,
    phone: phone ?? null,
  }, { onConflict: 'id' })

  // Enfileirar email de convite via BullMQ
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const loginUrl = `${appUrl}/${tenant?.slug}/login`

  try {
    await emailQueue.add('client_invite', {
      type: 'client_invite',
      to: email,
      name: name ?? undefined,
      tempPassword,
      loginUrl,
      studioName: tenant?.name ?? 'FotoSaaS',
    })
  } catch (emailErr) {
    console.error('[invite client] email queue error:', emailErr)
  }

  if (phone) {
    await sendWhatsAppMessage(
      phone,
      `Olá${name ? `, ${name}` : ''}! 📸\n\n${tenant?.name ?? 'Seu fotógrafo'} criou um acesso para você no portal de fotos.\n\nE-mail: ${email}\nSenha temporária: ${tempPassword}\n\nAcesse: ${loginUrl}`
    )
  }

  return NextResponse.json({
    message: `Convite enviado para ${email}.`,
    clientUserId,
    tempPassword,
  }, { status: 201 })
}
