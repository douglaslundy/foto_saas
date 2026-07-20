'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'

export function RemoveMemberButton({ memberId }: { memberId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()
  const [loading, setLoading] = useState(false)

  async function handleRemove() {
    const ok = await confirm({
      title: 'Remover colaborador',
      description: 'Remover este colaborador da equipe?',
      confirmLabel: 'Remover',
      variant: 'destructive',
    })
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/team/${memberId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        toast({ title: 'Erro ao remover colaborador', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erro de rede. Tente novamente.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      className="mt-4 w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-danger)]/30 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white transition-colors disabled:opacity-50"
    >
      {loading ? 'Removendo…' : 'Remover colaborador'}
    </button>
  )
}
