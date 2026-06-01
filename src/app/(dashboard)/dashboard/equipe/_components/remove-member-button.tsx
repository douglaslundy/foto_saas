'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RemoveMemberButton({ memberId }: { memberId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRemove() {
    if (!confirm('Remover este colaborador da equipe?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/team/${memberId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error ?? 'Erro ao remover colaborador.')
      }
    } catch {
      alert('Erro de rede. Tente novamente.')
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
