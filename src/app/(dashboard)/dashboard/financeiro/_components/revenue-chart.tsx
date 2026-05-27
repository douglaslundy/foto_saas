'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  month: string
  revenue: number
}

interface RevenueChartProps {
  data: DataPoint[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) =>
            (v / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              maximumFractionDigits: 0,
            })
          }
        />
        <Tooltip
          formatter={(v) =>
            typeof v === 'number'
              ? (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              : String(v)
          }
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
