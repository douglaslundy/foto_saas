import { NextRequest, NextResponse } from 'next/server'
import { verifyMercadoPagoWebhook } from '@/lib/payments/mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { emailQueue } from '@/lib/queues/email-queue'

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

    // Find photographer email via event → tenant
    const eventId = order.order_items?.[0]?.event_id

    let studioName: string | undefined
    let tenantId: string | undefined

    if (eventId) {
      const { data: eventRow } = await adminClient
        .from('events')
        .select('tenant_id')
        .eq('id', eventId)
        .single()

      tenantId = eventRow?.tenant_id

      if (tenantId) {
        const { data: tenantRow } = await adminClient
          .from('tenants')
          .select('name')
          .eq('id', tenantId)
          .single()
        studioName = (tenantRow as any)?.name
      }
    }

    // Enqueue client confirmation (3 retries com backoff exponencial)
    await emailQueue.add('order_confirmation', {
      type: 'order_confirmation',
      to: order.client_email,
      orderId,
      totalCents: order.total_cents,
      downloadUrl: `${appUrl}/pedido/${orderId}`,
      studioName,
    })

    if (!tenantId) return

    const { data: photographer } = await adminClient
      .from('users')
      .select('email')
      .eq('tenant_id', tenantId)
      .eq('role', 'photographer')
      .single()

    if (photographer?.email) {
      await emailQueue.add('sale_notification', {
        type: 'sale_notification',
        to: photographer.email,
        orderId,
        totalCents: order.total_cents,
        clientEmail: order.client_email,
        studioName,
      })
    }
  } catch (err) {
    console.error('[MP webhook] sendMPOrderNotifications failed:', err)
  }
}
