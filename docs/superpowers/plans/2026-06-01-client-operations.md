# Operações de Clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar convite de cliente por email com link de acesso, notificação ao fotógrafo quando receber pedido, tela de repasses pendentes e entrega manual de fotos.

**Architecture:** Tasks 8 (convite) e 11 (entrega manual) são independentes. Task 9 (notificação) depende do sistema de email já existente (BullMQ + worker). Task 10 (repasses) introduz nova tabela `payouts`. Nenhuma depende das outras.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase GoTrue Admin API, BullMQ para filas de email.

---

## Contexto do codebase

- **Email worker:** container `fotosaas-email-worker` rodando via BullMQ. Queue: `email`. O worker lê jobs e envia via SMTP.
- **GoTrue Admin API:** `createAdminClient().auth.admin.createUser(...)` para criar usuários.
- **Rota de convite de equipe existente:** `src/app/api/team/invite/route.ts` — usar como referência para criar conta + email.
- **Entrega de fotos:** `src/app/api/orders/[id]/download/route.ts` já gera link de download. A entrega "automática" ocorre via webhook. A manual acionará o mesmo email.
- **Design system:** `bg-[var(--color-cta)] text-[var(--color-cta-fg)]` para CTAs.
- **`payouts` table:** nova tabela a criar. Campo `status`: `pending` | `paid`.

---

## Arquivos criados / modificados

| Ação | Arquivo |
|---|---|
| Criar | `supabase/migrations/0011_payouts.sql` |
| Criar | `docker/db/08-payouts.sql` |
| Criar | `src/app/api/clients/invite/route.ts` |
| Modificar | `src/app/(dashboard)/dashboard/clientes/_components/add-client-dialog.tsx` |
| Criar | `src/app/api/orders/[id]/deliver/route.ts` |
| Modificar | `src/app/(dashboard)/dashboard/clientes/page.tsx` |
| Modificar | `src/app/(dashboard)/dashboard/clientes/_components/orders-table.tsx` |
| Criar | `src/app/(admin)/admin/repasses/page.tsx` |
| Criar | `src/app/(admin)/admin/repasses/_components/payouts-table.tsx` |
| Modificar | `src/app/(admin)/admin/layout.tsx` |
| Modificar | `src/app/api/webhooks/stripe/route.ts` |
| Modificar | `src/app/api/webhooks/mercadopago/route.ts` |

---

## Task 8: Fotógrafo Convida Cliente por Email

**Files:**
- Create: `src/app/api/clients/invite/route.ts`
- Modify: `src/app/(dashboard)/dashboard/clientes/_components/add-client-dialog.tsx`

- [ ] **Step 8.1: API de convite de cliente**

Criar `src/app/api/clients/invite/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await request.json() as { email?: string; name?: string }
  const { email, name } = body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  }

  // Check if already a client of this tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from('users')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('email', email)
    .eq('role', 'client')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Este e-mail já é cliente cadastrado.' }, { status: 409 })
  }

  // Generate temporary password
  const tempPassword = Math.random().toString(36).slice(-8) + 'A1!'

  // Check if user exists in GoTrue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allUsers } = await (admin as any).auth.admin.listUsers()
  const existingAuth = allUsers?.users?.find((u: { email: string }) => u.email === email)

  let clientUserId: string

  if (existingAuth) {
    clientUserId = existingAuth.id
    // Update password so invite works
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).auth.admin.updateUserById(existingAuth.id, { password: tempPassword })
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newUser, error: createError } = await (admin as any).auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: name ?? '', role: 'client', tenant_id: profile.tenant_id },
    })
    if (createError) return NextResponse.json({ error: 'Erro ao criar cliente.' }, { status: 500 })
    clientUserId = newUser.user.id
  }

  // Get tenant info for the portal URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants')
    .select('slug, name')
    .eq('id', profile.tenant_id)
    .single() as { data: { slug: string; name: string } | null }

  // Upsert public.users as client of this tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('users').upsert({
    id: clientUserId,
    email,
    role: 'client',
    tenant_id: profile.tenant_id,
    name: name ?? null,
  }, { onConflict: 'id' })

  // Enqueue invitation email via BullMQ email worker
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:3000`
  const portalUrl = `${appUrl}/${tenant?.slug}`
  const loginUrl = `${appUrl}/${tenant?.slug}/login`

  try {
    const { Queue } = await import('bullmq')
    const { default: Redis } = await import('ioredis')
    const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null })
    const emailQueue = new Queue('email', { connection })
    await emailQueue.add('client-invite', {
      to: email,
      subject: `Acesso ao portal de fotos — ${tenant?.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="font-size: 22px; margin-bottom: 8px;">Bem-vindo(a), ${name ?? email}!</h2>
          <p style="color: #666; margin-bottom: 24px;">
            ${tenant?.name} criou um acesso para você no portal de fotos.
          </p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0;"><strong>E-mail:</strong> ${email}</p>
            <p style="margin: 0;"><strong>Senha temporária:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
          </div>
          <a href="${loginUrl}" style="display: inline-block; background: #0d0f14; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Acessar portal →
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            Portal: <a href="${portalUrl}">${portalUrl}</a>
          </p>
        </div>
      `,
    })
    await connection.quit()
  } catch (emailErr) {
    console.error('[invite] email queue error:', emailErr)
    // Don't fail the request — account was created, email is best-effort
  }

  return NextResponse.json({
    message: `Convite enviado para ${email}. Senha temporária: ${tempPassword}`,
    clientUserId,
  }, { status: 201 })
}
```

- [ ] **Step 8.2: Botão de convite no AddClientDialog**

Ler `src/app/(dashboard)/dashboard/clientes/_components/add-client-dialog.tsx`.

Adicionar uma segunda aba ou um segundo botão "Convidar cliente" (abre form simples com email + nome). Pode ser implementado como seção adicional no mesmo Dialog:

```tsx
// Adicionar state para controlar qual "modo" está ativo:
const [mode, setMode] = useState<'manual' | 'invite'>('invite')

