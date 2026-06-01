import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { name, email, password, tenantSlug } = body as {
    name?: string
    email?: string
    password?: string
    tenantSlug?: string
  }

  if (!name || !email || !password || !tenantSlug) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'A senha deve ter no mínimo 8 caracteres.' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Create auth user via GoTrue admin API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: authData, error: authError } = await (adminClient as any).auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (authError) {
    console.error('[POST /api/auth/client/register] createUser', authError)
    if (
      authError.message?.includes('already registered') ||
      authError.message?.includes('already been registered')
    ) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao criar conta.' }, { status: 500 })
  }

  const user = authData?.user
  if (!user) {
    return NextResponse.json({ error: 'Erro ao criar conta.' }, { status: 500 })
  }

  // Insert profile into public.users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (adminClient as any).from('users').insert({
    id: user.id,
    name,
    email,
    role: 'client',
    tenant_id: null,
  })

  if (insertError) {
    console.error('[POST /api/auth/client/register] users insert', insertError)
    // Rollback the auth user to avoid orphan accounts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient as any).auth.admin.deleteUser(user.id)
    return NextResponse.json({ error: 'Erro ao salvar perfil.' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Conta criada com sucesso.' }, { status: 201 })
}
