import { NextRequest, NextResponse } from 'next/server'
import { verifyStripeWebhook } from '@/lib/payments/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
  }

  const rawBody = await request.text()
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  let event
  try {
    event = verifyStripeWebhook(rawBody, signature, secret)
  } catch (err) {
    console.error('[Stripe webhook] verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymentIntent = event.data.object as any
    const orderId = paymentIntent.metadata?.orderId

    if (orderId) {
      const adminClient = createAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any)
        .from('orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', orderId)
    }
  }

  return NextResponse.json({ received: true })
}
