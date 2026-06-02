function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <p className="text-xs font-medium text-[#6b7280] uppercase tracking-wide mb-3">{label}</p>
      <p className="text-3xl font-bold text-[#111827] leading-none mb-1">{value}</p>
      {sub && <p className="text-xs text-[#9ca3af] mt-1">{sub}</p>}
    </div>
  )
}

const totalEvents: number | null = null
const totalPhotos: number | null = null
const monthRevenue: number | null = null
const weekOrders: number | null = null
const recentEvents: Array<{ id: string; title: string; event_date?: string | null; status: string }> | null = null
const recentOrders: Array<{ id: string; customer_name?: string | null; created_at: string; total: number }> | null = null

export default function DashboardPage() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">{greeting}, fotógrafo</h1>
        <p className="text-sm text-[#6b7280] mt-0.5 capitalize">{dateStr}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de Eventos" value={totalEvents ?? 0} sub="todos os tempos" />
        <StatCard label="Total de Fotos" value={totalPhotos ?? 0} sub="enviadas" />
        <StatCard
          label="Receita do Mês"
          value={monthRevenue ? `R$ ${monthRevenue.toFixed(2)}` : 'R$ 0,00'}
          sub="mês atual"
        />
        <StatCard label="Pedidos (7 dias)" value={weekOrders ?? 0} sub="últimos 7 dias" />
      </div>

      {/* Tabelas */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Eventos recentes */}
        <div className="lg:col-span-3 bg-white border border-[#e5e7eb] rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div className="px-5 py-3.5 border-b border-[#e5e7eb] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Eventos Recentes</h2>
          </div>
          <div className="divide-y divide-[#f3f4f6]">
            {recentEvents?.map((event) => (
              <div key={event.id} className="px-5 py-3 flex items-center justify-between hover:bg-[#f9fafb] transition-colors">
                <div>
                  <p className="text-sm font-medium text-[#111827]">{event.title}</p>
                  <p className="text-xs text-[#6b7280]">
                    {event.event_date ? new Date(event.event_date).toLocaleDateString('pt-BR') : '—'}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  event.status === 'published'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {event.status === 'published' ? 'Publicado' : event.status === 'archived' ? 'Arquivado' : 'Rascunho'}
                </span>
              </div>
            ))}
            {(!recentEvents || recentEvents.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-[#6b7280]">Nenhum evento ainda.</div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-[#f3f4f6]">
            <a href="/dashboard/eventos" className="text-xs font-medium text-[#2563eb] hover:underline">
              Ver todos os eventos →
            </a>
          </div>
        </div>

        {/* Pedidos recentes */}
        <div className="lg:col-span-2 bg-white border border-[#e5e7eb] rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div className="px-5 py-3.5 border-b border-[#e5e7eb]">
            <h2 className="text-sm font-semibold text-[#111827]">Pedidos Recentes</h2>
          </div>
          <div className="divide-y divide-[#f3f4f6]">
            {recentOrders?.map((order) => (
              <div key={order.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#111827]">{order.customer_name || 'Cliente'}</p>
                  <p className="text-xs text-[#6b7280]">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <p className="text-sm font-semibold text-[#111827]">R$ {Number(order.total).toFixed(2)}</p>
              </div>
            ))}
            {(!recentOrders || recentOrders.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-[#6b7280]">Nenhum pedido ainda.</div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-[#f3f4f6]">
            <a href="/dashboard/financeiro" className="text-xs font-medium text-[#2563eb] hover:underline">
              Ver financeiro →
            </a>
          </div>
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: '＋', label: 'Novo Evento', href: '/dashboard/eventos/novo' },
          { icon: '↑', label: 'Enviar Fotos', href: '/dashboard/eventos' },
          { icon: '👥', label: 'Ver Clientes', href: '/dashboard/clientes' },
          { icon: '⚙', label: 'Configurações', href: '/dashboard/configuracoes' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="bg-white border border-[#e5e7eb] rounded-lg p-4 flex flex-col items-center gap-2 text-center hover:border-[#2563eb] hover:shadow-sm transition-all"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm font-medium text-[#374151]">{item.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
