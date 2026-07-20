'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'

export function StatusToggleButton({
  tenantId,
  currentStatus,
}: {
  tenantId: string
  currentStatus: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()
  const [loading, setLoading] = useState(false)
  const isActive = currentStatus === 'active'
  const nextStatus = isActive ? 'suspended' : 'active'

  async function handleClick() {
    const ok = await confirm({
      title: isActive ? 'Suspender conta' : 'Reativar conta',
      description: isActive ? 'Suspender esta conta?' : 'Reativar esta conta?',
      confirmLabel: isActive ? 'Suspender' : 'Reativar',
      variant: isActive ? 'destructive' : 'default',
    })
    if (!ok) return
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
      toast({ title: 'Erro', description: data.error ?? 'Falha ao atualizar status.', variant: 'destructive' })
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold border transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5 ${
        isActive
          ? 'text-[var(--color-danger)] border-[var(--color-danger)]/30 hover:bg-[var(--color-danger)]/8'
          : 'text-[var(--color-success)] border-[var(--color-success)]/30 hover:bg-[var(--color-success)]/8'
      }`}
    >
      {loading ? 'Aguarde...' : isActive ? 'Suspender conta' : 'Reativar conta'}
    </button>
  )
}
