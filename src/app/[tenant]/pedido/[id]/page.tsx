import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'

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

  const isPaid = order.status === 'paid'

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          {isPaid ? '✅ Pedido Confirmado' : '⏳ Aguardando Pagamento'}
        </h1>
        <p className="text-muted-foreground">Pedido #{order.id.slice(0, 8)}</p>
      </div>

      <div className="border rounded p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">E-mail</span>
          <span>{order.client_email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span>
            {(order.total_cents / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pagamento</span>
          <span>{order.payment_method === 'pix' ? 'PIX' : 'Cartão'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span
            className={isPaid ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}
          >
            {isPaid ? 'Pago' : 'Pendente'}
          </span>
        </div>
      </div>

      {isPaid && (
        <div className="space-y-3">
          <h2 className="font-semibold">Downloads</h2>
          <p className="text-sm text-muted-foreground">
            {orderItems?.length ?? 0} foto(s) disponíveis para download.
          </p>
          <a
            href={`/api/orders/${order.id}/download`}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium"
          >
            Baixar Fotos
          </a>
        </div>
      )}

      {!isPaid && (
        <p className="text-sm text-muted-foreground">
          Após o pagamento confirmado, seus downloads aparecerão aqui. Esta página atualiza
          automaticamente.
        </p>
      )}
    </div>
  )
}
