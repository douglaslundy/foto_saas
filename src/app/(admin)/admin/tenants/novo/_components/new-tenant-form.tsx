'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type UserType = 'photographer' | 'admin'

export function NewTenantForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userType, setUserType] = useState<UserType>('photographer')
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

    const payload =
      userType === 'admin'
        ? {
            role: 'admin',
            name: form.photographerName,
            email: form.email,
            password: form.password,
          }
        : { ...form }

    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erro ao criar usuário.')
      setLoading(false)
      return
    }
    router.push('/admin/tenants')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-6 space-y-4">
      {/* User type selector */}
      <div className="space-y-2">
        <Label>Tipo de usuário</Label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="userType"
              value="photographer"
              checked={userType === 'photographer'}
              onChange={() => setUserType('photographer')}
              className="accent-primary"
            />
            <span className="text-sm">Fotógrafo (novo estúdio)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="userType"
              value="admin"
              checked={userType === 'admin'}
              onChange={() => setUserType('admin')}
              className="accent-primary"
            />
            <span className="text-sm">Administrador da plataforma</span>
          </label>
        </div>
      </div>

      {/* Tenant fields — only for photographer */}
      {userType === 'photographer' && (
        <>
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
        </>
      )}

      {/* Name field label changes by type */}
      <div className="space-y-1">
        <Label htmlFor="photographerName">
          {userType === 'photographer' ? 'Nome do fotógrafo responsável' : 'Nome do administrador *'}
        </Label>
        <Input
          id="photographerName"
          name="photographerName"
          value={form.photographerName}
          onChange={handleChange}
          placeholder={userType === 'photographer' ? 'Ex: João Silva' : 'Ex: Maria Souza'}
          required={userType === 'admin'}
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
          placeholder={userType === 'photographer' ? 'joao@studiosliva.com' : 'admin@plataforma.com'}
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
          O usuário pode alterar a senha após o primeiro acesso em Configurações.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading
            ? 'Criando...'
            : userType === 'admin'
            ? 'Criar administrador'
            : 'Criar fotógrafo'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