// Header com tabs:
<div className="flex gap-1 mb-4">
  {(['invite', 'manual'] as const).map((m) => (
    <button
      key={m}
      type="button"
      onClick={() => setMode(m)}
      className={`flex-1 py-2 text-sm font-semibold rounded-[var(--radius-sm)] transition-colors ${
        mode === m
          ? 'bg-[var(--color-cta)] text-[var(--color-cta-fg)]'
          : 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)]'
      }`}
    >
      {m === 'invite' ? '📧 Convidar por email' : '📋 Registrar manual'}
    </button>
  ))}
</div>
```

Para o modo `invite`, novo form que chama `POST /api/clients/invite`:
```tsx
{mode === 'invite' && (
  <form onSubmit={handleInvite} className="space-y-4">
    <div>
      <Label htmlFor="invite-name">Nome do cliente</Label>
      <Input id="invite-name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nome completo" />
    </div>
    <div>
      <Label htmlFor="invite-email">E-mail do cliente</Label>
      <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="cliente@email.com" required />
    </div>
    {inviteMessage && <p className={`text-sm ${inviteMessage.includes('Erro') ? 'text-destructive' : 'text-[var(--color-success)]'}`}>{inviteMessage}</p>}
    <Button type="submit" disabled={inviteLoading} className="w-full">
      {inviteLoading ? 'Enviando...' : 'Enviar convite'}
    </Button>
  </form>
)}
```

Handler `handleInvite`:
```typescript
async function handleInvite(e: React.FormEvent) {
  e.preventDefault()
  setInviteLoading(true)
  setInviteMessage(null)
  try {
    const res = await fetch('/api/clients/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName }),
    })
    const data = await res.json()
    if (res.ok) {
      setInviteMessage(`✅ ${data.message}`)
      setInviteEmail('')
      setInviteName('')
    } else {
      setInviteMessage(`Erro: ${data.error}`)
    }
  } catch {
    setInviteMessage('Erro de rede. Tente novamente.')
  } finally {
    setInviteLoading(false)
  }
}
```

- [ ] **Step 8.3: Commit**

```bash
git add src/app/api/clients/invite/ \
  src/app/\(dashboard\)/dashboard/clientes/_components/add-client-dialog.tsx
git commit -m "feat: fotógrafo convida cliente por email com acesso ao portal"
```

---

## Task 9: Notificação ao Fotógrafo quando Receber Pedido

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`
- Modify: `src/app/api/webhooks/mercadopago/route.ts`

- [ ] **Step 9.1: Função helper de envio de notificação**

