'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'

type Props = {
  reviewId: string
  initialPassword: string | null
}

export function ReviewPasswordCard({ reviewId, initialPassword }: Props) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [password, setPassword] = useState(initialPassword ?? '')
  const [customInput, setCustomInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleRegenerate() {
    const ok = await confirm({
      title: 'Gerar nova senha',
      description: 'Uma nova senha será gerada. A senha atual deixará de funcionar para o cliente.',
      confirmLabel: 'Gerar nova senha',
    })
    if (!ok) return
    await save(undefined)
  }

  async function handleSetCustom(e: React.FormEvent) {
    e.preventDefault()
    if (!customInput.trim()) return
    await save(customInput.trim())
  }

  async function save(newPassword: string | undefined) {
    setSaving(true)
    try {
      const res = await fetch(`/api/essay-reviews/${reviewId}/access-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: newPassword ? JSON.stringify({ password: newPassword }) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setPassword((data as { access_password: string }).access_password)
        setCustomInput('')
        toast({ title: 'Senha do ensaio atualizada', variant: 'success' })
      } else {
        toast({ title: 'Erro ao atualizar senha', description: (data as { error?: string }).error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erro de conexão ao atualizar senha', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)] mb-2">
        Senha de acesso do ensaio
      </p>
      <p className="text-xs text-[var(--color-ink-muted)] mb-3">
        O cliente pode ver e selecionar as fotos usando só essa senha, sem precisar criar conta.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-sm font-mono tracking-widest text-[var(--color-ink)]">
          {password || '—'}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!password}
          className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-xs font-medium hover:bg-[var(--color-surface-alt)] transition-colors disabled:opacity-50"
        >
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={saving}
          className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-xs font-medium hover:bg-[var(--color-surface-alt)] transition-colors disabled:opacity-50"
        >
          {saving ? 'Gerando...' : 'Gerar nova senha'}
        </button>
        <form onSubmit={handleSetCustom} className="flex items-center gap-1.5">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Definir senha personalizada"
            className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-xs w-48 focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)]/40"
          />
          <button
            type="submit"
            disabled={saving || !customInput.trim()}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-blue)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Definir
          </button>
        </form>
      </div>
    </div>
  )
}
