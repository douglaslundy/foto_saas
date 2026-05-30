'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function StatusToggleButton({
  tenantId,
  currentStatus,
}: {
  tenantId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isActive = currentStatus === 'active'
  const nextStatus = isActive ? 'suspended' : 'active'

  async function handleClick() {
    if (!confirm(isActive ? 'Suspender esta conta?' : 'Reativar esta conta?')) return
    setLoading(true)
    const res = await fetch(`/api/admin/tenants/${tenantId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json()
      alert(`Erro: ${data.error ?? 'Falha ao atualizar status.'}`)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`px-4 py-2 rounded text-sm font-medium border transition-colors disabled:opacity-50 ${
        isActive
          ? 'text-red-600 border-red-200 hover:bg-red-50'
          : 'text-green-600 border-green-200 hover:bg-green-50'
      }`}
    >
      {loading ? 'Aguarde...' : isActive ? 'Suspender conta' : 'Reativar conta'}
    </button>
  )
}
