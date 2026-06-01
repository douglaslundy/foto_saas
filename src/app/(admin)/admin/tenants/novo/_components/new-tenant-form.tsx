'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function NewTenantForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    tenantName: '',
    slug: '',
    photographerName: '',
    email: '',
    password: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'tenantName') {
        next.slug = value
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erro ao criar fotógrafo.')
      setLoading(false)
      return
    }
    router.push('/admin/tenants')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Dados do estúdio */}
      <div className="px-6 py-4 border-b border-[var(--color-border-strong)] bg-[var(--color-surface-alt)]">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)]">
          Dados do Estúdio
        </p>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tenantName" className="text-sm font-medium text-[var(--color-ink)]">
            Nome da empresa / estúdio *
          </Label>
          <Input
            id="tenantName"
            name="tenantName"
            value={form.tenantName}
            onChange={handleChange}
            placeholder="Ex: Studio Silva Fotografia"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug" className="text-sm font-medium text-[var(--color-ink)]">
            Slug (URL pública) *
          </Label>
          <Input
            id="slug"
            name="slug"
            value={form.slug}
            onChange={handleChange}
            placeholder="studio-silva"
            required
          />
          <p className="text-xs text-[var(--color-ink-muted)]">
            Usado na URL pública:{' '}
            <span className="font-mono text-[var(--color-ink-soft)]">
              {form.slug || 'studio-silva'}.seudominio.com
            </span>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="photographerName" className="text-sm font-medium text-[var(--color-ink)]">
            Nome do fotógrafo responsável
          </Label>
          <Input
            id="photographerName"
            name="photographerName"
            value={form.photographerName}
            onChange={handleChange}
            placeholder="Ex: João Silva"
          />
        </div>
      </div>

      {/* Credenciais */}
      <div className="px-6 py-4 border-t border-b border-[var(--color-border-strong)] bg-[var(--color-surface-alt)]">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)]">
          Credenciais de Acesso
        </p>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-[var(--color-ink)]">
            E-mail de login *
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="joao@studiosilva.com"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-[var(--color-ink)]">
            Senha inicial *
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Mínimo 6 caracteres"
            required
            minLength={6}
          />
          <p className="text-xs text-[var(--color-ink-muted)]">
            O fotógrafo pode alterar a senha após o primeiro acesso em Configurações.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[var(--color-border-strong)] bg-[var(--color-surface-alt)] flex items-center gap-3">
        {error && (
          <p className="text-sm text-[var(--color-danger)] flex-1">{error}</p>
        )}
        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium border border-[var(--color-border-strong)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
          >
            {loading ? 'Criando...' : 'Criar Tenant'}
          </button>
        </div>
      </div>
    </form>
  )
}
