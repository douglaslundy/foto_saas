function StatCard({ label, value, sub, variant = 'default' }: {
  label: string
  value: string | number
  sub?: string
  variant?: 'default' | 'dark' | 'gold'
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius)] p-6 border ${
        variant === 'dark'
          ? 'bg-[var(--color-ink)] border-transparent text-white'
          : variant === 'gold'
          ? 'bg-[var(--color-gold)] border-transparent text-[var(--color-ink)]'
          : 'bg-[var(--color-card)] border-[var(--color-border-strong)] text-[var(--color-ink)]'
      }`}
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {variant === 'dark' && (
        <div
          className="absolute bottom-0 right-0 w-24 h-24 rounded-full translate-x-8 translate-y-8"
          style={{ background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.2)' }}
        />
      )}
      <p
        className={`text-xs font-semibold uppercase tracking-widest mb-3 ${
          variant === 'dark' ? 'text-white/60' : 'text-[var(--color-ink-muted)]'
        }`}
      >
        {label}
      </p>
      <p
        className={`font-display text-3xl font-bold leading-none mb-1 ${
          variant === 'dark'
            ? 'text-white'
            : variant === 'gold'
            ? 'text-[var(--color-ink)]'
            : 'text-[var(--color-ink)]'
        }`}
      >
        {value}
      </p>
      {sub && (
        <p
          className={`text-xs mt-2 ${
            variant === 'dark' ? 'text-white/50' : 'text-[var(--color-ink-muted)]'
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

// Static fallback data — no live queries in this page yet
const totalEvents: number | null = null
const totalPhotos: number | null = null
const monthRevenue: number | null = null
const weekOrders: number | null = null
const recentEvents: Array<{ id: string; title: string; event_date?: string | null; status: string }> | null = null
const recentOrders: Array<{ id: string; client_email?: string; created_at: string; total: number }> | null = null

export default function DashboardPage() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-8">
      {/* Saudação */}
      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--color-ink)] tracking-tight">
          {greeting}, fotógrafo
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1 capitalize">{dateStr}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total de Eventos"
          value={totalEvents ?? 0}
          sub="todos os tempos"
          variant="dark"
        />
        <StatCard
          label="Total de Fotos"
          value={totalPhotos ?? 0}
          sub="enviadas"
        />
        <StatCard
          label="Receita do Mês"
          value={monthRevenue ? `R$ ${monthRevenue.toFixed(2)}` : 'R$ 0,00'}
          sub="mês atual"
          variant="gold"
        />
        <StatCard
          label="Pedidos (7 dias)"
          value={weekOrders ?? 0}
          sub="últimos 7 dias"
        />
      </div>

      {/* Grid principal */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Eventos recentes */}
        <div
          className="lg:col-span-3 rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="px-6 py-4 border-b border-[var(--color-border-strong)] flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
              Eventos Recentes
            </h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {recentEvents?.map((event: {
              id: string
              title: string
              event_date?: string | null
              status: string
            }) => (
              <div
                key={event.id}
                className="px-6 py-3 flex items-center justify-between hover:bg-[var(--color-surface)] transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">{event.title}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {event.event_date
                      ? new Date(event.event_date).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    event.status === 'published'
                      ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)]'
                  }`}
                >
                  {event.status === 'published'
                    ? 'Publicado'
                    : event.status === 'archived'
                    ? 'Arquivado'
                    : 'Rascunho'}
                </span>
              </div>
            ))}
            {(!recentEvents || recentEvents.length === 0) && (
              <div className="px-6 py-8 text-center text-[var(--color-ink-muted)] text-sm">
                Nenhum evento ainda.
              </div>
            )}
          </div>
          <div className="px-6 py-3 border-t border-[var(--color-border)]">
            <a
              href="/dashboard/eventos"
              className="text-xs font-medium text-[var(--color-gold)] hover:underline"
            >
              Ver todos os eventos →
            </a>
          </div>
        </div>

        {/* Pedidos recentes */}
        <div
          className="lg:col-span-2 rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
              Pedidos Recentes
            </h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {recentOrders?.map((order: {
              id: string
              customer_name?: string | null
              created_at: string
              total: number | string
            }) => (
              <div key={order.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {order.customer_name || 'Cliente'}
                  </p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <p className="font-display text-base font-semibold text-[var(--color-ink)]">
                  R$ {Number(order.total).toFixed(2)}
                </p>
              </div>
            ))}
            {(!recentOrders || recentOrders.length === 0) && (
              <div className="px-6 py-8 text-center text-[var(--color-ink-muted)] text-sm">
                Nenhum pedido ainda.
              </div>
            )}
          </div>
          <div className="px-6 py-3 border-t border-[var(--color-border)]">
            <a
              href="/dashboard/financeiro"
              className="text-xs font-medium text-[var(--color-gold)] hover:underline"
            >
              Ver financeiro →
            </a>
          </div>
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: '📅', label: '+ Novo Evento', href: '/dashboard/eventos/novo' },
          { icon: '📷', label: 'Enviar Fotos', href: '/dashboard/eventos' },
          { icon: '👥', label: 'Ver Clientes', href: '/dashboard/clientes' },
          { icon: '⚙️', label: 'Configurações', href: '/dashboard/configuracoes' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-5 flex flex-col items-center gap-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="font-display text-sm font-semibold text-[var(--color-ink)]">
              {item.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