Criar `src/lib/notifications/order-notification.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export async function notifyPhotographerNewOrder(orderId: string) {
  const admin = createAdminClient()

  // Get order with items → event → tenant → photographer email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (admin as any)
    .from('orders')
    .select('id, client_email, total_cents, order_items(event_id, events(tenant_id, title, tenants(name, slug, users(email, role))))')
    .eq('id', orderId)
    .single()

  if (!order) return

  const firstItem = order.order_items?.[0]
  const event = firstItem?.events
  const tenant = event?.tenants
  if (!tenant) return

  // Find photographer email (role = photographer in this tenant)
  const photographerEmail = tenant.users?.find((u: { role: string; email: string }) => u.role === 'photographer')?.email
  if (!photographerEmail) return

  const total = (order.total_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const { Queue } = await import('bullmq')
    const { default: Redis } = await import('ioredis')
    const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null })
    const emailQueue = new Queue('email', { connection })
    await emailQueue.add('photographer-order-notification', {
      to: photographerEmail,
      subject: `Novo pedido recebido — ${total}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="font-size: 22px; margin-bottom: 8px;">Novo pedido! 🎉</h2>
          <p style="color: #666; margin-bottom: 16px;">
            O cliente <strong>${order.client_email}</strong> realizou um pedido no evento
            <strong>${event.title}</strong>.
          </p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 4px 0; font-size: 13px; color: #999;">Valor total</p>
            <p style="margin: 0; font-size: 28px; font-weight: bold;">${total}</p>
          </div>
          <a href="${appUrl}/dashboard/financeiro" style="display: inline-block; background: #0d0f14; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Ver no painel financeiro →
          </a>
        </div>
      `,
    })
    await connection.quit()
  } catch (err) {
    console.error('[notifyPhotographer] email queue error:', err)
  }
}
```

- [ ] **Step 9.2: Chamar notificação no webhook do Stripe**

Ler `src/app/api/webhooks/stripe/route.ts`. Após atualizar o pedido como `paid`, adicionar:

```typescript
import { notifyPhotographerNewOrder } from '@/lib/notifications/order-notification'

// Após: await adminClient.from('orders').update({ status: 'paid', paid_at: new Date() }).eq('payment_provider_id', paymentIntentId)
await notifyPhotographerNewOrder(order.id)
```

- [ ] **Step 9.3: Chamar notificação no webhook do MercadoPago**

Ler `src/app/api/webhooks/mercadopago/route.ts` e fazer o mesmo — após confirmar pagamento, chamar `notifyPhotographerNewOrder(order.id)`.

- [ ] **Step 9.4: Commit**

```bash
git add src/lib/notifications/ \
  src/app/api/webhooks/stripe/route.ts \
  src/app/api/webhooks/mercadopago/route.ts
git commit -m "feat: notificação por email ao fotógrafo quando receber novo pedido"
```

---

## Task 10: Repasses ao Fotógrafo

**Files:**
- Create: `supabase/migrations/0011_payouts.sql`
- Create: `docker/db/08-payouts.sql`
- Create: `src/app/api/admin/payouts/route.ts`
- Create: `src/app/api/admin/payouts/[id]/route.ts`
- Create: `src/app/(admin)/admin/repasses/page.tsx`
- Create: `src/app/(admin)/admin/repasses/_components/payouts-table.tsx`
- Modify: `src/app/(admin)/admin/layout.tsx`

- [ ] **Step 10.1: Migration**

`supabase/migrations/0011_payouts.sql` e `docker/db/08-payouts.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.payouts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount_cents     INTEGER     NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending',
  period_start     DATE        NOT NULL,
  period_end       DATE        NOT NULL,
  note             TEXT,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payouts_tenant_id_idx ON public.payouts (tenant_id);
CREATE INDEX IF NOT EXISTS payouts_status_idx    ON public.payouts (status);

GRANT ALL ON public.payouts TO anon, authenticated, service_role;
```

- [ ] **Step 10.2: API de repasses (admin)**

Criar `src/app/api/admin/payouts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: p } = await (admin as any).from('users').select('role').eq('id', user.id).single()
  return p?.role === 'admin' ? admin : null
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // Buscar repasses com nome do tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payouts } = await (admin as any)
    .from('payouts')
    .select('id, amount_cents, status, period_start, period_end, note, paid_at, created_at, tenants(name, slug)')
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ payouts: payouts ?? [] })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json() as {
    tenant_id: string
    amount_cents: number
    period_start: string
    period_end: string
    note?: string
  }

  if (!body.tenant_id || !body.amount_cents || !body.period_start || !body.period_end) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payout, error } = await (admin as any)
    .from('payouts')
    .insert({
      tenant_id: body.tenant_id,
      amount_cents: body.amount_cents,
      period_start: body.period_start,
      period_end: body.period_end,
      note: body.note ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payout }, { status: 201 })
}
```

