'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div className="space-y-8 max-w-md">
      {/* Dados da conta */}
      <div className="border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold">Dados da Conta</h2>
        <div className="space-y-1">
          <Label>E-mail</Label>
          <Input value={email} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado por aqui.</p>
        </div>
        <form onSubmit={handleNameSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="name">Nome de exibição</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              required
            />
          </div>
          {nameMsg && (
            <p className={`text-sm ${nameMsg.startsWith('Erro') ? 'text-destructive' : 'text-green-600'}`}>
              {nameMsg}
            </p>
          )}
          <Button type="submit" disabled={nameLoading}>
            {nameLoading ? 'Salvando...' : 'Salvar nome'}
          </Button>
        </form>
      </div>

      {/* Alterar senha */}
      <div className="border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold">Alterar Senha</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {passMsg && (
            <p className={`text-sm ${passMsg.startsWith('Erro') || passMsg.includes('não') ? 'text-destructive' : 'text-green-600'}`}>
              {passMsg}
            </p>
          )}
          <Button type="submit" disabled={passLoading}>
            {passLoading ? 'Alterando...' : 'Alterar senha'}
          </Button>
        </form>
      </div>
    </div>
  )
}
