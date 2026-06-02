import { createAdminClient } from '@/lib/supabase/admin'
import { emailQueue } from '@/lib/queues/email-queue'

export async function notifyPhotographerNewOrder(orderId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Fetch order_items to get event_id
  const { data: orderItems } = await admin
    .from('order_items')
    .select('event_id')
    .eq('order_id', orderId)
    .limit(1)

  const eventId = orderItems?.[0]?.event_id
  if (!eventId) return

  // Fetch event to get tenant_id and title
  const { data: event } = await admin
    .from('events')
    .select('tenant_id, title')
    .eq('id', eventId)
    .single()

  if (!event?.tenant_id) return

  // Fetch tenant name
  const { data: tenant } = await admin
    .from('tenants')
    .select('name')
    .eq('id', event.tenant_id)
    .single()

  // Fetch photographer email
  const { data: photographer } = await admin
    .from('users')
    .select('email')
    .eq('tenant_id', event.tenant_id)
    .eq('role', 'photographer')
    .limit(1)
    .maybeSingle()

  if (!photographer?.email) return

  // Fetch order totals
  const { data: order } = await admin
    .from('orders')
    .select('total_cents, client_email')
    .eq('id', orderId)
    .single()

  if (!order) return

  const studioName: string | undefined = tenant?.name

  try {
    await emailQueue.add('sale_notification', {
      type: 'sale_notification',
      to: photographer.email,
      orderId,
      totalCents: order.total_cents,
      clientEmail: order.client_email,
      studioName,
    })
  } catch (err) {
    console.error('[notifyPhotographerNewOrder] email queue error:', err)
  }
}
