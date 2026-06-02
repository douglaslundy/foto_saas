'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type OrderRow = {
  id: string
  client_email: string
  total_cents: number
  payment_method: string
  status: string
  created_at: string
}

interface OrdersTableProps {
  orders: OrderRow[]
}

const statusLabel: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  delivered: 'Entregue',
}

const statusClass: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  cancelled: 'bg-red-50 text-red-600 border border-red-200',
  refunded:
    'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)] border border-[var(--color-border-strong)]',
  delivered: 'bg-blue-50 text-blue-700 border border-blue-200',
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [delivering, setDelivering] = useState<string | null>(null)

  const filtered = orders.filter(
    (o) =>
      o.client_email.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase())
  )

  async function handleDeliver(orderId: string) {
    if (!confirm('Enviar fotos por email para o cliente?')) return
    setDelivering(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}/deliver`, { method: 'POST' })
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string }
      if (!res.ok) {
        alert(data.error ?? 'Erro ao entregar fotos.')
      } else {
        router.refresh()
      }
    } catch {
      alert('Erro de rede. Tente novamente.')
    } finally {
      setDelivering(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="search"
        placeholder="Buscar por e-mail ou ID do pedido..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/40 transition-shadow"
      />

      {/* Table card */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        {/* Table header */}
        <div className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border-strong)]">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
            <span>E-mail</span>
            <span>Pedido</span>
            <span>Valor</span>
            <span>Pagamento</span>
            <span>Status</span>
            <span>Data</span>
            <span>Ação</span>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[var(--color-border)]">
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <svg
                className="mx-auto mb-4 text-[var(--color-ink-muted)]"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.4"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p className="font-display text-lg font-semibold text-[var(--color-ink)]">
                Nenhum pedido encontrado.
              </p>
              <p className="text-[var(--color-ink-muted)] text-sm mt-1">
                {search
                  ? 'Tente buscar por outro e-mail ou ID.'
                  : 'Pedidos aparecem aqui quando clientes realizam compras.'}
              </p>
            </div>
          ) : (
            filtered.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-[var(--color-surface)] transition-colors"
              >
                <p className="text-sm text-[var(--color-ink)] truncate">{order.client_email}</p>
                <p className="font-mono text-xs text-[var(--color-ink-muted)]">
                  {order.id.slice(0, 8)}
                </p>
                <p className="font-display text-sm font-semibold text-[var(--color-ink)]">
                  {(order.total_cents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  {order.payment_method === 'pix' ? 'PIX' : 'Cartão'}
                </p>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    statusClass[order.status] ??
                    'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)] border border-[var(--color-border-strong)]'
                  }`}
                >
                  {statusLabel[order.status] ?? order.status}
                </span>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  {new Date(order.created_at).toLocaleDateString('pt-BR')}
                </p>
                {/* Delivery action */}
                <div className="shrink-0">
                  {order.status === 'paid' && (
                    <button
                      onClick={() => handleDeliver(order.id)}
                      disabled={delivering === order.id}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-blue)]/10 text-[var(--color-blue)] hover:bg-[var(--color-blue)]/20 transition-colors disabled:opacity-40"
                    >
                      {delivering === order.id ? 'Enviando...' : 'Entregar fotos'}
                    </button>
                  )}
                  {order.status === 'delivered' && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
                      Entregue
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
