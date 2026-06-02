'use client'

import { useState } from 'react'

type OrderRow = {
  id: string
  client_email: string
  total_cents: number
  payment_method: string
  status: string
  created_at: string
}

interface ClientesTableProps {
  orders: OrderRow[]
}

const PAGE_SIZE = 20

const statusLabel: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
}

const statusClass: Record<string, string> = {
  paid: 'text-[var(--color-success)] bg-[var(--color-success)]/10',
  pending: 'text-amber-600 bg-amber-100',
  cancelled: 'text-[var(--color-danger)] bg-[var(--color-danger)]/10',
  refunded: 'text-[var(--color-ink-muted)] bg-[var(--color-surface-alt)]',
}

export function ClientesTable({ orders }: ClientesTableProps) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const pageItems = orders.slice(start, start + PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">E-mail</th>
              <th className="px-4 py-2 text-left font-medium">Pedido</th>
              <th className="px-4 py-2 text-left font-medium">Valor</th>
              <th className="px-4 py-2 text-left font-medium">Pagamento</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            ) : (
              pageItems.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3">{order.client_email}</td>
                  <td className="px-4 py-3 font-mono text-xs">{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium">
                    {(order.total_cents / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {order.payment_method === 'pix' ? 'PIX' : 'Cartão'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass[order.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {statusLabel[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/60 transition-colors"
          >
            ← Anterior
          </button>

          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/60 transition-colors"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
