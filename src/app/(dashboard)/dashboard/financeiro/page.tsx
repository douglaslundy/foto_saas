import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { RevenueChart } from './_components/revenue-chart'

type OrderRow = {
  id: string
  total_cents: number
  client_email: string
  payment_method: string
  created_at: string
  status: string
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

function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

export default async function FinanceiroPage() {
  const profile = await getProfile()
  const adminClient = createAdminClient()

  // Fetch all paid orders with tenant info via joins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = (await (adminClient as any)
    .from('orders')
    .select(
      `id, total_cents, client_email, payment_method, created_at, status,
       order_items(event_id, events(tenant_id))`
    )
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(200)) as { data: OrderRow[] | null }

  // Filter to this tenant only
  const tenantOrders = (orders ?? []).filter((o) =>
    o.order_items?.some((oi) => oi.events?.tenant_id === profile.tenant_id)
  )

  const totalRevenueCents = tenantOrders.reduce((sum, o) => sum + o.total_cents, 0)
  const totalOrders = tenantOrders.length

  // Revenue by month (last 6 months)
  const now = new Date()
  const monthMap = new Map<string, number>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    monthMap.set(label, 0)
  }

  tenantOrders.forEach((o) => {
    const label = getMonthLabel(o.created_at)
    if (monthMap.has(label)) {
      monthMap.set(label, (monthMap.get(label) ?? 0) + o.total_cents)
    }
  })

  const chartData = Array.from(monthMap.entries()).map(([month, revenue]) => ({ month, revenue }))
  const recentOrders = tenantOrders.slice(0, 10)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Financeiro</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="text-2xl font-bold">
            {(totalRevenueCents / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </p>
        </div>
        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-sm text-muted-foreground">Total de Pedidos</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Receita por Mês</h2>
        <RevenueChart data={chartData} />
      </div>

      {/* Recent Orders */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium">Pedidos Recentes</h2>
        </div>
        <div className="divide-y">
          {recentOrders.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          ) : (
            recentOrders.map((order) => (
              <div key={order.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{order.client_email}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')} ·{' '}
                    {order.payment_method === 'pix' ? 'PIX' : 'Cartão'}
                  </p>
                </div>
                <span className="font-medium">
                  {(order.total_cents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
