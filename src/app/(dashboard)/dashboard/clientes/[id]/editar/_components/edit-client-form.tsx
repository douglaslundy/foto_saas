'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  clientId: string
  initialName: string
  initialEmail: string
  initialActive: boolean
}

export function EditClientForm({ clientId, initialName, initialEmail, initialActive }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [active, setActive] = useState(initialActive)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          status: active ? 'active' : 'inactive',
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Falha ao salvar cliente.')
        return
      }

      router.push(`/dashboard/clientes/${clientId}`)
      router.refresh()
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6 space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)] mb-2">
          Nome
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)]/40"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)] mb-2">
          E-mail
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)]/40"
        />
      </div>

      <label className="flex items-center gap-3 text-sm text-[var(--color-ink)]">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--color-border-strong)]"
        />
        Cliente ativo
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-full bg-[var(--color-blue)] text-white text-sm font-semibold hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
