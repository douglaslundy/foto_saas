import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: string | number
  variant?: 'default' | 'dark'
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius)] p-6 border ${
        variant === 'dark'
          ? 'bg-[var(--color-cta)] border-transparent'
          : 'bg-[var(--color-card)] border-[var(--color-border-strong)]'
      }`}
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {variant === 'dark' && (
        <div
          className="absolute bottom-0 right-0 w-20 h-20 rounded-full translate-x-6 translate-y-6"
          style={{ background: 'rgba(37,99,235,0.12)' }}
        />
      )}
      <p
        className={`text-xs font-semibold uppercase tracking-widest mb-2 ${
          variant === 'dark' ? 'text-[var(--color-cta-fg-60)]' : 'text-[var(--color-ink-muted)]'
        }`}
      >
        {label}
      </p>
      <p
        className={`font-bold text-3xl ${
          variant === 'dark' ? 'text-[var(--color-cta-fg)]' : 'text-[var(--color-ink)]'
        }`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value}
      </p>
    </div>
  )
}

type Tenant = {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
}

export default async function AdminDashboardPage() {
  const adminClient = createAdminClient()

  const [tenantsResult, ordersResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('tenants')
      .select('id, name, slug, status, created_at')
      .order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any).from('orders').select('total_cents, status', { count: 'exact' }),
  ])

  const tenants = (tenantsResult.data ?? []) as Tenant[]
  const orders = (ordersResult.data ?? []) as { total_cents: number; status: string }[]

  const activeTenants = tenants.filter((t) => t.status === 'active').length
  const paidOrders = orders.filter((o) => o.status === 'paid')
  const totalRevenueCents = paidOrders.reduce((sum, o) => sum + o.total_cents, 0)
  const totalRevenueFormatted = (totalRevenueCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl font-bold tracking-tight text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Painel Admin
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">Visão geral da plataforma FotoSaaS</p>
      </div>

      {/* Stats — 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de Tenants" value={tenants.length} variant="dark" />
        <StatCard label="Tenants Ativos" value={activeTenants} />
        <StatCard label="Pedidos Pagos" value={paidOrders.length} />
        <StatCard label="Receita Plataforma" value={totalRevenueFormatted} />
      </div>

      {/* Recent tenants table */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)] flex items-center justify-between">
          <h2
            className="text-lg font-semibold text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Tenants Recentes
          </h2>
          <Link
            href="/admin/tenants"
            className="text-xs font-medium text-[var(--color-blue)] hover:underline"
          >
            Ver todos →
          </Link>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {tenants.slice(0, 10).map((tenant) => (
            <div
              key={tenant.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-[var(--color-surface)] transition-colors"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink)]">{tenant.name}</p>
                <p className="text-xs text-[var(--color-ink-muted)] font-mono">{tenant.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    tenant.status === 'active'
                      ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                      : tenant.status === 'suspended'
                      ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)]'
                  }`}
                >
                  {tenant.status === 'active'
                    ? 'Ativo'
                    : tenant.status === 'suspended'
                    ? 'Suspenso'
                    : tenant.status}
                </span>
                <Link
                  href={`/admin/tenants/${tenant.id}`}
                  className="text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Ver →
                </Link>
              </div>
            </div>
          ))}
          {tenants.length === 0 && (
            <p className="px-6 py-8 text-sm text-[var(--color-ink-muted)] text-center">
              Nenhum tenant cadastrado ainda.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
