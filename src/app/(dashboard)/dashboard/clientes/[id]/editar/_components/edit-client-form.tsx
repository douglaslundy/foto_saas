'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'

type Props = {
  clientId: string
  initialName: string
  initialEmail: string
  initialPhone: string
  initialCpf: string
  initialActive: boolean
}

export function EditClientForm({ clientId, initialName, initialEmail, initialPhone, initialCpf, initialActive }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [cpf, setCpf] = useState(initialCpf)
  const [active, setActive] = useState(initialActive)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resettingPassword, setResettingPassword] = useState(false)

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
          phone,
          cpf,
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

  async function handleResetPassword() {
    const ok = await confirm({
      title: 'Redefinir senha do cliente',
      description: 'Uma nova senha temporária será gerada e enviada por e-mail (e WhatsApp, se cadastrado) para este cliente. A senha atual deixará de funcionar.',
      confirmLabel: 'Redefinir senha',
    })
    if (!ok) return

    setResettingPassword(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/reset-password`, { method: 'POST' })
      if (res.ok) {
        toast({ title: 'Senha redefinida e enviada ao cliente', variant: 'success' })
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: 'Erro ao redefinir senha', description: (data as { error?: string }).error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erro de conexão ao redefinir senha', variant: 'destructive' })
    } finally {
      setResettingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
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

        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)] mb-2">
            WhatsApp
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(35) 99999-9999"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)]/40"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)] mb-2">
            CPF
          </label>
          <input
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
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

      <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6 space-y-3">
        <h2 className="font-display text-sm font-semibold text-[var(--color-ink)]">Acesso</h2>
        <p className="text-xs text-[var(--color-ink-muted)]">
          O cliente pode alterar a própria senha em &quot;Meus dados&quot;. Se ele esqueceu ou perdeu acesso, gere uma nova senha temporária aqui.
        </p>
        <button
          type="button"
          onClick={handleResetPassword}
          disabled={resettingPassword}
          className="px-4 py-2 rounded-full border border-[var(--color-border-strong)] text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] transition-colors disabled:opacity-50"
        >
          {resettingPassword ? 'Redefinindo...' : 'Redefinir senha'}
        </button>
      </div>
    </div>
  )
}
