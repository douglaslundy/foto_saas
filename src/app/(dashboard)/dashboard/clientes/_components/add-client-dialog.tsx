'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type EventOption = { id: string; title: string }

interface AddClientDialogProps {
  events: EventOption[]
}

const paymentMethods = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'manual', label: 'Outro' },
]

export function AddClientDialog({ events }: AddClientDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [eventId, setEventId] = useState('')
  const [valueStr, setValueStr] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('pix')

  const [mode, setMode] = useState<'manual' | 'invite'>('invite')
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)

  function resetForm() {
    setEmail('')
    setEventId('')
    setValueStr('')
    setPaymentMethod('pix')
    setError(null)
    setInviteName('')
    setInviteEmail('')
    setInviteMessage(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const totalCents = Math.round(parseFloat(valueStr.replace(',', '.')) * 100)
    if (isNaN(totalCents) || totalCents < 0) {
      setError('Valor inválido.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_email: email,
          event_id: eventId,
          total_cents: totalCents,
          payment_method: paymentMethod,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setOpen(false)
        resetForm()
        router.refresh()
      } else {
        setError(data.error ?? 'Erro ao cadastrar cliente.')
      }
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteLoading(true)
    setInviteMessage(null)
    try {
      const res = await fetch('/api/clients/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, name: inviteName || undefined }),
      })
      const data = await res.json() as { message?: string; error?: string }
      if (res.ok) {
        setInviteMessage(`✅ ${data.message}`)
        setInviteEmail('')
        setInviteName('')
      } else {
        setInviteMessage(data.error ?? 'Erro ao enviar convite.')
      }
    } catch {
      setInviteMessage('Erro de rede. Tente novamente.')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        <Button size="sm">+ Cadastrar cliente</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar cliente</DialogTitle>
        </DialogHeader>
        {/* Tabs de modo */}
        <div className="flex gap-1 mb-5">
          {(['invite', 'manual'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setInviteMessage(null) }}
              className={`flex-1 py-2 text-sm font-semibold rounded-[var(--radius-sm)] transition-colors ${
                mode === m
                  ? 'bg-[var(--color-cta)] text-[var(--color-cta-fg)]'
                  : 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {m === 'invite' ? '📧 Convidar por email' : '📋 Registrar pedido manual'}
            </button>
          ))}
        </div>
        {mode === 'invite' && (
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="invite-name">Nome do cliente</Label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Nome completo (opcional)"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-email">E-mail *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="cliente@email.com"
                required
              />
            </div>
            {inviteMessage && (
              <p className={`text-sm ${inviteMessage.startsWith('✅') ? 'text-[var(--color-success)]' : 'text-destructive'}`}>
                {inviteMessage}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Fechar
              </Button>
              <Button type="submit" disabled={inviteLoading}>
                {inviteLoading ? 'Enviando...' : 'Enviar convite'}
              </Button>
            </div>
          </form>
        )}
        {mode === 'manual' && (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="client-email">E-mail do cliente</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="client-event">Evento</Label>
            <Select value={eventId} onValueChange={setEventId} required>
              <SelectTrigger id="client-event">
                <SelectValue placeholder="Selecione um evento" />
              </SelectTrigger>
              <SelectContent>
                {events.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {ev.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="client-value">Valor (R$)</Label>
            <Input
              id="client-value"
              type="number"
              min="0"
              step="0.01"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="client-payment">Forma de pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="client-payment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((pm) => (
                  <SelectItem key={pm.value} value={pm.value}>
                    {pm.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !eventId}>
              {loading ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
