import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminDashboardPage() {
  const adminClient = createAdminClient()

  const [tenantsResult, ordersResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any).from('tenants').select('id, status', { count: 'exact' }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any).from('orders').select('total_cents, status', { count: 'exact' }),
  ])

  const tenants = (tenantsResult.data ?? []) as { id: string; status: string }[]
  const orders = (ordersResult.data ?? []) as { total_cents: number; status: string }[]

  const activeTenants = tenants.filter((t) => t.status === 'active').length
  const paidOrders = orders.filter((o) => o.status === 'paid')
  const totalRevenueCents = paidOrders.reduce((sum, o) => sum + o.total_cents, 0)

  const stats = [
    { label: 'Total de Fotógrafos', value: String(tenants.length) },
    { label: 'Ativos', value: String(activeTenants) },
    { label: 'Pedidos Pagos', value: String(paidOrders.length) },
    {
      label: 'Receita Total (plataforma)',
      value: (totalRevenueCents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Visão Geral do Sistema</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="border rounded-lg p-4 space-y-1">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
