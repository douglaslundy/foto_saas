'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface RegisterFormProps {
  tenantSlug: string
}

export function RegisterForm({ tenantSlug }: RegisterFormProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/client/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, tenantSlug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao criar conta.')
        return
      }

      router.push(`/${tenantSlug}/login?registered=1`)
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full h-12 px-4 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.15)]'
  const labelClass =
    'block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-muted)] mb-2'

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="name" className={labelClass}>
          Nome completo
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Seu nome"
          className={inputClass}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="email" className={labelClass}>
          E-mail
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="seu@email.com"
          className={inputClass}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="password" className={labelClass}>
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Mínimo 8 caracteres"
          className={inputClass}
        />
      </div>

      <div className="mb-6">
        <label htmlFor="confirmPassword" className={labelClass}>
          Confirmar senha
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="Repita a senha"
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-[var(--color-danger)] mb-4">{error}</p>}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-[50px] rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Criando conta...' : 'Criar conta'}
      </Button>

      <p className="mt-6 text-center text-sm text-[var(--color-ink-muted)]">
        Já tem conta?{' '}
        <Link
          href={`/${tenantSlug}/login`}
          className="text-[var(--color-gold)] font-medium hover:underline"
        >
          Entrar &rarr;
        </Link>
      </p>
    </form>
  )
}
