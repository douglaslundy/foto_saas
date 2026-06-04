'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function resolveRedirect(target: string | null): string {
    if (!target) return '/dashboard'
    if (target.startsWith('/')) return target
    return `/${target.replace(/^\/+/, '')}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    const redirectTo = resolveRedirect(searchParams.get('redirect'))
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Email field */}
      <div className="mb-4">
        <label
          htmlFor="email"
          className="block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)] mb-2"
        >
          E-mail
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="seu@email.com"
          className="w-full h-12 px-4 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm font-body transition-all duration-200 focus:outline-none focus:border-[var(--color-blue)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)]"
        />
      </div>

      {/* Password field */}
      <div className="mb-2">
        <label
          htmlFor="password"
          className="block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)] mb-2"
        >
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="w-full h-12 px-4 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm font-body transition-all duration-200 focus:outline-none focus:border-[var(--color-blue)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)]"
        />
      </div>

      {/* Forgot password link */}
      <div className="flex justify-end mb-6">
        <a
          href="/esqueci-minha-senha"
          className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-blue)] transition-colors"
        >
          Esqueceu a senha?
        </a>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-[var(--color-danger)] mb-4">{error}</p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full h-[50px] rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  )
}
