'use client'

import { useState } from 'react'

interface PerfilStudioFormProps {
  initial: {
    name: string
    slug: string
    custom_domain: string | null
    primary_color: string | null
    bio: string | null
  }
}

const inputClass =
  'h-11 px-4 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.12)] placeholder:text-[var(--color-ink-muted)]'
const labelClass =
  'block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)] mb-1.5'

export function PerfilStudioForm({ initial }: PerfilStudioFormProps) {
  const [name, setName] = useState(initial.name)
  const [bio, setBio] = useState(initial.bio ?? '')
  const [primaryColor, setPrimaryColor] = useState(initial.primary_color ?? '#3b82f6')
  const [customDomain, setCustomDomain] = useState(initial.custom_domain ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/tenant/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          bio: bio || null,
          primary_color: primaryColor || null,
          custom_domain: customDomain || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert('Erro: ' + (err.error ?? 'Falha ao salvar'))
      } else {
        alert('Perfil atualizado com sucesso!')
      }
    } catch {
      alert('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="px-6 py-5 border-b border-[var(--color-border-strong)]">
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Dados do Estúdio</h2>
        <p className="text-[var(--color-ink-muted)] text-sm mt-0.5">Informações públicas do seu estúdio fotográfico</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-5">
          {/* Nome do estúdio */}
          <div>
            <label htmlFor="name" className={labelClass}>
              Nome do estúdio <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do seu estúdio"
              className={inputClass}
            />
          </div>

          {/* Slug (read-only) */}
          <div>
            <label className={labelClass}>Slug (não editável)</label>
            <div className="h-11 px-4 flex items-center w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] opacity-60 text-sm font-mono text-[var(--color-ink-soft)] select-all">
              {initial.slug}
            </div>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">
              O slug identifica seu estúdio na URL e não pode ser alterado aqui.
            </p>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className={labelClass}>Bio / descrição</label>
            <textarea
              id="bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte um pouco sobre seu estúdio..."
              className="px-4 py-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.12)] placeholder:text-[var(--color-ink-muted)] resize-y"
            />
          </div>

          {/* Cor principal */}
          <div>
            <label htmlFor="primary_color" className={labelClass}>Cor principal</label>
            <div className="flex items-center gap-3">
              <input
                id="primary_color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-11 w-16 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] p-1 bg-[var(--color-surface)]"
              />
              <span className="text-sm font-mono text-[var(--color-ink-soft)]">{primaryColor}</span>
            </div>
          </div>

          {/* Domínio personalizado */}
          <div>
            <label htmlFor="custom_domain" className={labelClass}>Domínio personalizado</label>
            <input
              id="custom_domain"
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="fotos.meusite.com.br"
              className={inputClass}
            />
            <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">
              Configure seu DNS para apontar para o servidor antes de salvar.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60"
          >
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
