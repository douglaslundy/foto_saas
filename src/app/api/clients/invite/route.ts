import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  let body: { email?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { email, name } = body
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
  }, { onConflict: 'id' })

  // Enfileirar email de convite via BullMQ
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const loginUrl = `${appUrl}/${tenant?.slug}/login`

  try {
    const { Queue } = await import('bullmq')
    const { default: Redis } = await import('ioredis')
    const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null })
    const emailQueue = new Queue('email', { connection })
    await emailQueue.add('client-invite', {
      to: email,
      subject: `Acesso ao portal de fotos — ${tenant?.name ?? 'FotoSaaS'}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="font-size:22px;margin-bottom:8px;">Bem-vindo(a)${name ? `, ${name}` : ''}!</h2>
          <p style="color:#666;margin-bottom:24px;">
            <strong>${tenant?.name ?? 'Seu fotógrafo'}</strong> criou um acesso para você no portal de fotos.
          </p>
          <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 8px 0;"><strong>E-mail:</strong> ${email}</p>
            <p style="margin:0;"><strong>Senha temporária:</strong>
              <code style="background:#e0e0e0;padding:2px 8px;border-radius:4px;font-size:15px;">${tempPassword}</code>
            </p>
          </div>
          <a href="${loginUrl}"
            style="display:inline-block;background:#0d0f14;color:white;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:600;">
            Acessar portal →
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px;">
            Ou acesse: <a href="${loginUrl}">${loginUrl}</a>
          </p>
        </div>
      `,
    })
    await connection.quit()
  } catch (emailErr) {
    console.error('[invite client] email queue error:', emailErr)
    // Não falha a request — conta criada, email é best-effort
  }

  return NextResponse.json({
    message: `Convite enviado para ${email}.`,
    clientUserId,
    tempPassword,
  }, { status: 201 })
}
