import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getDashboardFallbackPath } from '@/lib/dashboard-access'
import { OrdersTable } from '../clientes/_components/orders-table'
import { AddClientDialog } from '../clientes/_components/add-client-dialog'

type OrderRow = {
  id: string
  client_email: string | null
  total_cents: number
  payment_method: string | null
  status: string
  created_at: string
  order_items: { events: { tenant_id: string } | null }[]
}

type EventRow = {
  id: string
  title: string
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

  if (!profile) redirect('/login')
  if (profile.role !== 'admin' && !profile.tenant_id) {
    redirect(getDashboardFallbackPath(profile as { role?: string | null; tenant_id?: string | null } | null))
  }

  return profile as { tenant_id: string | null; role: string }
}

export default async function PedidosPage() {
  const profile = await getProfile()
  const adminClient = createAdminClient()
  const isAdmin = profile.role === 'admin'

  const [ordersRes, eventsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('orders')
      .select('id, client_email, total_cents, payment_method, status, created_at, order_items(events(tenant_id))')
      .order('created_at', { ascending: false })
      .limit(500),
    profile.tenant_id && !isAdmin
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (adminClient as any)
          .from('events')
          .select('id, title')
          .eq('tenant_id', profile.tenant_id)
          .order('event_date', { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as EventRow[] }),
  ])

  const { data: orders } = ordersRes as { data: OrderRow[] | null }
  const events = (eventsRes as { data: EventRow[] | null }).data ?? []

  const scopedOrders = isAdmin
    ? (orders ?? [])
    : (orders ?? []).filter((order) =>
        order.order_items?.some((item) => item.events?.tenant_id === profile.tenant_id)
      )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Pedidos
          </h1>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1">
            Histórico de pedidos e pagamentos
          </p>
        </div>
        {profile.tenant_id && !isAdmin && <AddClientDialog events={events} />}
      </div>

      <OrdersTable
        orders={scopedOrders.map((order) => ({
          id: order.id,
          client_email: order.client_email ?? '—',
          total_cents: order.total_cents,
          payment_method: order.payment_method ?? 'manual',
          status: order.status,
          created_at: order.created_at,
        }))}
      />
    </div>
  )
}
