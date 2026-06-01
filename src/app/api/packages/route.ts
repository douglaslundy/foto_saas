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

export async function GET() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('photo_packages')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('min_quantity', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ packages: data ?? [] })
}

export async function POST(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json()
  const { name, min_quantity, discount_percent, active } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
  }
  if (!Number.isInteger(min_quantity) || min_quantity < 1) {
    return NextResponse.json({ error: 'Quantidade mínima inválida.' }, { status: 400 })
  }
  if (!Number.isInteger(discount_percent) || discount_percent < 1 || discount_percent > 100) {
    return NextResponse.json({ error: 'Desconto deve ser entre 1 e 100.' }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('photo_packages')
    .insert({
      tenant_id: profile.tenant_id,
      name: name.trim(),
      min_quantity,
      discount_percent,
      active: active !== false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ package: data }, { status: 201 })
}
