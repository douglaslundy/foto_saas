import { NextRequest, NextResponse } from 'next/server'
import { verifyMercadoPagoWebhook } from '@/lib/payments/mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { sendOrderConfirmation, sendSaleNotification } from '@/lib/notifications/email'

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

            // Send email notifications
            await sendMPOrderNotifications(adminClient, orderId)
          }
        }
      } catch (err) {
        console.error('[MP webhook] error fetching payment:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendMPOrderNotifications(adminClient: any, orderId: string) {
  try {
    const { data: order } = await adminClient
      .from('orders')
      .select('client_email, total_cents, order_items(event_id)')
      .eq('id', orderId)
      .single()

    if (!order) return

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    await sendOrderConfirmation({
      to: order.client_email,
      orderId,
      totalCents: order.total_cents,
      downloadUrl: `${appUrl}/pedido/${orderId}`,
    })

    const eventId = order.order_items?.[0]?.event_id
    if (!eventId) return

    const { data: event } = await adminClient
      .from('events')
      .select('tenant_id')
      .eq('id', eventId)
      .single()

    if (!event?.tenant_id) return

    const { data: photographer } = await adminClient
      .from('users')
      .select('email')
      .eq('tenant_id', event.tenant_id)
      .eq('role', 'photographer')
      .single()

    if (photographer?.email) {
      await sendSaleNotification({
        to: photographer.email,
        orderId,
        totalCents: order.total_cents,
        clientEmail: order.client_email,
      })
    }
  } catch (err) {
    console.error('[MP webhook] sendMPOrderNotifications failed:', err)
  }
}
