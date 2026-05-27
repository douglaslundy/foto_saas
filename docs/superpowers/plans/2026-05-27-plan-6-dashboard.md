# Photographer Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the photographer dashboard — financial overview, per-event analytics, revenue charts, client/order management, and sub-photographer invitation — accessible at `/dashboard/*` and protected by the existing `photographer`/`sub_photographer` role check.

**Architecture:** All dashboard pages are server-rendered Next.js pages behind the existing `/dashboard` auth guard (Supabase session cookie). Client components only where interactivity is strictly needed (charts use a lightweight wrapper). Data flows from Supabase via the admin client (service role, bypasses RLS) with tenant isolation by `profile.tenant_id`.

**Tech Stack:** Next.js 14 App Router (SSR), Supabase admin client, Recharts (lightweight charting), shadcn/ui (Card, Table, Badge, Tabs), existing auth middleware.

---

## File Map

**New files:**
- `src/app/dashboard/financeiro/page.tsx` — financial overview: revenue, orders, payouts
- `src/app/dashboard/financeiro/_components/revenue-chart.tsx` — client component: line chart (Recharts)
- `src/app/dashboard/clientes/page.tsx` — client/order list with search
- `src/app/dashboard/clientes/_components/orders-table.tsx` — interactive orders table
- `src/app/dashboard/equipe/page.tsx` — sub-photographer list + invite form
- `src/app/dashboard/equipe/_components/invite-form.tsx` — client component: invite sub-photographer

**Modified files:**
- `src/app/dashboard/layout.tsx` — add Financeiro, Clientes, Equipe nav links (if it exists)
- `src/app/dashboard/page.tsx` — add quick-stats cards to dashboard home

---

## Task 1: Install Recharts

**Files:** `package.json`

- [ ] **Step 1.1: Install recharts**

```powershell
cd C:\Users\dougl\workspace5\fotosaas
npm install recharts
```

Expected: recharts added. Recharts is React 18 compatible and tree-shakeable.

- [ ] **Step 1.2: Commit**

```powershell
git add package.json package-lock.json
git commit -m "feat(dashboard): install recharts"
```

---

## Task 2: Financial Overview Page

**Files:**
- Create: `src/app/dashboard/financeiro/page.tsx`
- Create: `src/app/dashboard/financeiro/_components/revenue-chart.tsx`

The financial page shows:
- Total revenue (sum of paid orders, last 30 days)
- Total orders (all time)
- Revenue by month (last 6 months) — line chart
- Recent paid orders (last 10)

- [ ] **Step 2.1: Create RevenueChart client component**

Create `src/app/dashboard/financeiro/_components/revenue-chart.tsx`:

```tsx
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
          tickFormatter={(v) =>
            (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
          }
        />
        <Tooltip
          formatter={(v: number) =>
            (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          }
        />
        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2.2: Create financial overview page**

Create `src/app/dashboard/financeiro/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { RevenueChart } from './_components/revenue-chart'

type OrderRow = {
  id: string
  total_cents: number
  client_email: string
  payment_method: string
  created_at: string
  status: string
}

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

