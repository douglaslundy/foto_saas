import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { OrdersTable } from './_components/orders-table'

type OrderRow = {
  id: string
  client_email: string
  total_cents: number
  payment_method: string
  status: string
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

  if (!profile?.tenant_id) redirect('/login')
  return profile as { tenant_id: string; role: string }
}

export default async function ClientesPage() {
  const profile = await getProfile()
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = (await (adminClient as any)
    .from('orders')
    .select(
      `id, client_email, total_cents, payment_method, status, created_at,
       order_items(events(tenant_id))`
    )
    .order('created_at', { ascending: false })
    .limit(500)) as { data: OrderRow[] | null }

  // Filter to this tenant and strip join data
  const tenantOrders = (orders ?? [])
    .filter((o) => o.order_items?.some((oi) => oi.events?.tenant_id === profile.tenant_id))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ order_items: _oi, ...rest }) => rest) as {
      id: string
      client_email: string
      total_cents: number
      payment_method: string
      status: string
      created_at: string
    }[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Clientes
          </h1>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1">
            {tenantOrders.length} pedido{tenantOrders.length !== 1 ? 's' : ''} encontrado
            {tenantOrders.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <OrdersTable orders={tenantOrders} />
    </div>
  )
}
