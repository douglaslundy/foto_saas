import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error } = await (adminClient as any)
    .from('orders')
    .select('id, status, client_email, total_cents, payment_method, created_at')
    .eq('id', id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  }

  return NextResponse.json(order)
}
