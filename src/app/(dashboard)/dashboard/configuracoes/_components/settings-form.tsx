'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'h-11 px-4 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.12)] placeholder:text-[var(--color-ink-muted)]'
const labelClass =
  'block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)] mb-1.5'

export function SettingsForm({
  userId,
  currentName,
  email,
}: {
  userId: string
  currentName: string | null
  email: string
}) {
  const [name, setName] = useState(currentName ?? '')
  const [nameMsg, setNameMsg] = useState('')
  const [nameLoading, setNameLoading] = useState(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passMsg, setPassMsg] = useState('')
  const [passLoading, setPassLoading] = useState(false)

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNameLoading(true)
    setNameMsg('')
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('users')
      .update({ name: name.trim() })
      .eq('id', userId)
    setNameMsg(error ? `Erro: ${error.message}` : 'Nome atualizado com sucesso!')
    setNameLoading(false)
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setPassMsg('As senhas não conferem.')
      return
    }
    if (password.length < 6) {
      setPassMsg('A senha deve ter ao menos 6 caracteres.')
      return
    }
    setPassLoading(true)
    setPassMsg('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setPassMsg(error ? `Erro: ${error.message}` : 'Senha alterada com sucesso!')
    if (!error) { setPassword(''); setConfirmPassword('') }
    setPassLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* Card: Dados da Conta */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-5 border-b border-[var(--color-border-strong)]">
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Dados da Conta</h2>
          <p className="text-[var(--color-ink-muted)] text-sm mt-0.5">Seu e-mail e nome de exibição</p>
        </div>
        <form onSubmit={handleNameSubmit}>
          <div className="p-6 space-y-4">
            {/* Email (read-only) */}
            <div>
              <label className={labelClass}>E-mail</label>
              <input
                type="email"
                value={email}
                disabled
                className={`${inputClass} opacity-60 cursor-not-allowed`}
              />
              <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">O e-mail não pode ser alterado por aqui.</p>
            </div>
            {/* Name */}
            <div>
              <label htmlFor="name" className={labelClass}>Nome de exibição</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                required
                className={inputClass}
              />
            </div>
            {nameMsg && (
              <p className={`text-sm font-medium ${nameMsg.startsWith('Erro') ? 'text-red-500' : 'text-emerald-600'}`}>
                {nameMsg}
              </p>
            )}
          </div>
          <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end">
            <button
              type="submit"
              disabled={nameLoading}
              className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60"
            >
              {nameLoading ? 'Salvando...' : 'Salvar nome'}
            </button>
          </div>
        </form>
      </div>

      {/* Card: Alterar Senha */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-5 border-b border-[var(--color-border-strong)]">
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Alterar Senha</h2>
          <p className="text-[var(--color-ink-muted)] text-sm mt-0.5">Defina uma nova senha de acesso</p>
        </div>
        <form onSubmit={handlePasswordSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="password" className={labelClass}>Nova senha</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className={labelClass}>Confirmar nova senha</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={inputClass}
              />
            </div>
            {passMsg && (
              <p className={`text-sm font-medium ${passMsg.startsWith('Erro') || passMsg.includes('não') ? 'text-red-500' : 'text-emerald-600'}`}>
                {passMsg}
              </p>
            )}
          </div>
          <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end">
            <button
              type="submit"
              disabled={passLoading}
              className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60"
            >
              {passLoading ? 'Alterando...' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
