import { NextRequest, NextResponse } from 'next/server'
import { verifyStripeWebhook } from '@/lib/payments/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailQueue } from '@/lib/queues/email-queue'

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

      // Send email notifications (fire-and-forget, errors logged internally)
      await sendOrderNotifications(adminClient, orderId)
    }
  }

  return NextResponse.json({ received: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendOrderNotifications(adminClient: any, orderId: string) {
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

    // Enqueue client confirmation (3 retries with exponential backoff)
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
    console.error('[Stripe webhook] sendOrderNotifications failed:', err)
  }
}
