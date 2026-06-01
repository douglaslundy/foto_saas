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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Nome do estúdio */}
      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium">
          Nome do estúdio <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Slug (read-only) */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-muted-foreground">
          Slug (não editável)
        </label>
        <div className="w-full border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground select-all">
          {initial.slug}
        </div>
        <p className="text-xs text-muted-foreground">
          O slug identifica seu estúdio na URL e não pode ser alterado aqui.
        </p>
      </div>

      {/* Bio */}
      <div className="space-y-1">
        <label htmlFor="bio" className="block text-sm font-medium">
          Bio / descrição
        </label>
        <textarea
          id="bio"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Conte um pouco sobre seu estúdio..."
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Cor principal */}
      <div className="space-y-1">
        <label htmlFor="primary_color" className="block text-sm font-medium">
          Cor principal
        </label>
        <div className="flex items-center gap-3">
          <input
            id="primary_color"
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded border p-1"
          />
          <span className="text-sm text-muted-foreground font-mono">{primaryColor}</span>
        </div>
      </div>

      {/* Domínio personalizado */}
      <div className="space-y-1">
        <label htmlFor="custom_domain" className="block text-sm font-medium">
          Domínio personalizado
        </label>
        <input
          id="custom_domain"
          type="text"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          placeholder="fotos.meusite.com.br"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-muted-foreground">
          Configure seu DNS para apontar para o servidor antes de salvar.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-md transition-colors"
      >
        {loading ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </form>
  )
}
