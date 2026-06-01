'use client'

import { useState, useMemo } from 'react'
import { RevenueChart } from './revenue-chart'

type OrderRow = {
  id: string
  total_cents: number
  client_email: string
  payment_method: string
  created_at: string
  status: string
  order_items: { events: { tenant_id: string } | null }[]
}

type Period = '30d' | '90d' | '180d' | '1y' | 'all'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 3 meses' },
  { value: '180d', label: 'Últimos 6 meses' },
  { value: '1y', label: 'Este ano' },
  { value: 'all', label: 'Tudo' },
]

function getPeriodStart(period: Period): string | null {
  if (period === 'all') return null
  const now = Date.now()
  const msMap: Record<Exclude<Period, 'all'>, number> = {
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    '180d': 180 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
  }
  return new Date(now - msMap[period as Exclude<Period, 'all'>]).toISOString()
}

function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function buildChartData(orders: OrderRow[], period: Period) {
  const now = new Date()
  const monthCount =
    period === '30d' ? 1 : period === '90d' ? 3 : period === '180d' ? 6 : period === '1y' ? 12 : 6

  const monthMap = new Map<string, number>()
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    monthMap.set(label, 0)
  }

  orders.forEach((o) => {
    const label = getMonthLabel(o.created_at)
    if (monthMap.has(label)) {
      monthMap.set(label, (monthMap.get(label) ?? 0) + o.total_cents)
    }
  })

  return Array.from(monthMap.entries()).map(([month, revenue]) => ({ month, revenue }))
}

interface FinanceiroClientProps {
  orders: OrderRow[]
}

export function FinanceiroClient({ orders }: FinanceiroClientProps) {
  const [period, setPeriod] = useState<Period>('30d')

  const filteredOrders = useMemo(() => {
    const cutoff = getPeriodStart(period)
    if (!cutoff) return orders
    return orders.filter((o) => o.created_at >= cutoff)
  }, [orders, period])

  const totalRevenueCents = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + o.total_cents, 0),
    [filteredOrders]
  )

  const totalOrders = filteredOrders.length

  const chartData = useMemo(() => buildChartData(filteredOrders, period), [filteredOrders, period])

  const recentOrders = useMemo(() => filteredOrders.slice(0, 10), [filteredOrders])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <div className="flex gap-1 flex-wrap">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                period === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum pedido neste período.</p>
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
