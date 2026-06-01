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

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  let body: { client_email?: string; event_id?: string; total_cents?: number; payment_method?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { client_email, event_id, total_cents, payment_method } = body

  if (!client_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  }
  if (!event_id) {
    return NextResponse.json({ error: 'Selecione um evento.' }, { status: 400 })
  }
  if (typeof total_cents !== 'number' || total_cents < 0) {
    return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 })
  }

  // Verify event belongs to this tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (adminClient as any)
    .from('events')
    .select('id')
    .eq('id', event_id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: orderError } = await (adminClient as any)
    .from('orders')
    .insert({
      client_email,
      status: 'paid',
      total_cents,
      payment_method: payment_method ?? 'manual',
      paid_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (orderError) {
    console.error('[POST /api/clients]', orderError)
    return NextResponse.json({ error: 'Erro ao criar pedido.' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient as any).from('order_items').insert({
    order_id: order.id,
    event_id,
    price_cents: total_cents,
  })

  return NextResponse.json({ success: true, orderId: order.id })
}
