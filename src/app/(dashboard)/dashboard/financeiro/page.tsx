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

function StatCard({ label, value, sub, variant = 'default' }: {
  label: string; value: string | number; sub?: string; variant?: 'default' | 'dark' | 'gold'
}) {
  return (
    <div className={`relative overflow-hidden rounded-[var(--radius)] p-6 border ${
      variant === 'dark' ? 'bg-[var(--color-cta)] border-transparent' :
      variant === 'gold' ? 'bg-[var(--color-gold)] border-transparent' :
      'bg-[var(--color-card)] border-[var(--color-border-strong)]'
    }`} style={{ boxShadow: 'var(--shadow-sm)' }}>
      {variant === 'dark' && (
        <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full translate-x-8 translate-y-8 border"
          style={{ background: 'rgba(200,169,110,0.12)', borderColor: 'rgba(200,169,110,0.2)' }} />
      )}
      <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${variant === 'dark' ? 'text-[var(--color-cta-fg-60)]' : 'text-[var(--color-ink-muted)]'}`}>{label}</p>
      <p className={`font-display text-3xl font-bold leading-none mb-1 ${variant === 'dark' ? 'text-[var(--color-cta-fg)]' : 'text-[var(--color-ink)]'}`}>{value}</p>
      {sub && <p className={`text-xs mt-2 ${variant === 'dark' ? 'text-[var(--color-cta-fg-50)]' : 'text-[var(--color-ink-muted)]'}`}>{sub}</p>}
    </div>
  )
}

export default async function FinanceiroPage() {
  const profile = await getProfile()
  const adminClient = createAdminClient()

  // Fetch commission rate for this tenant (override or global)
  const [tenantCommissionResult, globalSettingResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('tenants')
      .select('commission_override_percent')
      .eq('id', profile.tenant_id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('system_settings')
      .select('value')
      .eq('key', 'global_commission_percent')
      .single(),
  ])

  const override = tenantCommissionResult.data?.commission_override_percent
  const globalRate = parseInt(globalSettingResult.data?.value ?? '10', 10)
  const commissionPercent = override !== null && override !== undefined ? override : globalRate

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
  const totalRevenue = totalRevenueCents / 100
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Current month stats
  const now = new Date()
  const currentMonthOrders = tenantOrders.filter((o) => {
    const d = new Date(o.created_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const monthRevenue = currentMonthOrders.reduce((sum, o) => sum + o.total_cents, 0) / 100
  const monthOrders = currentMonthOrders.length

  // Revenue by month (last 6 months)
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

  // Fetch sub-photographer internal commission rates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subMembers } = await (adminClient as any)
    .from('users')
    .select('id, email, internal_commission_percent')
    .eq('tenant_id', profile.tenant_id)
    .eq('role', 'sub_photographer')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Financeiro</h1>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1">Acompanhe sua receita e pedidos</p>
        </div>
      </div>

      {/* Commission info card */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-6 py-4 flex items-center gap-4"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-gold)]/10 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="5.5" cy="5.5" r="2" stroke="var(--color-gold)" strokeWidth="1.5"/>
            <circle cx="10.5" cy="10.5" r="2" stroke="var(--color-gold)" strokeWidth="1.5"/>
            <path d="M3 13L13 3" stroke="var(--color-gold)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)]">
            Sua comissão
          </p>
          <p className="text-lg font-bold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
            {commissionPercent}%
            {override !== null && override !== undefined && (
              <span className="ml-2 text-xs font-normal text-[var(--color-gold)]">(taxa personalizada)</span>
            )}
          </p>
        </div>
        <p className="ml-auto text-xs text-[var(--color-ink-muted)] max-w-xs text-right">
          Taxa cobrada pela plataforma sobre cada venda realizada.
        </p>
      </div>

      {/* Stats row — 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Receita Total" value={`R$ ${totalRevenue.toFixed(2)}`} sub="todos os tempos" variant="dark" />
        <StatCard label="Total de Pedidos" value={totalOrders} sub="pedidos realizados" />
        <StatCard label="Ticket Médio" value={avgTicket > 0 ? `R$ ${avgTicket.toFixed(2)}` : '—'} sub="por pedido" />
      </div>

      {/* Sub-photographer internal rates */}
      {subMembers && subMembers.length > 0 && (
        <div
          className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-6 py-4"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-3">
            Taxas Internas da Equipe
          </p>
          <div className="flex flex-wrap gap-6">
            {(subMembers as { id: string; email: string; internal_commission_percent: number | null }[]).map((m) => (
              <div key={m.id} className="text-sm">
                <span className="text-[var(--color-ink)]">{m.email}</span>
                <span className="ml-2 font-semibold text-[var(--color-gold)]">
                  {m.internal_commission_percent ?? 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Chart */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Receita por Mês</h2>
        </div>
        <div className="p-6">
          <RevenueChart data={chartData} />
        </div>
      </div>

      {/* Grid principal 2fr + 1fr */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pedidos recentes (ocupa 2/3) */}
        <div className="lg:col-span-2 rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Pedidos Recentes</h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {recentOrders.map((order) => (
              <div key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--color-surface)] transition-colors">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">{order.client_email}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')} · {order.payment_method === 'pix' ? 'PIX' : 'Cartão'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
                    Pago
                  </span>
                  <p className="font-display text-base font-semibold text-[var(--color-ink)]">
                    R$ {(order.total_cents / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && (
              <div className="px-6 py-12 text-center text-[var(--color-ink-muted)] text-sm">Nenhum pedido ainda.</div>
            )}
          </div>
        </div>

        {/* Resumo (1/3) */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Este Mês</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs text-[var(--color-ink-muted)] uppercase tracking-widest">Receita</p>
              <p className="font-display text-2xl font-bold text-[var(--color-ink)] mt-1">R$ {monthRevenue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-ink-muted)] uppercase tracking-widest">Pedidos</p>
              <p className="font-display text-2xl font-bold text-[var(--color-ink)] mt-1">{monthOrders}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
