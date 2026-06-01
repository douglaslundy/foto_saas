'use client'

import { useState } from 'react'

export function PasswordGate({
  eventId,
  children,
}: {
  eventId: string
  children: React.ReactNode
}) {
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/events/${eventId}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        setUnlocked(true)
      } else {
        setError('Senha incorreta.')
      }
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (unlocked) return <>{children}</>

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
      <div
        className="max-w-sm w-full rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-8 text-center"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        {/* Lock icon */}
        <div className="w-12 h-12 rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border-strong)] flex items-center justify-center mx-auto mb-4">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-[var(--color-ink)] mb-1">
          Evento protegido
        </h2>
        <p className="text-[var(--color-ink-muted,#6b6b6b)] text-sm mb-6">
          Informe a senha para acessar as fotos
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha do evento"
            autoFocus
            className="w-full h-11 px-4 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.12)] transition-all duration-200"
          />

          {error && (
            <p className="text-sm text-red-500 text-left">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
