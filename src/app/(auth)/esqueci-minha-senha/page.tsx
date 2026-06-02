'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/atualizar-senha`,
    })
    if (error) {
      setError('Não foi possível enviar o e-mail. Tente novamente.')
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left column — always dark */}
      <div
        className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: '#0d0f14',
          backgroundImage:
            'radial-gradient(ellipse 60% 50% at 30% 20%, rgba(37,99,235,0.18), transparent), repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(255,255,255,0.03) 47px, rgba(255,255,255,0.03) 48px), repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(255,255,255,0.03) 47px, rgba(255,255,255,0.03) 48px)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2563eb] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="7" r="3" stroke="#0d0f14" strokeWidth="1.5" />
              <path
                d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5"
                stroke="#0d0f14"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="font-display font-bold text-white text-base">FotoSaaS</span>
        </div>

        {/* Footer copy */}
        <div>
          <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
            Recupere seu acesso com segurança
          </h1>
          <p className="text-white/50 text-base mb-8">
            Enviaremos um link seguro para seu e-mail cadastrado.
          </p>
          <div className="flex gap-4">
            {['+2k Eventos', '98% Satisfação', '24h Suporte'].map((badge) => (
              <div
                key={badge}
                className="px-3 py-1.5 rounded-full border border-white/20 text-white/70 text-xs font-medium"
              >
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right column — form */}
      <div className="flex items-center justify-center p-8 bg-[var(--color-surface)]">
        <div className="w-full max-w-[380px]">
          {sent ? (
            /* Success state */
            <div>
              <div className="w-12 h-12 rounded-full bg-[var(--color-blue-light)] flex items-center justify-center mb-6">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M4 10l4.5 4.5L16 6"
                    stroke="var(--color-blue)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="font-display text-3xl font-bold text-[var(--color-ink)] mb-2">
                Verifique seu e-mail
              </h2>
              <p className="text-[var(--color-ink-muted)] text-sm mb-6">
                Enviamos um link de redefinição de senha para{' '}
                <strong className="text-[var(--color-ink)]">{email}</strong>.
                O link expira em 1 hora.
              </p>
              <a
                href="/login"
                className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-blue)] transition-colors"
              >
                ← Voltar ao login
              </a>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="mb-8">
                <h2 className="font-display text-3xl font-bold text-[var(--color-ink)] mb-2">
                  Redefinir senha
                </h2>
                <p className="text-[var(--color-ink-muted)] text-sm">
                  Digite seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Email field */}
                <div className="mb-6">
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

                {/* Error message */}
                {error && (
                  <p className="text-sm text-[var(--color-danger)] mb-4">{error}</p>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[50px] rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed mb-4"
                >
                  {loading ? 'Enviando...' : 'Enviar link de redefinição'}
                </button>

                {/* Back to login */}
                <div className="text-center">
                  <a
                    href="/login"
                    className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-blue)] transition-colors"
                  >
                    ← Voltar ao login
                  </a>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