Criar `src/app/api/admin/payouts/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Props = { params: Promise<{ id: string }> }

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: p } = await (admin as any).from('users').select('role').eq('id', user.id).single()
  return p?.role === 'admin' ? admin : null
}

// PATCH: marcar como pago
export async function PATCH(request: NextRequest, { params }: Props) {
  const { id } = await params
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json() as { status: 'paid' | 'pending' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('payouts')
    .update({
      status: body.status,
      paid_at: body.status === 'paid' ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 10.3: Página de repasses no admin**

Criar `src/app/(admin)/admin/repasses/page.tsx`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PayoutsTable } from './_components/payouts-table'

type Payout = {
  id: string
  amount_cents: number
  status: string
  period_start: string
  period_end: string
  note: string | null
  paid_at: string | null
  created_at: string
  tenants: { name: string; slug: string } | null
}

export default async function RepassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any).from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payouts } = await (admin as any)
    .from('payouts')
    .select('id, amount_cents, status, period_start, period_end, note, paid_at, created_at, tenants(name, slug)')
    .order('created_at', { ascending: false })
    .limit(100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenants } = await (admin as any)
    .from('tenants')
    .select('id, name, slug')
    .eq('status', 'active')
    .order('name')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Repasses
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">
          Gerencie os repasses de receita aos fotógrafos.
        </p>
      </div>
      <PayoutsTable payouts={(payouts ?? []) as Payout[]} tenants={(tenants ?? []) as { id: string; name: string; slug: string }[]} />
    </div>
  )
}
```

