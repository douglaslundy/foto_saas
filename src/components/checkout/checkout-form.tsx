'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StripeCardForm } from './stripe-card-form'
import { PixDisplay } from './pix-display'

type CheckoutState =
  | { step: 'form' }
  | { step: 'stripe'; clientSecret: string; orderId: string }
  | { step: 'pix'; pixQrCode: string; pixQrCodeBase64: string; orderId: string }
  | { step: 'done'; orderId: string }

interface CheckoutFormProps {
  initialEmail?: string
}

export function CheckoutForm({ initialEmail = '' }: CheckoutFormProps) {
  const [email, setEmail] = useState(initialEmail)
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'pix'>('stripe')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<CheckoutState>({ step: 'form' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, paymentMethod }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao processar checkout.')
        return
      }

      if (paymentMethod === 'stripe') {
        setState({ step: 'stripe', clientSecret: data.clientSecret, orderId: data.orderId })
      } else {
        setState({
          step: 'pix',
          pixQrCode: data.pixQrCode,
          pixQrCodeBase64: data.pixQrCodeBase64,
          orderId: data.orderId,
        })
      }
    } catch (err) {
      setError('Erro de rede. Tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (state.step === 'stripe') {
    return (
      <StripeCardForm
        clientSecret={state.clientSecret}
        orderId={state.orderId}
        onSuccess={() => setState({ step: 'done', orderId: state.orderId })}
      />
    )
  }

  if (state.step === 'pix') {
    return (
      <PixDisplay
        pixQrCode={state.pixQrCode}
        pixQrCodeBase64={state.pixQrCodeBase64}
        orderId={state.orderId}
      />
    )
  }

  if (state.step === 'done') {
    return (
      <div className="text-center space-y-4">
        <p className="text-green-600 font-semibold">Pagamento confirmado!</p>
        <Button onClick={() => (window.location.href = `/pedido/${state.orderId}`)}>
          Ver meus downloads
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail para receber os downloads</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Forma de pagamento</Label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="paymentMethod"
              value="stripe"
              checked={paymentMethod === 'stripe'}
              onChange={() => setPaymentMethod('stripe')}
              className="accent-primary"
            />
            <span className="text-sm">Cartão de crédito / débito</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="paymentMethod"
              value="pix"
              checked={paymentMethod === 'pix'}
              onChange={() => setPaymentMethod('pix')}
              className="accent-primary"
            />
            <span className="text-sm">PIX</span>
          </label>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Processando...' : 'Continuar'}
      </Button>
    </form>
  )
}
