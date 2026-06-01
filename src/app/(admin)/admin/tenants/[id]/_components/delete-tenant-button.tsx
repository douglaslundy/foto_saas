'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function DeleteTenantButton({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    const confirmed = window.confirm(
      'Tem certeza? Esta ação é irreversível e remove todos os eventos, fotos e pedidos.'
    )
    if (!confirmed) return

    setLoading(true)
    const res = await fetch(`/api/admin/tenants/${tenantId}`, { method: 'DELETE' })
    if (res.ok) {
      window.location.href = '/admin/tenants'
    } else {
      const data = await res.json()
      alert(data.error ?? 'Erro ao excluir tenant.')
      setLoading(false)
    }
  }

  return (
    <Button variant="destructive" onClick={handleDelete} disabled={loading}>
      {loading ? 'Excluindo...' : 'Excluir Tenant'}
    </Button>
  )
}
