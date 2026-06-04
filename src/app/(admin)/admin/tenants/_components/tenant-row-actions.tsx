'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  tenantId: string
  currentStatus: string
}

export function TenantRowActions({ tenantId, currentStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'status' | 'delete' | null>(null)
  const isActive = currentStatus === 'active'

  async function handleStatusToggle() {
    if (!confirm(isActive ? 'Inativar este tenant?' : 'Reativar este tenant?')) return
    setLoading('status')
    const res = await fetch(`/api/admin/tenants/${tenantId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: isActive ? 'suspended' : 'active' }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert((data as { error?: string }).error ?? 'Falha ao atualizar status.')
    }
    setLoading(null)
  }

  async function handleDelete() {
    if (!confirm('Excluir este tenant? Esta ação remove usuários, eventos, fotos e pedidos.')) return
    setLoading('delete')
    const res = await fetch(`/api/admin/tenants/${tenantId}`, { method: 'DELETE' })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert((data as { error?: string }).error ?? 'Falha ao excluir tenant.')
    }
    setLoading(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/admin/tenants/${tenantId}/editar`}
        className="text-xs font-medium px-2.5 py-1 rounded border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-alt)] transition-colors text-[var(--color-ink-soft)]"
      >
        Editar
      </Link>
      <Link
        href={`/admin/tenants/${tenantId}`}
        className="text-xs font-medium px-2.5 py-1 rounded border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-alt)] transition-colors text-[var(--color-ink-soft)]"
      >
        Ver
      </Link>
      <button
        onClick={handleStatusToggle}
        disabled={loading !== null}
        className={`text-xs font-medium px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${
          isActive
            ? 'border-[var(--color-warning,#d97706)] text-[var(--color-warning,#d97706)] hover:bg-[var(--color-warning,#d97706)]/10'
            : 'border-[var(--color-success)] text-[var(--color-success)] hover:bg-[var(--color-success)]/10'
        }`}
      >
        {loading === 'status' ? '...' : isActive ? 'Inativar' : 'Ativar'}
      </button>
      <button
        onClick={handleDelete}
        disabled={loading !== null}
        className="text-xs font-medium px-2.5 py-1 rounded border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors disabled:opacity-50"
      >
        {loading === 'delete' ? '...' : 'Excluir'}
      </button>
    </div>
  )
}
