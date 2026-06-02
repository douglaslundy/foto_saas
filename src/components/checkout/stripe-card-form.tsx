'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

interface StripeCardFormInnerProps {
  orderId: string
  returnUrl?: string
  onSuccess: () => void
}

function StripeCardFormInner({ orderId, returnUrl, onSuccess }: StripeCardFormInnerProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl ?? `${window.location.origin}/pedido/${orderId}`,
      },
    })

    if (submitError) {
      setError(submitError.message ?? 'Erro ao processar pagamento.')
      setLoading(false)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading || !stripe}>
        {loading ? 'Processando...' : 'Pagar'}
      </Button>
    </form>
  )
}

interface StripeCardFormProps {
  clientSecret: string
  orderId: string
  returnUrl?: string
  onSuccess: () => void
}

export function StripeCardForm({ clientSecret, orderId, returnUrl, onSuccess }: StripeCardFormProps) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripeCardFormInner orderId={orderId} returnUrl={returnUrl} onSuccess={onSuccess} />
    </Elements>
  )
}
