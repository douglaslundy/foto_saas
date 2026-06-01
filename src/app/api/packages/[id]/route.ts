import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile?.tenant_id) return null
  return { ...profile, userId: user.id } as { tenant_id: string; role: string; userId: string }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const allowedFields = ['name', 'min_quantity', 'discount_percent', 'active']
  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
  }

  const admin = createAdminClient()
  // First verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from('photo_packages')
    .select('id, tenant_id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Pacote não encontrado.' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('photo_packages')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ package: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Verify ownership before delete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from('photo_packages')
    .select('id, tenant_id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Pacote não encontrado.' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('photo_packages')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
