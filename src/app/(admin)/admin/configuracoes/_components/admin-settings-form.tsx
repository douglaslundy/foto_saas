'use client'

import { useState } from 'react'

type Settings = {
  global_commission_percent: string
  stripe_secret_key: string
  stripe_publishable_key: string
  mercadopago_access_token: string
}

export function AdminSettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const [values, setValues] = useState<Settings>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(key: keyof Settings, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Erro ao salvar configurações.')
      } else {
        setSaved(true)
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      {/* Section 1 — Commission */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2
            className="text-lg font-semibold text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Comissão
          </h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label
              htmlFor="global_commission_percent"
              className="block text-sm font-medium text-[var(--color-ink)] mb-1.5"
            >
              Comissão global (%)
            </label>
            <input
              id="global_commission_percent"
              type="number"
              min={0}
              max={100}
              value={values.global_commission_percent}
              onChange={(e) => handleChange('global_commission_percent', e.target.value)}
              className="w-32 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent"
            />
            <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
              Taxa padrão cobrada em todas as vendas. Pode ser sobrescrita por fotógrafo.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2 — Payments */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2
            className="text-lg font-semibold text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Pagamentos
          </h2>
        </div>
        <div className="px-6 py-5 space-y-5">
          {/* Warning banner */}
          <div className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/8 px-4 py-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--color-gold)]"
            >
              <path
                d="M8 2L14.5 13.5H1.5L8 2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
            </svg>
            <p className="text-xs font-medium text-[var(--color-gold)]">
              Atenção: estas chaves são sensíveis. Não compartilhe com ninguém.
            </p>
          </div>

          <div>
            <label
              htmlFor="stripe_secret_key"
              className="block text-sm font-medium text-[var(--color-ink)] mb-1.5"
            >
              Stripe Secret Key
            </label>
            <input
              id="stripe_secret_key"
              type="password"
              autoComplete="off"
              value={values.stripe_secret_key}
              onChange={(e) => handleChange('stripe_secret_key', e.target.value)}
              placeholder="sk_live_..."
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="stripe_publishable_key"
              className="block text-sm font-medium text-[var(--color-ink)] mb-1.5"
            >
              Stripe Publishable Key
            </label>
            <input
              id="stripe_publishable_key"
              type="text"
              autoComplete="off"
              value={values.stripe_publishable_key}
              onChange={(e) => handleChange('stripe_publishable_key', e.target.value)}
              placeholder="pk_live_..."
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="mercadopago_access_token"
              className="block text-sm font-medium text-[var(--color-ink)] mb-1.5"
            >
              MercadoPago Access Token
            </label>
            <input
              id="mercadopago_access_token"
              type="password"
              autoComplete="off"
              value={values.mercadopago_access_token}
              onChange={(e) => handleChange('mercadopago_access_token', e.target.value)}
              placeholder="APP_USR-..."
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent font-mono"
            />
          </div>
        </div>
      </div>

      {/* Submit row */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>

        {saved && (
          <span className="text-sm font-medium text-[var(--color-success)]">
            Configurações salvas com sucesso.
          </span>
        )}

        {error && (
          <span className="text-sm font-medium text-[var(--color-danger)]">{error}</span>
        )}
      </div>
    </form>
  )
}
