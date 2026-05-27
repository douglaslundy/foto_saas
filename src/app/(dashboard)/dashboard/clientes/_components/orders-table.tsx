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

interface OrdersTableProps {
  orders: OrderRow[]
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const [search, setSearch] = useState('')

  const filtered = orders.filter(
    (o) =>
      o.client_email.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase())
  )

  const statusLabel: Record<string, string> = {
    paid: 'Pago',
    pending: 'Pendente',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
  }

  const statusClass: Record<string, string> = {
    paid: 'text-green-600 bg-green-50',
    pending: 'text-yellow-700 bg-yellow-50',
    cancelled: 'text-red-600 bg-red-50',
    refunded: 'text-gray-600 bg-gray-100',
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Buscar por email ou ID do pedido..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm bg-background"
      />

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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((order) => (
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
    </div>
  )
}
