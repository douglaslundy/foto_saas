import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return { adminClient }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { id } = await params
  let body: { name?: string; email?: string; status?: 'active' | 'inactive' }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentUser, error: currentError } = await (auth.adminClient as any)
    .from('users')
    .select('id, name, email, role')
    .eq('id', id)
    .single()

  if (currentError || !currentUser) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  const updates: Record<string, string> = {}

  if (typeof body.name === 'string') {
    const nextName = body.name.trim()
    if (nextName.length < 2) {
      return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 })
    }
    updates.name = nextName
  }

  if (typeof body.email === 'string') {
    const nextEmail = body.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }
    updates.email = nextEmail
  }

  if (typeof body.status === 'string') {
    updates.role = body.status === 'active' ? 'client' : 'client_inactive'
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  }

  if (updates.email || updates.name) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: authError } = await (auth.adminClient as any).auth.admin.updateUserById(id, {
      email: updates.email,
      user_metadata: updates.name ? { name: updates.name } : undefined,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (auth.adminClient as any)
    .from('users')
    .update(updates)
    .eq('id', id)

  if (updateError) {
    console.error('[PATCH /api/clients/[id]]', updateError)
    return NextResponse.json({ error: 'Erro ao atualizar cliente.' }, { status: 500 })
  }

  if (updates.email) {
    // Keep the order history searchable after an email change.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (auth.adminClient as any)
      .from('orders')
      .update({ client_email: updates.email })
      .or(`client_user_id.eq.${id},client_email.eq.${currentUser.email}`)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { id } = await params

  // Preserve order history, but remove the user profile and auth account.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (auth.adminClient as any)
    .from('orders')
    .update({ client_user_id: null })
    .eq('client_user_id', id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteProfileError } = await (auth.adminClient as any)
    .from('users')
    .delete()
    .eq('id', id)

  if (deleteProfileError) {
    return NextResponse.json({ error: deleteProfileError.message }, { status: 400 })
  }

  await auth.adminClient.auth.admin.deleteUser(id)

  return NextResponse.json({ success: true })
}
