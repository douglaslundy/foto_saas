import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

type Props = { params: Promise<{ tenant: string }> }

type Order = {
  id: string
  total_cents: number
  discount_cents: number | null
  status: string
  payment_method: string
  created_at: string
  item_count: number
}

export default async function MinhaContaPage({ params }: Props) {
  const { tenant: tenantSlug } = await params

  // Auth guard
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${tenantSlug}/login?redirect=minha-conta`)
  }

  // Check role
  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'client') {
    redirect(`/${tenantSlug}`)
  }

  // Fetch orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ordersRaw } = await (adminClient as any)
    .from('orders')
    .select('id, total_cents, discount_cents, status, payment_method, created_at')
    .eq('client_user_id', user.id)
    .order('created_at', { ascending: false })

  const ordersData = (ordersRaw ?? []) as Omit<Order, 'item_count'>[]

  // Fetch item counts per order
  const orders: Order[] = await Promise.all(
    ordersData.map(async (order) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (adminClient as any)
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', order.id)
      return { ...order, item_count: count ?? 0 }
    })
  )

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      pending: 'Pendente',
      processing: 'Processando',
      paid: 'Pago',
      delivered: 'Entregue',
      failed: 'Falhou',
      cancelled: 'Cancelado',
    }
    return map[status] ?? status
  }

  function statusColor(status: string) {
    if (status === 'paid' || status === 'delivered') return 'text-green-600'
    if (status === 'failed' || status === 'cancelled') return 'text-[var(--color-danger)]'
    return 'text-[var(--color-ink-muted)]'
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-[var(--color-ink)] mb-1">
            Minha Conta
          </h1>
          <p className="text-[var(--color-ink-muted)] text-sm">
            Olá, <span className="font-medium text-[var(--color-ink)]">{profile.name}</span>
          </p>
        </div>

        {/* Orders */}
        <section>
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)] mb-4">
            Meus Pedidos
          </h2>

          {orders.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-8 text-center">
              <p className="text-[var(--color-ink-muted)] text-sm mb-4">
                Você ainda não realizou nenhum pedido.
              </p>
              <Link
                href={`/${tenantSlug}`}
                className="inline-flex items-center gap-1 text-sm text-[var(--color-gold)] font-medium hover:underline"
              >
                Ver eventos &rarr;
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/${tenantSlug}/pedido/${order.id}`}
                  className="block rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-5 hover:border-[var(--color-gold)] transition-colors duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--color-ink-muted)] mb-1">
                        Pedido #{order.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-[var(--color-ink-muted)]">
                        {order.item_count} foto{order.item_count !== 1 ? 's' : ''} &bull;{' '}
                        {order.payment_method === 'pix' ? 'PIX' : 'Cartão'}
                      </p>
                      <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                        {new Date(order.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display font-semibold text-[var(--color-ink)]">
                        {((order.total_cents - (order.discount_cents ?? 0)) / 100).toLocaleString(
                          'pt-BR',
                          { style: 'currency', currency: 'BRL' }
                        )}
                      </p>
                      <p className={`text-xs font-medium mt-1 ${statusColor(order.status)}`}>
                        {statusLabel(order.status)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Back link */}
        <div className="mt-8">
          <Link
            href={`/${tenantSlug}`}
            className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-gold)] transition-colors"
          >
            &larr; Voltar
          </Link>
        </div>
      </div>
    </div>
  )
}
