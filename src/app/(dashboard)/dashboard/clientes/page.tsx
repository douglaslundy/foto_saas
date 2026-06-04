import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ClientesTable, type ClientRow } from './_components/clientes-table'
import { getDashboardFallbackPath } from '@/lib/dashboard-access'

type OrderRow = {
  id: string
  client_email: string | null
  client_user_id: string | null
  total_cents: number
  status: string
  created_at: string
  order_items: { events: { tenant_id: string } | null }[]
}

type UserRow = {
  id: string
  name: string | null
  email: string
  role: string
  created_at: string
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

export default async function ClientesPage() {
  const profile = await getProfile()
  const adminClient = createAdminClient()
  const isAdmin = profile.role === 'admin'

  const [ordersRes, usersRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('orders')
      .select('id, client_email, client_user_id, total_cents, status, created_at, order_items(events(tenant_id))')
      .order('created_at', { ascending: false })
      .limit(500),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('users')
      .select('id, name, email, role, created_at')
      .in('role', ['client', 'client_inactive'])
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const { data: orders } = ordersRes as { data: OrderRow[] | null }
  const { data: users } = usersRes as { data: UserRow[] | null }

  const scopedOrders = isAdmin
    ? (orders ?? [])
    : (orders ?? []).filter((order) =>
        order.order_items?.some((item) => item.events?.tenant_id === profile.tenant_id)
      )

  const userRows = (users ?? []).filter((userRow) => userRow.role === 'client' || userRow.role === 'client_inactive')
  const usersById = new Map(userRows.map((userRow) => [userRow.id, userRow]))
  const usersByEmail = new Map(userRows.map((userRow) => [userRow.email.toLowerCase(), userRow]))

  const clientMap = new Map<string, ClientRow>()

  for (const userRow of userRows) {
    const hasRelatedOrder = scopedOrders.some(
      (order) =>
        order.client_user_id === userRow.id ||
        (!!order.client_email && order.client_email.toLowerCase() === userRow.email.toLowerCase())
    )

    if (!isAdmin && !hasRelatedOrder) continue

    clientMap.set(userRow.id, {
      id: userRow.id,
      name: userRow.name?.trim() || userRow.email.split('@')[0] || 'Cliente',
      email: userRow.email,
      status: userRow.role === 'client' ? 'active' : 'inactive',
      order_count: 0,
      total_spent_cents: 0,
      last_order_date: null,
      last_order_status: null,
    })
  }

  for (const order of scopedOrders) {
    const resolvedKey =
      (order.client_user_id && usersById.has(order.client_user_id) && order.client_user_id) ||
      (order.client_email ? usersByEmail.get(order.client_email.toLowerCase())?.id ?? null : null) ||
      (order.client_email ? `guest:${order.client_email.toLowerCase()}` : null)

    if (!resolvedKey) continue

    const existing = clientMap.get(resolvedKey)
    const fallbackName = order.client_email?.split('@')[0] || 'Cliente sem conta'

    if (existing) {
      existing.order_count += 1
      existing.total_spent_cents += order.total_cents
      if (!existing.last_order_date || order.created_at > existing.last_order_date) {
        existing.last_order_date = order.created_at
        existing.last_order_status = order.status
      }
    } else {
      clientMap.set(resolvedKey, {
        id: resolvedKey.startsWith('guest:') ? null : resolvedKey,
        name: fallbackName,
        email: order.client_email ?? '—',
        status: 'guest',
        order_count: 1,
        total_spent_cents: order.total_cents,
        last_order_date: order.created_at,
        last_order_status: order.status,
      })
    }
  }

  const clients = Array.from(clientMap.values()).sort((a, b) => {
    const aDate = a.last_order_date ?? a.email
    const bDate = b.last_order_date ?? b.email
    return String(bDate).localeCompare(String(aDate))
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Clientes
          </h1>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1">
            {clients.length} cliente{clients.length !== 1 ? 's' : ''} cadastrado
            {clients.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <ClientesTable clients={clients} canManage={isAdmin} />
    </div>
  )
}
