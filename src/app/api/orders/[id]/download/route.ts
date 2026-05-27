import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDownloadUrls } from '@/lib/delivery'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminClient = createAdminClient()

  // Verify order exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: orderError } = await (adminClient as any)
    .from('orders')
    .select('id, status')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  }

  if (order.status !== 'paid') {
    return NextResponse.json({ error: 'Pedido não pago.' }, { status: 403 })
  }

  // Fetch order items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderItems, error: itemsError } = await (adminClient as any)
    .from('order_items')
    .select('id, photo_id, event_id, price_cents')
    .eq('order_id', id)

  if (itemsError) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  const photoIds = (orderItems ?? []).map((item: { photo_id: string }) => item.photo_id)
  const downloads = await generateDownloadUrls(photoIds)

  return NextResponse.json({ downloads })
}
