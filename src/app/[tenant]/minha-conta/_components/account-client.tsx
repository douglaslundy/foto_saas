'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface AccountClientProps {
  tenantSlug: string
  initialName: string
  email: string
}

export function AccountClient({ tenantSlug, initialName, email }: AccountClientProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setSaveMsg(null)
    setSaving(true)
    try {
      const res = await fetch('/api/auth/client/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setSaveMsg('Dados salvos com sucesso.')
        router.refresh()
      } else {
        const data = await res.json() as { error?: string }
        setSaveMsg(data.error ?? 'Erro ao salvar.')
      }
    } catch {
      setSaveMsg('Erro de rede. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg(null)

    if (password.length < 6) {
      setPasswordMsg('A senha deve ter ao menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setPasswordMsg('As senhas não conferem.')
      return
    }

    setPasswordSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setPasswordMsg(`Erro: ${error.message}`)
      } else {
        setPasswordMsg('Senha alterada com sucesso.')
        setPassword('')
        setConfirmPassword('')
      }
    } catch {
      setPasswordMsg('Erro de rede. Tente novamente.')
    } finally {
      setPasswordSaving(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${tenantSlug}/login`)
    router.refresh()
  }

  const inputClass =
    'w-full h-11 px-4 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.15)]'
  const labelClass =
    'block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-muted)] mb-2'

  return (
    <div className="space-y-6">
      {/* Edit profile */}
      <section className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)] mb-5">
          Meus dados
        </h2>
        <form onSubmit={handleSaveName} className="space-y-4">
          <div>
            <label className={labelClass}>Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>E-mail</label>
            <input
              type="email"
              value={email}
              disabled
              className={`${inputClass} opacity-60 cursor-not-allowed`}
            />
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              O e-mail não pode ser alterado.
            </p>
          </div>
          {saveMsg && (
            <p
              className={`text-sm ${saveMsg.includes('sucesso') ? 'text-[var(--color-success,#16a34a)]' : 'text-[var(--color-danger)]'}`}
            >
              {saveMsg}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="h-11 px-6 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </section>

      {/* Change password */}
      <section className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)] mb-5">
          Alterar senha
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className={labelClass}>Nova senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Confirmar nova senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className={inputClass}
            />
          </div>
          {passwordMsg && (
            <p
              className={`text-sm ${
                passwordMsg.startsWith('Senha') || passwordMsg.includes('sucesso')
                  ? 'text-[var(--color-success,#16a34a)]'
                  : 'text-[var(--color-danger)]'
              }`}
            >
              {passwordMsg}
            </p>
          )}
          <button
            type="submit"
            disabled={passwordSaving}
            className="h-11 px-6 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {passwordSaving ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </section>

      {/* Logout */}
      <section className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)] mb-2">
          Sair da conta
        </h2>
        <p className="text-sm text-[var(--color-ink-muted)] mb-4">
          Você será desconectado e redirecionado para a página de login.
        </p>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="h-11 px-6 rounded-[var(--radius-sm)] border border-[var(--color-danger)] text-[var(--color-danger)] font-semibold text-sm transition-all duration-200 hover:bg-[var(--color-danger)]/10 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loggingOut ? 'Saindo...' : 'Sair'}
        </button>
      </section>
    </div>
  )
}
