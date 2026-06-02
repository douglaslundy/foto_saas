import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailQueue } from '@/lib/queues/email-queue'

type Props = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = (await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()) as { data: { tenant_id: string; role: string } | null }

  if (
    !profile?.tenant_id ||
    !['photographer', 'sub_photographer', 'admin'].includes(profile.role)
  ) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (admin as any)
    .from('orders')
    .select('id, status, client_email, order_items(event_id, events(tenant_id))')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  // Verify the order belongs to an event of this tenant
  const belongsToTenant = (order.order_items ?? []).some(
    (oi: { events: { tenant_id: string } | null }) =>
      oi.events?.tenant_id === profile.tenant_id
  )
  if (!belongsToTenant) {
    return NextResponse.json(
      { error: 'Pedido não pertence ao seu tenant.' },
      { status: 403 }
    )
  }

  if (!['paid', 'delivered'].includes(order.status)) {
    return NextResponse.json(
      { error: 'Pedido precisa estar pago para entregar.' },
      { status: 400 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const orderPageUrl = `${appUrl}/pedido/${id}`

  // Enqueue delivery email
  try {
    await emailQueue.add('order-delivery', {
      type: 'order_delivery',
      to: order.client_email,
      orderId: id,
      orderPageUrl,
    })
  } catch (err) {
    console.error('[deliver] email queue error:', err)
  }

  // Update order status to delivered
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (admin as any)
    .from('orders')
    .update({ status: 'delivered' })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json(
      { error: 'Erro ao atualizar status do pedido.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, message: 'Fotos entregues e e-mail enviado.' })
}
