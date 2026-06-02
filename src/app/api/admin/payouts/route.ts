import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: p } = await (admin as any).from('users').select('role').eq('id', user.id).single()
  return p?.role === 'admin' ? admin : null
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payouts, error } = await (admin as any)
    .from('payouts')
    .select('id, amount_cents, status, period_start, period_end, note, paid_at, created_at, tenants(id, name, slug)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payouts: payouts ?? [] })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  let body: { tenant_id?: string; amount_cents?: number; period_start?: string; period_end?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { tenant_id, amount_cents, period_start, period_end, note } = body
  if (!tenant_id || !amount_cents || amount_cents <= 0 || !period_start || !period_end) {
    return NextResponse.json({ error: 'Campos obrigatórios: tenant_id, amount_cents, period_start, period_end.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payout, error } = await (admin as any)
    .from('payouts')
    .insert({ tenant_id, amount_cents, period_start, period_end, note: note ?? null, status: 'pending' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payout }, { status: 201 })
}
