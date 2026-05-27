import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { status } = body
  if (!status || !['active', 'suspended'].includes(status)) {
    return NextResponse.json({ error: 'status deve ser active ou suspended.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (adminClient as any)
    .from('tenants')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('[PATCH /api/admin/tenants/[id]/status]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return NextResponse.json({ status })
}
