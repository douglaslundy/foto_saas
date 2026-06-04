import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncMercadoPagoOrderByExternalReference } from '@/lib/payments/mercadopago'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error } = await (admin as any)
    .from('orders')
    .select('id, status, payment_method')
    .eq('id', id)
    .single()
  if (error || !order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (order.status !== 'paid' && order.payment_method !== 'manual') {
    const syncStatus = await syncMercadoPagoOrderByExternalReference(order.id)
    if (syncStatus === 'paid') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', order.id)
      order.status = 'paid'
    }
  }

  return NextResponse.json({ id: order.id, status: order.status })
}
