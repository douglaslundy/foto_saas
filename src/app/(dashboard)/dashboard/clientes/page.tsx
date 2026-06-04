import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ClientesTable, type ClientRow } from './_components/clientes-table'
import { AddClientDialog } from './_components/add-client-dialog'
import { getDashboardFallbackPath } from '@/lib/dashboard-access'

type OrderRow = {
  id: string
  client_email: string
  total_cents: number
  created_at: string
  order_items: { events: { tenant_id: string } | null }[]
}

async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect(getDashboardFallbackPath(profile as { role?: string | null; tenant_id?: string | null } | null))
  return profile as { tenant_id: string; role: string }
}

export default async function ClientesPage() {
  const profile = await getProfile()
  const adminClient = createAdminClient()

  const [ordersRes, eventsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('orders')
      .select(`id, client_email, total_cents, created_at, order_items(events(tenant_id))`)
      .order('created_at', { ascending: false })
      .limit(500),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('events')
      .select('id, title')
      .eq('tenant_id', profile.tenant_id)
      .order('event_date', { ascending: false })
      .limit(200),
  ])

  const { data: orders } = ordersRes as { data: OrderRow[] | null }
  const events = (eventsRes.data ?? []) as { id: string; title: string }[]

  // Filter to this tenant's orders only
  const tenantOrders = (orders ?? []).filter((o) =>
    o.order_items?.some((oi) => oi.events?.tenant_id === profile.tenant_id)
  )

  // Aggregate by unique client email
  const clientMap = new Map<string, ClientRow>()
  for (const order of tenantOrders) {
    const existing = clientMap.get(order.client_email)
    if (existing) {
      existing.order_count++
      existing.total_spent_cents += order.total_cents
      if (order.created_at > existing.last_order_date) {
        existing.last_order_date = order.created_at
      }
    } else {
      clientMap.set(order.client_email, {
        email: order.client_email,
        order_count: 1,
        total_spent_cents: order.total_cents,
        last_order_date: order.created_at,
      })
    }
  }

  const clients = Array.from(clientMap.values()).sort(
    (a, b) => b.last_order_date.localeCompare(a.last_order_date)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Clientes
          </h1>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1">
            {clients.length} cliente{clients.length !== 1 ? 's' : ''} único
            {clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <AddClientDialog events={events} />
      </div>

      <ClientesTable clients={clients} />
    </div>
  )
}
