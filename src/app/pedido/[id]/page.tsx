import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'

type Props = { params: Promise<{ id: string }> }

export default async function PedidoPublicPage({ params }: Props) {
  const { id } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (admin as any)
    .from('orders')
    .select('id, order_items(event_id)')
    .eq('id', id)
    .single() as {
      data: {
        id: string
        order_items?: Array<{ event_id: string }>
      } | null
    }

  const eventId = order?.order_items?.[0]?.event_id
  if (!eventId) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('tenant_id')
    .eq('id', eventId)
    .single() as { data: { tenant_id: string } | null }

  if (!event?.tenant_id) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants')
    .select('slug')
    .eq('id', event.tenant_id)
    .single() as { data: { slug: string } | null }

  if (!tenant?.slug) notFound()

  redirect(`/${tenant.slug}/pedido/${id}`)
}
