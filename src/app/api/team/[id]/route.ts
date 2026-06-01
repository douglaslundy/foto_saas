import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
