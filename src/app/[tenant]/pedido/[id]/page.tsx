import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { OrderStatus } from './_components/order-status'

type Props = { params: Promise<{ tenant: string; id: string }> }

type OrderRow = {
  id: string
  status: string
  client_email: string
  total_cents: number
  payment_method: string
  created_at: string
}

type OrderItem = {
  id: string
  photo_id: string
  price_cents: number
}

export default async function PedidoPage({ params }: Props) {
  const { id } = await params
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error } = (await (adminClient as any)
    .from('orders')
    .select('id, status, client_email, total_cents, payment_method, created_at')
    .eq('id', id)
    .single()) as { data: OrderRow | null; error: { message: string } | null }

  if (error || !order) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderItems } = (await (adminClient as any)
    .from('order_items')
    .select('id, photo_id, price_cents')
    .eq('order_id', id)) as { data: OrderItem[] | null }

  return (
    <OrderStatus
      orderId={order.id}
      initialStatus={order.status}
      totalCents={order.total_cents}
      clientEmail={order.client_email}
      paymentMethod={order.payment_method}
      createdAt={order.created_at}
      initialItems={orderItems ?? []}
    />
  )
}
