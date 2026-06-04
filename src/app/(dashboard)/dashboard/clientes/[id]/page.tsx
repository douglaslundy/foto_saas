import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getDashboardFallbackPath } from '@/lib/dashboard-access'

type Props = {
  params: Promise<{ id: string }>
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

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params
  const profile = await getProfile()
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client } = await (adminClient as any)
    .from('users')
    .select('id, name, email, role, created_at')
    .eq('id', id)
    .single()

  if (!client || (client.role !== 'client' && client.role !== 'client_inactive')) {
    notFound()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = await (adminClient as any)
    .from('orders')
    .select('id, total_cents, status, payment_method, created_at')
    .or(`client_user_id.eq.${id},client_email.eq.${client.email}`)
    .order('created_at', { ascending: false })
    .limit(100)

  const canManage = profile.role === 'admin'
  const totalSpent = (orders ?? []).reduce((sum: number, order: { total_cents: number }) => sum + order.total_cents, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-ink-muted)]">Cliente</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            {client.name ?? client.email}
          </h1>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1">{client.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              client.role === 'client'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {client.role === 'client' ? 'Ativo' : 'Inativo'}
          </span>
          {canManage && (
            <Link
              href={`/dashboard/clientes/${client.id}/editar`}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[var(--color-gold)]/10 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/20 transition-colors"
            >
              Editar
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-4">
          <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Pedidos</p>
          <p className="mt-2 font-display text-3xl font-bold text-[var(--color-ink)]">
            {(orders ?? []).length}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-4">
          <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Total gasto</p>
          <p className="mt-2 font-display text-3xl font-bold text-[var(--color-ink)]">
            {(totalSpent / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-4">
          <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Criado em</p>
          <p className="mt-2 font-display text-3xl font-bold text-[var(--color-ink)]">
            {new Date(client.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Pedidos recentes</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {(orders ?? []).length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-[var(--color-ink-muted)]">
              Nenhum pedido encontrado para este cliente.
            </div>
          ) : (
            (orders ?? []).map((order: { id: string; total_cents: number; status: string; payment_method: string | null; created_at: string }) => (
              <div key={order.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    Pedido #{order.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')} · {order.payment_method === 'pix' ? 'PIX' : 'Cartão'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-semibold text-[var(--color-ink)]">
                    {(order.total_cents / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                  <p className="text-xs text-[var(--color-ink-muted)] capitalize">{order.status}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Link href="/dashboard/clientes" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Voltar
      </Link>
    </div>
  )
}