export default async function FinanceiroPage() {
  const profile = await getProfile()
  const adminClient = createAdminClient()

  // Fetch all paid orders for this tenant (via events.tenant_id join)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = (await (adminClient as any)
    .from('orders')
    .select(`
      id, total_cents, client_email, payment_method, created_at, status,
      order_items(event_id, events(tenant_id))
    `)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(200)) as { data: (OrderRow & { order_items: { event_id: string; events: { tenant_id: string } }[] })[] | null }

  // Filter to this tenant only
  const tenantOrders = (orders ?? []).filter((o) =>
    o.order_items?.some((oi) => oi.events?.tenant_id === profile.tenant_id)
  )

  const totalRevenueCents = tenantOrders.reduce((sum, o) => sum + o.total_cents, 0)
  const totalOrders = tenantOrders.length

  // Revenue by month (last 6 months)
  const now = new Date()
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Financeiro</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="text-2xl font-bold">
            {(totalRevenueCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum pedido ainda.</p>
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
```

- [ ] **Step 2.3: Commit**

```powershell
git add src/app/dashboard/financeiro/
git commit -m "feat(dashboard): financial overview page with revenue chart"
```

---

## Task 3: Clients / Orders Management Page

**Files:**
- Create: `src/app/dashboard/clientes/page.tsx`
- Create: `src/app/dashboard/clientes/_components/orders-table.tsx`

- [ ] **Step 3.1: Create OrdersTable client component**

Create `src/app/dashboard/clientes/_components/orders-table.tsx`:

```tsx
'use client'

import { useState } from 'react'

type OrderRow = {
  id: string
  client_email: string
  total_cents: number
  payment_method: string
  status: string
  created_at: string
}

interface OrdersTableProps {
  orders: OrderRow[]
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const [search, setSearch] = useState('')

  const filtered = orders.filter(
    (o) =>
      o.client_email.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase())
  )

  const statusLabel: Record<string, string> = {
    paid: 'Pago',
    pending: 'Pendente',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
  }

  const statusClass: Record<string, string> = {
    paid: 'text-green-600 bg-green-50',
    pending: 'text-yellow-700 bg-yellow-50',
    cancelled: 'text-red-600 bg-red-50',
    refunded: 'text-gray-600 bg-gray-100',
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Buscar por email ou ID do pedido..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm bg-background"
      />

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">E-mail</th>
              <th className="px-4 py-2 text-left font-medium">Pedido</th>
              <th className="px-4 py-2 text-left font-medium">Valor</th>
              <th className="px-4 py-2 text-left font-medium">Pagamento</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3">{order.client_email}</td>
                  <td className="px-4 py-3 font-mono text-xs">{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium">
                    {(order.total_cents / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {order.payment_method === 'pix' ? 'PIX' : 'Cartão'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass[order.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {statusLabel[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2: Create clients page**

Create `src/app/dashboard/clientes/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { OrdersTable } from './_components/orders-table'

type OrderRow = {
  id: string
  client_email: string
  total_cents: number
  payment_method: string
  status: string
  created_at: string
  order_items: { events: { tenant_id: string } | null }[]
}

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

export default async function ClientesPage() {
  const profile = await getProfile()
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = (await (adminClient as any)
    .from('orders')
    .select(`
      id, client_email, total_cents, payment_method, status, created_at,
      order_items(events(tenant_id))
    `)
    .order('created_at', { ascending: false })
    .limit(500)) as { data: OrderRow[] | null }

  // Filter to this tenant
  const tenantOrders = (orders ?? [])
    .filter((o) => o.order_items?.some((oi) => oi.events?.tenant_id === profile.tenant_id))
    .map(({ order_items: _oi, ...rest }) => rest)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Clientes e Pedidos</h1>
      <OrdersTable orders={tenantOrders as {
        id: string
        client_email: string
        total_cents: number
        payment_method: string
        status: string
        created_at: string
      }[]} />
    </div>
  )
}
```

- [ ] **Step 3.3: Commit**

```powershell
git add src/app/dashboard/clientes/
git commit -m "feat(dashboard): clients and orders management page"
```

---

## Task 4: Team / Sub-Photographer Management

**Files:**
- Create: `src/app/dashboard/equipe/page.tsx`
- Create: `src/app/dashboard/equipe/_components/invite-form.tsx`

Sub-photographers are users in the `users` table with `role = 'sub_photographer'` and the same `tenant_id`. Invitation creates a Supabase Auth invite link via the admin API.

- [ ] **Step 4.1: Create invite form API route**

Create `src/app/api/team/invite/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id || profile.role !== 'photographer') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { email } = body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  }

  // Check if already a member of this tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (adminClient as any)
    .from('users')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Usuário já é membro da equipe.' }, { status: 409 })
  }

  // Invite user via Supabase admin API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inviteData, error: inviteError } = await (adminClient as any).auth.admin.inviteUserByEmail(email, {
    data: {
      tenant_id: profile.tenant_id,
      role: 'sub_photographer',
    },
  })

  if (inviteError) {
    console.error('[POST /api/team/invite]', inviteError)
    return NextResponse.json({ error: 'Erro ao enviar convite.' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Convite enviado com sucesso.', userId: inviteData?.user?.id })
}
```

- [ ] **Step 4.2: Create InviteForm client component**

Create `src/app/dashboard/equipe/_components/invite-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function InviteForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: `Convite enviado para ${email}!` })
        setEmail('')
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Erro ao enviar convite.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro de rede. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
      <div className="space-y-1">
        <Label htmlFor="invite-email">E-mail do colaborador</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colaborador@email.com"
          required
        />
      </div>
      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
          {message.text}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar convite'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4.3: Create team page**

Create `src/app/dashboard/equipe/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { InviteForm } from './_components/invite-form'

type Member = {
  id: string
  email: string
  role: string
  created_at: string
}

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect('/login')
  return { profile: profile as { tenant_id: string; role: string }, userId: user.id }
}

export default async function EquipePage() {
  const { profile } = await getProfile()
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = (await (adminClient as any)
    .from('users')
    .select('id, email, role, created_at')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: true })) as { data: Member[] | null }

  const roleLabel: Record<string, string> = {
    photographer: 'Fotógrafo Principal',
    sub_photographer: 'Sub-fotógrafo',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Equipe</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie os colaboradores da sua conta.
        </p>
      </div>

      {/* Member list */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium">Membros ({members?.length ?? 0})</h2>
        </div>
        <div className="divide-y">
          {(members ?? []).map((m) => (
            <div key={m.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{m.email}</p>
                <p className="text-xs text-muted-foreground">
                  Desde {new Date(m.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                m.role === 'photographer'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {roleLabel[m.role] ?? m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Invite form — only visible to main photographer */}
      {profile.role === 'photographer' && (
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-medium">Convidar colaborador</h2>
          <p className="text-sm text-muted-foreground">
            O colaborador receberá um e-mail para criar sua conta e terá acesso como sub-fotógrafo.
          </p>
          <InviteForm />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4.4: Commit**

```powershell
git add src/app/dashboard/equipe/ src/app/api/team/
git commit -m "feat(dashboard): team management page with sub-photographer invite"
```

---

## Task 5: Update Dashboard Home + Nav

**Files:**
- Modify: `src/app/dashboard/page.tsx` — add quick-stats cards
- Modify: `src/app/dashboard/layout.tsx` — add nav links for Financeiro, Clientes, Equipe

- [ ] **Step 5.1: Read existing dashboard page.tsx and layout.tsx**

```powershell
Get-Content "C:\Users\dougl\workspace5\fotosaas\src\app\dashboard\page.tsx"
Get-Content "C:\Users\dougl\workspace5\fotosaas\src\app\dashboard\layout.tsx"
```

- [ ] **Step 5.2: Add nav links to dashboard layout**

Add links to the existing sidebar/nav in `src/app/dashboard/layout.tsx`. After checking existing nav items (Events, Fotos), add:
- Financeiro → `/dashboard/financeiro`
- Clientes → `/dashboard/clientes`
- Equipe → `/dashboard/equipe`

Pattern to follow: check how existing nav links are defined and add new entries in the same style.

- [ ] **Step 5.3: Commit**

```powershell
git add src/app/dashboard/
git commit -m "feat(dashboard): add nav links for financeiro/clientes/equipe"
```

---

## Task 6: Build Verification

- [ ] **Step 6.1: TypeScript check**

```powershell
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6.2: Production build**

```powershell
npx next build
```

Expected: Build succeeds with new routes:
- `/dashboard/financeiro`
- `/dashboard/clientes`
- `/dashboard/equipe`
- `/api/team/invite`

- [ ] **Step 6.3: Final commit**

```powershell
git add -A
git commit -m "feat(plan-6): photographer dashboard complete"
```

---

## Self-Review

**Spec coverage:**
- ✅ Financial overview with KPI cards (total revenue, total orders)
- ✅ Revenue by month line chart (Recharts)
- ✅ Recent orders list
- ✅ Client/order management with search
- ✅ Sub-photographer team management
- ✅ Invite form (Supabase admin inviteUserByEmail)

**Gaps:**
- Analytics by event (top events by revenue, photo count) would be a nice addition — not in the original spec, skip for MVP
- Payout tracking (for photographers who get a % of sales) is in Plan 7 (Admin SaaS Panel)
- No pagination on orders table — 500 row limit is enough for MVP

**Placeholder scan:**
- Step 5.2 references reading existing files — this is intentional since the dashboard layout varies and must be adapted to what's already there

**Type consistency:**
- `OrderRow` type is defined in each file where needed (no cross-file sharing)
- `Member` type defined in equipe page
- `DataPoint` type defined in revenue chart
