'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'

export function DeleteTenantButton({ tenantId }: { tenantId: string }) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    const confirmed = await confirm({
      title: 'Excluir tenant',
      description: 'Tem certeza? Esta ação é irreversível e remove todos os eventos, fotos e pedidos.',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    })
    if (!confirmed) return

    setLoading(true)
    const res = await fetch(`/api/admin/tenants/${tenantId}`, { method: 'DELETE' })
    if (res.ok) {
      window.location.href = '/admin/tenants'
    } else {
      const data = await res.json()
      toast({ title: 'Erro ao excluir tenant', description: data.error, variant: 'destructive' })
      setLoading(false)
    }
  }

  return (
    <Button variant="destructive" onClick={handleDelete} disabled={loading}>
      {loading ? 'Excluindo...' : 'Excluir Tenant'}
    </Button>
  )
}