Criar `src/app/(admin)/admin/repasses/_components/payouts-table.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Payout = {
  id: string
  amount_cents: number
  status: string
  period_start: string
  period_end: string
  note: string | null
  paid_at: string | null
  created_at: string
  tenants: { name: string; slug: string } | null
}

type Tenant = { id: string; name: string; slug: string }

export function PayoutsTable({ payouts, tenants }: { payouts: Payout[]; tenants: Tenant[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ tenant_id: '', amount: '', period_start: '', period_end: '', note: '' })
  const [processing, setProcessing] = useState<string | null>(null)

  const inputClass = 'h-10 px-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent'

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    await fetch('/api/admin/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: form.tenant_id,
        amount_cents: Math.round(parseFloat(form.amount.replace(',', '.')) * 100),
        period_start: form.period_start,
        period_end: form.period_end,
        note: form.note || undefined,
      }),
    })
    setCreating(false)
    setForm({ tenant_id: '', amount: '', period_start: '', period_end: '', note: '' })
    router.refresh()
  }

  async function markPaid(id: string) {
    setProcessing(id)
    await fetch(`/api/admin/payouts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid' }),
    })
    setProcessing(null)
    router.refresh()
  }

  const pending = payouts.filter((p) => p.status === 'pending')
  const paid = payouts.filter((p) => p.status === 'paid')

  return (
    <div className="space-y-6">
      {/* Criar novo repasse */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>Registrar Repasse</h2>
        </div>
        <form onSubmit={handleCreate} className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Fotógrafo</label>
            <select value={form.tenant_id} onChange={(e) => setForm((f) => ({ ...f, tenant_id: e.target.value }))} className={inputClass} required>
              <option value="">Selecione...</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Valor (R$)</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} placeholder="0,00" required />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Período início</label>
            <input type="date" value={form.period_start} onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))} className={inputClass} required />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Período fim</label>
            <input type="date" value={form.period_end} onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))} className={inputClass} required />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Observação</label>
            <input type="text" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={inputClass} placeholder="Opcional" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={creating} className="w-full h-10 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold disabled:opacity-50">
              {creating ? 'Registrando...' : '+ Registrar repasse'}
            </button>
          </div>
        </form>
      </div>

      {/* Pendentes */}
      {pending.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
              Repasses Pendentes
              <span className="ml-2 text-xs font-bold bg-[var(--color-gold)] text-[var(--color-ink)] px-2 py-0.5 rounded-full">{pending.length}</span>
            </h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {pending.map((p) => (
              <div key={p.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink)]">{p.tenants?.name ?? '—'}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {new Date(p.period_start).toLocaleDateString('pt-BR')} – {new Date(p.period_end).toLocaleDateString('pt-BR')}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg font-bold text-[var(--color-ink)]">
                    {(p.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <button
                    onClick={() => markPaid(p.id)}
                    disabled={processing === p.id}
                    className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-colors disabled:opacity-40"
                  >
                    {processing === p.id ? '...' : 'Marcar pago'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico */}
      {paid.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>Histórico de Repasses</h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {paid.slice(0, 20).map((p) => (
              <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--color-ink)]">{p.tenants?.name ?? '—'}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    Pago em {p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : '—'}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--color-ink)]">
                  {(p.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 10.4: Adicionar link "Repasses" no nav do admin**

Em `src/app/(admin)/admin/layout.tsx`, adicionar link para `/admin/repasses` no sidebar junto aos outros links de navegação.

- [ ] **Step 10.5: Commit**

```bash
git add supabase/migrations/0011_payouts.sql docker/db/08-payouts.sql \
  src/app/api/admin/payouts/ \
  src/app/\(admin\)/admin/repasses/ \
  src/app/\(admin\)/admin/layout.tsx
git commit -m "feat: sistema de repasses aos fotógrafos no painel admin"
```

---

## Task 11: Entrega Manual de Fotos

**Files:**
- Create: `src/app/api/orders/[id]/deliver/route.ts`
- Modify: `src/app/(dashboard)/dashboard/clientes/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/clientes/_components/orders-table.tsx`

- [ ] **Step 11.1: API de entrega manual**

Criar `src/app/api/orders/[id]/deliver/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Props = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single()

  if (!profile?.tenant_id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // Verificar que o pedido pertence a um evento do tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (admin as any)
    .from('orders')
    .select('id, status, client_email, order_items(event_id, events(tenant_id))')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  const belongsToTenant = order.order_items?.some(
    (oi: { events: { tenant_id: string } | null }) => oi.events?.tenant_id === profile.tenant_id
  )
  if (!belongsToTenant) return NextResponse.json({ error: 'Pedido não pertence ao seu tenant.' }, { status: 403 })

  if (!['paid', 'delivered'].includes(order.status)) {
    return NextResponse.json({ error: 'Pedido precisa estar pago para entregar.' }, { status: 400 })
  }

  // Generate download URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const downloadUrl = `${appUrl}/api/orders/${id}/download`

  // Send delivery email
  try {
    const { Queue } = await import('bullmq')
    const { default: Redis } = await import('ioredis')
    const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null })
    const emailQueue = new Queue('email', { connection })
    await emailQueue.add('order-delivery', {
      to: order.client_email,
      subject: 'Suas fotos estão prontas para download! 📷',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="font-size: 22px; margin-bottom: 8px;">Suas fotos estão prontas! 🎉</h2>
          <p style="color: #666; margin-bottom: 24px;">
            Suas fotos foram processadas e estão disponíveis para download.
          </p>
          <a href="${downloadUrl}" style="display: inline-block; background: #0d0f14; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Baixar minhas fotos →
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            Ou acesse: <a href="${appUrl}/pedido/${id}">${appUrl}/pedido/${id}</a>
          </p>
        </div>
      `,
    })
    await connection.quit()
  } catch (err) {
    console.error('[deliver] email queue error:', err)
  }

  // Update status to delivered
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('orders').update({ status: 'delivered' }).eq('id', id)

  return NextResponse.json({ ok: true, message: 'Fotos entregues e e-mail enviado.' })
}
```

- [ ] **Step 11.2: Botão "Entregar fotos" na tabela de pedidos**

Ler `src/app/(dashboard)/dashboard/clientes/_components/orders-table.tsx`.

Adicionar coluna de ação com botão de entrega para pedidos pagos:

```tsx
// Adicionar ao tipo Order:
status: string

// Nova coluna na tabela ou linha de ação:
{order.status === 'paid' && (
  <button
    onClick={() => handleDeliver(order.id)}
    disabled={delivering === order.id}
    className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-blue)]/10 text-[var(--color-blue)] hover:bg-[var(--color-blue)]/20 transition-colors disabled:opacity-40"
  >
    {delivering === order.id ? 'Enviando...' : '📦 Entregar fotos'}
  </button>
)}
{order.status === 'delivered' && (
  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
    ✅ Entregue
  </span>
)}
```

State e handler:
```typescript
const [delivering, setDelivering] = useState<string | null>(null)

async function handleDeliver(orderId: string) {
  if (!confirm('Enviar fotos por email para o cliente?')) return
  setDelivering(orderId)
  try {
    const res = await fetch(`/api/orders/${orderId}/deliver`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) alert(data.error ?? 'Erro ao entregar fotos.')
    else router.refresh()
  } catch {
    alert('Erro de rede. Tente novamente.')
  } finally {
    setDelivering(null)
  }
}
```

- [ ] **Step 11.3: Commit**

```bash
git add src/app/api/orders/\[id\]/deliver/ \
  src/app/\(dashboard\)/dashboard/clientes/
git commit -m "feat: entrega manual de fotos por email no dashboard"
```

---

## Deploy das Migrações na VPS

```bash
ssh root@2.25.150.248
docker exec -i fotosaas-db psql -U postgres -d postgres < /opt/fotosaas/docker/db/08-payouts.sql
cd /opt/fotosaas
git pull
docker compose -f docker-compose.prod.yml build nextjs
docker compose -f docker-compose.prod.yml up -d nextjs
```
