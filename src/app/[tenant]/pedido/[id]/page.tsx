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
  const { tenant: tenantSlug, id } = await params
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

  const isPaid = order.status === 'paid' || order.status === 'delivered'
  const isPending = order.status === 'pending' || order.status === 'processing'
  const isFailed = order.status === 'failed'
  const downloadUrl = `/api/orders/${order.id}/download`
  const checkoutHref = `/${tenantSlug}/checkout`

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex flex-col">
      {/* Minimal header */}
      <header className="border-b border-[var(--color-border)] px-6 py-4 flex items-center gap-3 bg-[var(--color-card)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-ink)] flex items-center justify-center text-white text-sm">
          📷
        </div>
        <span className="font-display font-bold text-[var(--color-ink)]">FotoSaaS</span>
      </header>

      {/* Card principal */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className="w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-8 text-center"
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          {/* Pago / entregue */}
          {isPaid && (
            <>
              <div className="w-16 h-16 rounded-full bg-[var(--color-gold)] flex items-center justify-center mx-auto mb-4">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="font-display text-2xl font-bold text-[var(--color-ink)] mb-2">
                Pedido confirmado!
              </h2>
              <p className="text-[var(--color-ink-muted)] text-sm mb-2">
                Suas fotos estão prontas para download
              </p>
              <p className="text-xs text-[var(--color-ink-muted)] mb-6">
                {(orderItems?.length ?? 0)} foto(s) disponíveis • enviado para{' '}
                <span className="font-medium text-[var(--color-ink)]">{order.client_email}</span>
              </p>
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Baixar fotos (ZIP)
              </a>
            </>
          )}

          {/* Pendente / processando */}
          {isPending && (
            <>
              <div
                className="w-16 h-16 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin mx-auto mb-4"
                aria-label="Processando..."
              />
              <h2 className="font-display text-2xl font-bold text-[var(--color-ink)] mb-2">
                Processando pedido...
              </h2>
              <p className="text-[var(--color-ink-muted)] text-sm mb-6">
                Aguarde enquanto confirmamos o pagamento. Esta página atualiza automaticamente.
              </p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                Pedido <span className="font-medium">#{order.id.slice(0, 8)}</span>
              </p>
            </>
          )}

          {/* Falhou */}
          {isFailed && (
            <>
              <div className="w-16 h-16 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-[var(--color-danger)] text-2xl leading-none">✕</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-[var(--color-ink)] mb-2">
                Pagamento não confirmado
              </h2>
              <p className="text-[var(--color-ink-muted)] text-sm mb-6">
                Tente novamente ou escolha outro método de pagamento.
              </p>
              <a
                href={checkoutHref}
                className="inline-flex px-6 py-3 rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white font-semibold hover:-translate-y-0.5 transition-all duration-200"
              >
                Tentar novamente
              </a>
            </>
          )}

          {/* Status desconhecido — fallback */}
          {!isPaid && !isPending && !isFailed && (
            <>
              <p className="text-[var(--color-ink-muted)] text-sm mb-2">
                Status do pedido: <strong>{order.status}</strong>
              </p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                Pedido <span className="font-medium">#{order.id.slice(0, 8)}</span>
              </p>
            </>
          )}

          {/* Detalhes adicionais (sempre visíveis) */}
          <div className="mt-8 pt-6 border-t border-[var(--color-border)] text-left space-y-2 text-sm">
            <div className="flex justify-between text-[var(--color-ink-muted)]">
              <span>E-mail</span>
              <span className="text-[var(--color-ink)]">{order.client_email}</span>
            </div>
            <div className="flex justify-between text-[var(--color-ink-muted)]">
              <span>Total</span>
              <span className="text-[var(--color-ink)] font-display font-semibold">
                {(order.total_cents / 100).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
            </div>
            <div className="flex justify-between text-[var(--color-ink-muted)]">
              <span>Pagamento</span>
              <span className="text-[var(--color-ink)]">
                {order.payment_method === 'pix' ? 'PIX' : 'Cartão'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
