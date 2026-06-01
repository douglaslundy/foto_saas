import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { role } = body as { role?: string }
  if (!role || !['photographer', 'sub_photographer'].includes(role)) {
    return NextResponse.json({ error: 'Role inválido.' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerProfile } = await (adminClient as any)
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { id: string; tenant_id: string; role: string } | null }

  if (!callerProfile || callerProfile.role !== 'photographer') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  if (memberId === callerProfile.id) {
    return NextResponse.json({ error: 'Não é possível alterar seu próprio papel.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (adminClient as any)
    .from('users')
    .select('id, role, tenant_id')
    .eq('id', memberId)
    .single() as { data: { id: string; role: string; tenant_id: string } | null }

  if (!member || member.tenant_id !== callerProfile.tenant_id) {
    return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 })
  }

  // Prevent demoting if this member is the only photographer
  if (member.role === 'photographer' && role === 'sub_photographer') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (adminClient as any)
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', callerProfile.tenant_id)
      .eq('role', 'photographer') as { count: number | null }

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Não é possível rebaixar o único fotógrafo principal.' },
        { status: 400 }
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateError } = await (adminClient as any)
    .from('users')
    .update({ role })
    .eq('id', memberId)
    .eq('tenant_id', callerProfile.tenant_id)
    .select()
    .single() as { data: { id: string; email: string; role: string } | null; error: unknown }

  if (updateError) {
    console.error('[PATCH /api/team/:id]', updateError)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerProfile } = await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null }

  if (!callerProfile || callerProfile.role !== 'photographer') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (adminClient as any)
    .from('users')
    .select('id, role, tenant_id')
    .eq('id', memberId)
    .single() as { data: { id: string; role: string; tenant_id: string } | null }

  if (!member || member.tenant_id !== callerProfile.tenant_id) {
    return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 })
  }

  if (member.role !== 'sub_photographer') {
    return NextResponse.json({ error: 'Não é possível remover o fotógrafo principal.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient as any).from('users').delete().eq('id', memberId)
  await adminClient.auth.admin.deleteUser(memberId)

  return NextResponse.json({ success: true })
}
