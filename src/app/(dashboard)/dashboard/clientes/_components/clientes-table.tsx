'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export type ClientRow = {
  id: string | null
  name: string
  email: string
  status: 'active' | 'inactive' | 'guest'
  order_count: number
  total_spent_cents: number
  last_order_date: string | null
  last_order_status: string | null
}

interface ClientesTableProps {
  clients: ClientRow[]
  canManage?: boolean
}

const PAGE_SIZE = 20

const statusLabel: Record<ClientRow['status'], string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  guest: 'Sem conta',
}

const statusClass: Record<ClientRow['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  inactive: 'bg-red-50 text-red-700 border border-red-200',
  guest: 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)] border border-[var(--color-border-strong)]',
}

export function ClientesTable({ clients, canManage = false }: ClientesTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState<{ id: string; action: 'toggle' | 'delete' } | null>(null)

  const filtered = clients.filter((c) =>
    [c.name, c.email, c.status, c.last_order_status ?? ''].join(' ').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const pageItems = filtered.slice(start, start + PAGE_SIZE)

  async function handleToggleStatus(client: ClientRow) {
    if (!client.id) return
    if (!confirm(client.status === 'active' ? 'Inativar este cliente?' : 'Reativar este cliente?')) return

    setBusy({ id: client.id, action: 'toggle' })
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: client.status === 'active' ? 'inactive' : 'active' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error ?? 'Falha ao atualizar status.')
        return
      }

      router.refresh()
    } catch {
      alert('Erro de rede. Tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(client: ClientRow) {
    if (!client.id) return
    if (!confirm('Excluir este cliente? A conta será removida, mas os pedidos permanecem no histórico.')) return

    setBusy({ id: client.id, action: 'delete' })
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error ?? 'Falha ao excluir cliente.')
        return
      }

      router.refresh()
    } catch {
      alert('Erro de rede. Tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Buscar por nome, e-mail ou status..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)]/40 transition-shadow"
      />

      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border-strong)]">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
            <span>Cliente</span>
            <span>Pedidos</span>
            <span>Total gasto</span>
            <span>Último pedido</span>
            <span>Status</span>
            <span>Ações</span>
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
                  ? 'Tente buscar por outro nome ou e-mail.'
                  : 'Clientes aparecem aqui quando realizam pedidos ou têm conta cadastrada.'}
              </p>
            </div>
          ) : (
            pageItems.map((client) => (
              <div
                key={client.id ?? client.email}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-[var(--color-surface)] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                    {client.name}
                  </p>
                  <p className="text-xs text-[var(--color-ink-muted)] truncate">{client.email}</p>
                </div>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  {client.order_count} pedido{client.order_count !== 1 ? 's' : ''}
                </p>
                <p className="font-display text-sm font-semibold text-[var(--color-ink)]">
                  {(client.total_spent_cents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
                <div>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    {client.last_order_date
                      ? new Date(client.last_order_date).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                  {client.last_order_status && (
                    <p className="text-xs text-[var(--color-ink-muted)] capitalize">
                      {client.last_order_status}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusClass[client.status]}`}
                >
                  {statusLabel[client.status]}
                </span>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  {client.id ? (
                    <>
                      <Link
                        href={`/dashboard/clientes/${client.id}`}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-blue)]/10 text-[var(--color-blue)] hover:bg-[var(--color-blue)]/20 transition-colors"
                      >
                        Visualizar
                      </Link>
                      {canManage && (
                        <>
                          <Link
                            href={`/dashboard/clientes/${client.id}/editar`}
                            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-gold)]/10 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/20 transition-colors"
                          >
                            Editar
                          </Link>
                          <button
                            onClick={() => handleToggleStatus(client)}
                            disabled={busy?.id === client.id}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-40 ${
                              client.status === 'active'
                                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {busy?.id === client.id && busy.action === 'toggle'
                              ? '...'
                              : client.status === 'active'
                                ? 'Inativar'
                                : 'Reativar'}
                          </button>
                          <button
                            onClick={() => handleDelete(client)}
                            disabled={busy?.id === client.id}
                            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-40"
                          >
                            {busy?.id === client.id && busy.action === 'delete' ? '...' : 'Excluir'}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-[var(--color-ink-muted)]">Sem conta</span>
                  )}
                </div>
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
