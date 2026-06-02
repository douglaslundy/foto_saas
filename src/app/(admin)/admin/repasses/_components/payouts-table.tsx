'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Payout = {
  id: string
  amount_cents: number
  status: string
  period_start: string
  period_end: string
  note: string | null
  paid_at: string | null
  created_at: string
  tenants: { id: string; name: string; slug: string } | null
}

type Tenant = { id: string; name: string; slug: string }

const inputClass =
  'h-10 px-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent'

export function PayoutsTable({ payouts, tenants }: { payouts: Payout[]; tenants: Tenant[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ tenant_id: '', amount: '', period_start: '', period_end: '', note: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    const amountCents = Math.round(parseFloat(form.amount.replace(',', '.')) * 100)
    if (isNaN(amountCents) || amountCents <= 0) {
      setCreateError('Valor inválido.')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: form.tenant_id,
          amount_cents: amountCents,
          period_start: form.period_start,
          period_end: form.period_end,
          note: form.note || undefined,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setCreateError(data.error ?? 'Erro ao registrar repasse.')
      } else {
        setForm({ tenant_id: '', amount: '', period_start: '', period_end: '', note: '' })
        router.refresh()
      }
    } catch {
      setCreateError('Erro de rede. Tente novamente.')
    } finally {
      setCreating(false)
    }
  }

  async function markPaid(id: string) {
    setProcessing(id)
    try {
      await fetch(`/api/admin/payouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })
      router.refresh()
    } finally {
      setProcessing(null)
    }
  }

  const pending = payouts.filter((p) => p.status === 'pending')
  const paid = payouts.filter((p) => p.status === 'paid')

  const formatBRL = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  return (
    <div className="space-y-6">
      {/* Formulário de registro */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
            Registrar Repasse
          </h2>
        </div>
        <form onSubmit={handleCreate} className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Fotógrafo *</label>
            <select
              value={form.tenant_id}
              onChange={(e) => setForm((f) => ({ ...f, tenant_id: e.target.value }))}
              className={inputClass}
              required
            >
              <option value="">Selecione...</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className={inputClass}
              placeholder="0,00"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Início do período *</label>
            <input
              type="date"
              value={form.period_start}
              onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Fim do período *</label>
            <input
              type="date"
              value={form.period_end}
              onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Observação</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className={inputClass}
              placeholder="Opcional"
            />
          </div>
          <div className="flex flex-col justify-end gap-2">
            {createError && <p className="text-xs text-[var(--color-danger)]">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="h-10 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {creating ? 'Registrando...' : '+ Registrar repasse'}
            </button>
          </div>
        </form>
      </div>

      {/* Pendentes */}
      {pending.length > 0 && (
        <div
          className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="px-6 py-4 border-b border-[var(--color-border-strong)] flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
              Repasses Pendentes
            </h2>
            <span className="text-xs font-bold bg-[var(--color-gold)] text-[var(--color-ink)] px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {pending.map((p) => (
              <div key={p.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-ink)]">{p.tenants?.name ?? '—'}</p>
                  <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
                    {formatDate(p.period_start)} – {formatDate(p.period_end)}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-display text-lg font-bold text-[var(--color-ink)]">
                    {formatBRL(p.amount_cents)}
                  </span>
                  <button
                    onClick={() => markPaid(p.id)}
                    disabled={processing === p.id}
                    className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-colors disabled:opacity-40"
                  >
                    {processing === p.id ? '...' : 'Marcar como pago'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div
          className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-8 text-center"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <p className="text-[var(--color-ink-muted)] text-sm">Nenhum repasse pendente.</p>
        </div>
      )}

      {/* Histórico */}
      {paid.length > 0 && (
        <div
          className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
              Histórico de Repasses
            </h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {paid.slice(0, 30).map((p) => (
              <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--color-ink)]">{p.tenants?.name ?? '—'}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    Pago em {p.paid_at ? formatDate(p.paid_at) : '—'} · {formatDate(p.period_start)} – {formatDate(p.period_end)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--color-success)]">
                  {formatBRL(p.amount_cents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
