'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface LoginFormProps {
  tenantSlug: string
}

export function LoginForm({ tenantSlug }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function resolveRedirect(target: string | null): string {
    if (!target) return `/${tenantSlug}`
    if (target.startsWith('/')) return target
    return `/${tenantSlug}/${target.replace(/^\/+/, '')}`
  }

  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setSuccess('Conta criada com sucesso! Faça login para continuar.')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    // Verify the user is a client
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Erro ao verificar sessão.')
      setLoading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile && profile.role !== 'client') {
      // Not a client — sign out and reject
      await supabase.auth.signOut()
      setError('Acesso exclusivo para clientes.')
      setLoading(false)
      return
    }

    const redirectTo = resolveRedirect(searchParams.get('redirect'))
    router.push(redirectTo)
    router.refresh()
  }

  const inputClass =
    'w-full h-12 px-4 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.15)]'
  const labelClass =
    'block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-muted)] mb-2'

  return (
    <form onSubmit={handleSubmit}>
      {success && (
        <div className="mb-4 rounded-[var(--radius-sm)] bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/30 px-4 py-3 text-sm text-[var(--color-ink)]">
          {success}
        </div>
      )}

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

      <div className="mb-6">
        <label htmlFor="password" className={labelClass}>
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-[var(--color-danger)] mb-4">{error}</p>}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-[50px] rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </Button>

      <p className="mt-6 text-center text-sm text-[var(--color-ink-muted)]">
        Não tem conta?{' '}
        <Link
          href={`/${tenantSlug}/cadastro`}
          className="text-[var(--color-gold)] font-medium hover:underline"
        >
          Cadastrar &rarr;
        </Link>
      </p>
    </form>
  )
}
