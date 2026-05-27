import { NextRequest, NextResponse } from 'next/server'
import { verifyMercadoPagoWebhook } from '@/lib/payments/mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { MercadoPagoConfig, Payment } from 'mercadopago'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-signature') ?? ''
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? ''

  const isValid = verifyMercadoPagoWebhook(rawBody, signature, secret)
  if (!isValid) {
    // Return 200 to prevent MP retries on signature mismatch in test mode
    console.warn('[MP webhook] Invalid signature — returning 200 to avoid retries')
    return NextResponse.json({ received: true })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ received: true })
  }

  if (body.type === 'payment') {
    const paymentId = (body.data as { id?: string })?.id
    if (paymentId) {
      try {
        const config = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '' })
        const paymentClient = new Payment(config)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payment = await paymentClient.get({ id: paymentId } as any)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((payment as any).status === 'approved') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const orderId = (payment as any).external_reference
          if (orderId) {
            const adminClient = createAdminClient()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminClient as any)
              .from('orders')
              .update({ status: 'paid', paid_at: new Date().toISOString() })
              .eq('id', orderId)
          }
        }
      } catch (err) {
        console.error('[MP webhook] error fetching payment:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
