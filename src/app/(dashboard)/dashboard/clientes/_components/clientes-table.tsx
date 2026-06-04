'use client'

import { useState } from 'react'

export type ClientRow = {
  email: string
  order_count: number
  total_spent_cents: number
  last_order_date: string
}

interface ClientesTableProps {
  clients: ClientRow[]
}

const PAGE_SIZE = 20

export function ClientesTable({ clients }: ClientesTableProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = clients.filter((c) =>
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const pageItems = filtered.slice(start, start + PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="search"
        placeholder="Buscar por e-mail..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)]/40 transition-shadow"
      />

      {/* Table */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border-strong)]">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
            <span>E-mail</span>
            <span>Pedidos</span>
            <span>Total gasto</span>
            <span>Último pedido</span>
          </div>
        </div>

        <div className="divide-y divide-[var(--color-border)]">
          {pageItems.length === 0 ? (
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
                Nenhum cliente encontrado.
              </p>
              <p className="text-[var(--color-ink-muted)] text-sm mt-1">
                {search
                  ? 'Tente buscar por outro e-mail.'
                  : 'Clientes aparecem aqui quando realizam compras.'}
              </p>
            </div>
          ) : (
            pageItems.map((client) => (
              <div
                key={client.email}
                className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-6 py-4 items-center hover:bg-[var(--color-surface)] transition-colors"
              >
                <p className="text-sm text-[var(--color-ink)] truncate">{client.email}</p>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  {client.order_count} pedido{client.order_count !== 1 ? 's' : ''}
                </p>
                <p className="font-display text-sm font-semibold text-[var(--color-ink)]">
                  {(client.total_spent_cents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  {new Date(client.last_order_date).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ))
          )}
        </div>
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
          <span className="text-[var(--color-ink-muted)]">
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
