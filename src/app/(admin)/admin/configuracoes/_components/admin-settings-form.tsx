'use client'

import { useState } from 'react'

type Settings = {
  global_commission_percent: string
  stripe_secret_key: string
  stripe_publishable_key: string
  mercadopago_access_token: string
  auto_approve_sub_events: string
  platform_name: string
  platform_favicon_url: string
  photo_compression_enabled: string
}

export function AdminSettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const [values, setValues] = useState<Settings>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [faviconUploading, setFaviconUploading] = useState(false)
  const [faviconError, setFaviconError] = useState<string | null>(null)

  function handleChange(key: keyof Settings, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    setError(null)
  }

  async function handleFaviconFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFaviconUploading(true)
    setFaviconError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/platform/favicon', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setFaviconError(data.error ?? 'Erro ao fazer upload.'); return }
      setValues((prev) => ({ ...prev, platform_favicon_url: data.url }))
    } catch {
      setFaviconError('Erro de conexão.')
    } finally {
      setFaviconUploading(false)
    }
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
      {/* Section 0 — Identidade */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2
            className="text-lg font-semibold text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Identidade da Plataforma
          </h2>
        </div>
        <div className="px-6 py-5 space-y-5">
          {/* Nome */}
          <div>
            <label htmlFor="platform_name" className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
              Nome da plataforma
            </label>
            <input
              id="platform_name"
              type="text"
              value={values.platform_name}
              onChange={(e) => handleChange('platform_name', e.target.value)}
              placeholder="FotoSaaS"
              className="w-full max-w-xs rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
              Aparece no cabeçalho do admin, login e homepage.
            </p>
          </div>

          {/* Favicon */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
              Favicon global
            </label>
            {values.platform_favicon_url && (
              <div className="mb-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={values.platform_favicon_url} alt="Favicon atual" className="w-8 h-8 object-contain border border-[var(--color-border)] rounded" />
                <span className="text-xs text-[var(--color-ink-muted)]">Favicon atual</span>
              </div>
            )}
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-[var(--color-ink-muted)] mb-1 block">Upload de arquivo (PNG, ICO, SVG, JPG — máx. 512 KB)</label>
                <input
                  type="file"
                  accept=".png,.ico,.svg,.jpg,.jpeg"
                  onChange={handleFaviconFileUpload}
                  disabled={faviconUploading}
                  className="text-sm text-[var(--color-ink)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[var(--color-surface-alt)] file:text-[var(--color-ink)] hover:file:opacity-80 disabled:opacity-50"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-ink-muted)]">ou</span>
              </div>
              <div>
                <label htmlFor="platform_favicon_url" className="text-xs font-medium text-[var(--color-ink-muted)] mb-1 block">URL externa</label>
                <input
                  id="platform_favicon_url"
                  type="url"
                  value={values.platform_favicon_url}
                  onChange={(e) => handleChange('platform_favicon_url', e.target.value)}
                  placeholder="https://exemplo.com/favicon.ico"
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent font-mono"
                />
              </div>
              {faviconUploading && <p className="text-xs text-[var(--color-ink-muted)]">Fazendo upload…</p>}
              {faviconError && <p className="text-xs text-[var(--color-danger)]">{faviconError}</p>}
            </div>
          </div>
        </div>
      </div>

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
              className="w-32 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
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
          <div className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-blue)]/40 bg-[var(--color-blue)]/8 px-4 py-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--color-blue)]"
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
            <p className="text-xs font-medium text-[var(--color-blue)]">
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
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent font-mono"
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
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent font-mono"
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
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent font-mono"
            />
          </div>
        </div>
      </div>

      {/* Seção — Sub-fotógrafos */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2
            className="text-lg font-semibold text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Sub-fotógrafos
          </h2>
        </div>
        <div className="px-6 py-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={values.auto_approve_sub_events === 'true'}
              onChange={(e) =>
                handleChange('auto_approve_sub_events', e.target.checked ? 'true' : 'false')
              }
              className="mt-0.5 w-4 h-4 accent-[var(--color-blue)]"
            />
            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">
                Aprovação automática de eventos
              </p>
              <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
                Quando ativado, eventos criados por sub-fotógrafos ficam como rascunho automaticamente,
                sem necessidade de aprovação manual pelo fotógrafo.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Seção — Fotos */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2
            className="text-lg font-semibold text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Fotos
          </h2>
        </div>
        <div className="px-6 py-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={values.photo_compression_enabled !== 'false'}
              onChange={(e) =>
                handleChange('photo_compression_enabled', e.target.checked ? 'true' : 'false')
              }
              className="mt-0.5 w-4 h-4 accent-[var(--color-blue)]"
            />
            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">
                Comprimir fotos de exibição/venda
              </p>
              <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
                Quando ativado (padrão), a foto exibida/baixada pelo cliente é redimensionada e
                comprimida com mozjpeg — reduz bastante o tamanho do arquivo sem perda visível de
                qualidade, deixando upload e carregamento mais rápidos. Quando desativado, a foto
                é mantida na resolução e qualidade máxima do original (recomendado para estúdios
                que vendem arquivos em alta resolução de câmeras profissionais), gerando arquivos
                maiores. A miniatura da galeria (thumbnail) é sempre comprimida, independente
                desta opção.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Submit row */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
