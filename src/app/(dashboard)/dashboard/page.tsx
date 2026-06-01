import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

type OrderRow = {
  id: string
  total_cents: number
  created_at: string
  status: string
  order_items: { events: { tenant_id: string } | null }[]
}

const sections = [
  {
    href: '/dashboard/eventos',
    title: 'Eventos e Ensaios',
    description: 'Crie e gerencie seus eventos, faça upload de fotos e configure preços.',
    icon: '📸',
  },
  {
    href: '/dashboard/financeiro',
    title: 'Financeiro',
    description: 'Acompanhe sua receita, pedidos pagos e gráfico mensal de vendas.',
    icon: '💰',
  },
  {
    href: '/dashboard/clientes',
    title: 'Clientes e Pedidos',
    description: 'Visualize todos os pedidos e dados dos clientes.',
    icon: '👥',
  },
  {
    href: '/dashboard/equipe',
    title: 'Equipe',
    description: 'Gerencie colaboradores e convide sub-fotógrafos.',
    icon: '🤝',
  },
  {
    href: '/dashboard/configuracoes',
    title: 'Configurações',
    description: 'Altere seu nome de exibição e senha de acesso.',
    icon: '⚙️',
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect('/login')
  const tenantId: string = profile.tenant_id

  // Stat 1 — Published events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: publishedEvents } = await (admin as any)
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'published')

  // Stat 2 — Processed photos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: readyPhotos } = await (admin as any)
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'ready')

  // Fetch paid orders with tenant info via joins (same pattern as financeiro)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = (await (admin as any)
    .from('orders')
    .select(
      `id, total_cents, created_at, status,
       order_items(event_id, events(tenant_id))`
    )
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(200)) as { data: OrderRow[] | null }

  // Filter to this tenant only
  const tenantOrders = (orders ?? []).filter((o) =>
    o.order_items?.some((oi) => oi.events?.tenant_id === tenantId)
  )

  // Stat 3 — Monthly revenue (current calendar month)
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthlyOrders = tenantOrders.filter((o) => o.created_at >= firstOfMonth)
  const monthlyRevenueCents = monthlyOrders.reduce((sum, o) => sum + o.total_cents, 0)

  // Stat 4 — Orders last 7 days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const recentOrdersCount = tenantOrders.filter((o) => o.created_at >= sevenDaysAgo).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bem-vindo ao FotoSaaS</h1>
        <p className="text-muted-foreground mt-1">
          Escolha uma seção para começar.
        </p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-sm text-muted-foreground">Eventos Publicados</p>
          <p className="text-2xl font-bold">{publishedEvents ?? 0}</p>
        </div>
        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-sm text-muted-foreground">Fotos Processadas</p>
          <p className="text-2xl font-bold">{readyPhotos ?? 0}</p>
        </div>
        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-sm text-muted-foreground">Receita do Mês</p>
          <p className="text-2xl font-bold">
            {(monthlyRevenueCents / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </p>
        </div>
        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-sm text-muted-foreground">Pedidos (7 dias)</p>
          <p className="text-2xl font-bold">{recentOrdersCount}</p>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="border rounded-lg p-5 hover:border-primary hover:shadow-sm transition-all space-y-2 block"
          >
            <div className="text-2xl">{s.icon}</div>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="text-sm text-muted-foreground">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
