'use client'

import { useState } from 'react'

type Props = {
  tenantId: string
  currentOverride: number | null
  globalRate: number
}

export function CommissionOverrideSection({ tenantId, currentOverride, globalRate }: Props) {
  const [value, setValue] = useState<string>(
    currentOverride !== null ? String(currentOverride) : ''
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)

    const override_percent = value === '' ? null : Number(value)

    if (override_percent !== null && (isNaN(override_percent) || override_percent < 0 || override_percent > 100)) {
      setError('Informe um valor entre 0 e 100, ou deixe em branco para usar a taxa global.')
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/commission`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ override_percent }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Erro ao salvar.')
      } else {
        setSaved(true)
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const effectiveRate = value === '' ? globalRate : (Number(value) || globalRate)

  return (
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
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1">
              Taxa Global
            </p>
            <p className="text-2xl font-bold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
              {globalRate}%
            </p>
          </div>
          {currentOverride !== null && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-gold)] mb-1">
                Override Atual
              </p>
              <p className="text-2xl font-bold text-[var(--color-gold)]" style={{ fontFamily: 'var(--font-display)' }}>
                {currentOverride}%
              </p>
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="commission_override"
            className="block text-sm font-medium text-[var(--color-ink)] mb-1.5"
          >
            Override de comissão (%)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="commission_override"
              type="number"
              min={0}
              max={100}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setSaved(false)
                setError(null)
              }}
              placeholder={`${globalRate} (global)`}
              className="w-32 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
            Deixe em branco para usar a taxa global ({globalRate}%). Taxa efetiva atual:{' '}
            <strong>{effectiveRate}%</strong>
          </p>
        </div>

        {saved && (
          <p className="text-sm font-medium text-[var(--color-success)]">Override salvo com sucesso.</p>
        )}
        {error && (
          <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
        )}
      </div>
    </div>
  )
}
