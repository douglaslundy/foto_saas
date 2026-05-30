'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
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
    <form onSubmit={handleSubmit} className="border rounded-lg p-6 space-y-4">
      <div className="space-y-1">
        <Label htmlFor="tenantName">Nome da empresa / estúdio *</Label>
        <Input
          id="tenantName"
          name="tenantName"
          value={form.tenantName}
          onChange={handleChange}
          placeholder="Ex: Studio Silva Fotografia"
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="slug">Slug (URL pública) *</Label>
        <Input
          id="slug"
          name="slug"
          value={form.slug}
          onChange={handleChange}
          placeholder="studio-silva"
          required
        />
        <p className="text-xs text-muted-foreground">
          Usado na URL pública: <span className="font-mono">studio-silva.seudominio.com</span>
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="photographerName">Nome do fotógrafo responsável</Label>
        <Input
          id="photographerName"
          name="photographerName"
          value={form.photographerName}
          onChange={handleChange}
          placeholder="Ex: João Silva"
        />
      </div>

      <div className="border-t pt-4 space-y-1">
        <p className="text-sm font-medium">Credenciais de acesso</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">E-mail de login *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="joao@studiosliva.com"
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">Senha inicial *</Label>
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
        <p className="text-xs text-muted-foreground">
          O fotógrafo pode alterar a senha após o primeiro acesso em Configurações.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Criando...' : 'Criar fotógrafo'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
