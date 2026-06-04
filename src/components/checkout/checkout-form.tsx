'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PixDisplay } from './pix-display'

type CheckoutState =
  | { step: 'form' }
  | { step: 'redirect'; checkoutUrl: string; orderId: string }
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

      let data: Record<string, unknown> = {}
      try {
        data = await res.json()
      } catch {
        setError('Erro interno no servidor. Tente novamente.')
        return
      }

      if (!res.ok) {
        setError((data.error as string) ?? 'Erro ao processar checkout.')
        return
      }

      if (paymentMethod === 'stripe') {
        const checkoutUrl = data.checkoutUrl as string | undefined
        if (checkoutUrl) {
          window.location.href = checkoutUrl
          return
        }
        setError('Não foi possível abrir o checkout do Mercado Pago.')
      } else {
        setState({
          step: 'pix',
          pixQrCode: data.pixQrCode as string,
          pixQrCodeBase64: data.pixQrCodeBase64 as string,
          orderId: data.orderId as string,
        })
      }
    } catch (err) {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
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
