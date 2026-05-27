import Stripe from 'stripe'

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    // @ts-expect-error - using latest api version
    apiVersion: '2024-12-18.acacia',
  })
}

export async function createStripePaymentIntent({
  amountCents,
  currency,
  metadata,
}: {
  amountCents: number
  currency: string
  metadata: Record<string, string>
}): Promise<{ paymentIntentId: string; clientSecret: string }> {
  const stripe = getStripe()
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    metadata,
    automatic_payment_methods: { enabled: true },
  })

  return {
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret!,
  }
}

export function verifyStripeWebhook(
  rawBody: string,
  signature: string,
  secret: string
): Stripe.Event {
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(rawBody, signature, secret)
}
