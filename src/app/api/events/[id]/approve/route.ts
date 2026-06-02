import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Props = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params
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

  if (!profile || profile.role !== 'photographer') {
    return NextResponse.json({ error: 'Apenas fotógrafos podem aprovar eventos.' }, { status: 403 })
  }

  let body: { action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  if (!body.action || !['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: 'action deve ser "approve" ou "reject".' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, status, tenant_id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  if (event.status !== 'pending_approval') {
    return NextResponse.json({ error: 'Evento não está aguardando aprovação.' }, { status: 400 })
  }

  const newStatus = body.action === 'approve' ? 'draft' : 'archived'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('events').update({ status: newStatus }).eq('id', id)

  return NextResponse.json({ ok: true, status: newStatus })
}
