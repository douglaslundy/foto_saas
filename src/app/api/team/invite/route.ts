import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id || profile.role !== 'photographer') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { email } = body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  }

  // Check if already a member of this tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (adminClient as any)
    .from('users')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Usuário já é membro da equipe.' }, { status: 409 })
  }

  // Check if user already exists in GoTrue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingAuth } = await (adminClient as any).auth.admin.listUsers()
  const existingUser = existingAuth?.users?.find((u: { email: string }) => u.email === email)

  if (existingUser) {
    // User exists in GoTrue — just create the public.users record directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient as any).from('users').upsert({
      id: existingUser.id,
      email,
      role: 'sub_photographer',
      tenant_id: profile.tenant_id,
    }, { onConflict: 'id' })

    return NextResponse.json({ message: 'Colaborador adicionado à equipe.', userId: existingUser.id })
  }

  // New user — create directly with password (invite flow)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newUser, error: createError } = await (adminClient as any).auth.admin.createUser({
    email,
    password: Math.random().toString(36).slice(-10) + 'A1!',
    email_confirm: true,
    user_metadata: {
      tenant_id: profile.tenant_id,
      role: 'sub_photographer',
    },
  })

  if (createError) {
    console.error('[POST /api/team/invite]', createError)
    return NextResponse.json({ error: 'Erro ao criar colaborador.' }, { status: 500 })
  }

  // Create public.users record immediately
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient as any).from('users').insert({
    id: newUser.user.id,
    email,
    role: 'sub_photographer',
    tenant_id: profile.tenant_id,
  })

  return NextResponse.json({
    message: 'Colaborador criado. Envie as credenciais por e-mail.',
    userId: newUser.user.id,
  })
}
