# Gestão de Sub-fotógrafos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar aprovação de eventos de sub-fotógrafos, aprovação automática configurável, permissão por membro de equipe e taxa interna por sub-fotógrafo.

**Architecture:** Estende `events.status` com valor `pending_approval`, adiciona colunas em `users` para permissões/taxas, e adiciona configuração em `system_settings`. O fluxo central é: sub-fotógrafo cria evento → status fica `pending_approval` (ou `draft` se auto-approve) → fotógrafo principal aprova/rejeita. Tasks 4 e 5 são interdependentes; Tasks 6 e 7 são independentes entre si e do grupo 4/5.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase PostgREST.

---

## Contexto do codebase

- **`events.status`** values: `draft`, `published`, `archived`. Adicionamos `pending_approval`.
- **`system_settings`** table: chave/valor. Já tem `global_commission_percent`. Adicionar `auto_approve_sub_events`.
- **`users.role`** values: `admin`, `photographer`, `sub_photographer`, `client`.
- **API de eventos:** `POST /api/events` cria evento. Modificar para definir status correto baseado no role do criador.
- **API de equipe:** `PATCH /api/team/[id]` já existe para editar role. Estender para `can_create_events` e `internal_commission_percent`.
- **Design system:** `bg-[var(--color-cta)] text-[var(--color-cta-fg)]` para botões primários; variáveis de cor para tudo.

---

## Arquivos criados / modificados

| Ação | Arquivo |
|---|---|
| Criar | `supabase/migrations/0010_sub_photographer_management.sql` |
| Criar | `docker/db/07-sub-photographer-management.sql` |
| Modificar | `src/app/api/events/route.ts` — status lógica |
| Criar | `src/app/api/events/[id]/approve/route.ts` |
| Criar | `src/app/(dashboard)/dashboard/aprovacoes/page.tsx` |
| Modificar | `src/app/(dashboard)/dashboard/layout.tsx` — link nav |
| Modificar | `src/app/api/admin/settings/route.ts` — novo campo |
| Modificar | `src/app/(admin)/admin/configuracoes/_components/admin-settings-form.tsx` |
| Modificar | `src/app/api/team/[id]/route.ts` — novos campos |
| Modificar | `src/app/(dashboard)/dashboard/equipe/_components/member-list.tsx` |

---

## Task 4 + 5: Aprovação de Eventos e Auto-Aprovação

**Nota:** Tasks 4 e 5 implementadas juntas pois compartilham a mesma migration e lógica de fluxo.

- [ ] **Step 4.1: Migration**

`supabase/migrations/0010_sub_photographer_management.sql` e `docker/db/07-sub-photographer-management.sql`:

```sql
-- Permissão por sub-fotógrafo
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS can_create_events         BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS internal_commission_percent INTEGER;

-- Auto-aprovação configurável (na tabela system_settings que já existe)
-- Inserir valor padrão se não existir
INSERT INTO public.system_settings (key, value)
VALUES ('auto_approve_sub_events', 'false')
ON CONFLICT (key) DO NOTHING;
```

**Nota:** `events.status` já aceita qualquer texto (tipo TEXT sem CHECK). O valor `pending_approval` funciona sem migration adicional. Mas é boa prática documentar:
```sql
-- events.status possíveis: 'draft', 'published', 'archived', 'pending_approval'
-- Nenhuma constraint precisar ser alterada.
COMMENT ON COLUMN public.events.status IS 'draft | published | archived | pending_approval';
```

- [ ] **Step 4.2: Lógica de status ao criar evento**

Em `src/app/api/events/route.ts` (POST handler), após verificar o role do usuário:

```typescript
// Antes de inserir o evento, determinar o status inicial:
// - photographer ou admin → 'draft' (controle total)
// - sub_photographer → verificar auto_approve_sub_events
//   - se true → 'draft'
//   - se false → 'pending_approval'

let initialStatus = 'draft'

if (profile.role === 'sub_photographer') {
  // Verificar permissão para criar eventos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userPerms } = await (adminClient as any)
    .from('users')
    .select('can_create_events')
    .eq('id', user.id)
    .single()

  if (!userPerms?.can_create_events) {
    return NextResponse.json({ error: 'Você não tem permissão para criar eventos.' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: setting } = await (adminClient as any)
    .from('system_settings')
    .select('value')
    .eq('key', 'auto_approve_sub_events')
    .single()

  initialStatus = setting?.value === 'true' ? 'draft' : 'pending_approval'
}

// Usar initialStatus ao inserir o evento (substituir 'draft' hardcoded pelo valor dinâmico)
```

- [ ] **Step 4.3: API de aprovação/rejeição**

Criar `src/app/api/events/[id]/approve/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Props = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params
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

  if (!profile || profile.role !== 'photographer') {
    return NextResponse.json({ error: 'Apenas fotógrafos podem aprovar eventos.' }, { status: 403 })
  }

  const body = await request.json() as { action: 'approve' | 'reject'; reason?: string }
  if (!['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: 'action deve ser "approve" ou "reject".' }, { status: 400 })
  }

  // Verificar que o evento pertence ao mesmo tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, status, tenant_id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  if (event.status !== 'pending_approval') {
    return NextResponse.json({ error: 'Evento não está aguardando aprovação.' }, { status: 400 })
  }

  const newStatus = body.action === 'approve' ? 'draft' : 'archived'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('events')
    .update({ status: newStatus })
    .eq('id', id)

  return NextResponse.json({ ok: true, status: newStatus })
}
```

- [ ] **Step 4.4: Página de aprovações no dashboard**

Criar `src/app/(dashboard)/dashboard/aprovacoes/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ApprovalQueue } from './_components/approval-queue'

export default async function AprovacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null }

  if (!profile || profile.role !== 'photographer') redirect('/dashboard')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pending } = await (admin as any)
    .from('events')
    .select('id, title, type, event_date, created_at, users(email)')
    .eq('tenant_id', profile.tenant_id)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Aprovações Pendentes
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">
          Eventos criados por sua equipe aguardando aprovação.
        </p>
      </div>
      <ApprovalQueue events={pending ?? []} />
    </div>
  )
}
```

Criar `src/app/(dashboard)/dashboard/aprovacoes/_components/approval-queue.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PendingEvent = {
  id: string
  title: string
  type: string
  event_date: string | null
  created_at: string
  users?: { email: string } | null
}

export function ApprovalQueue({ events }: { events: PendingEvent[] }) {
  const router = useRouter()
  const [processing, setProcessing] = useState<string | null>(null)

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setProcessing(id)
    try {
      await fetch(`/api/events/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      router.refresh()
    } finally {
      setProcessing(null)
    }
  }

  if (events.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-12 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <p className="text-4xl mb-4">✅</p>
        <p className="font-display text-xl font-semibold text-[var(--color-ink)]">Nenhuma aprovação pendente</p>
        <p className="text-sm text-[var(--color-ink-muted)] mt-2">Todos os eventos da sua equipe foram revisados.</p>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <div className="divide-y divide-[var(--color-border)]">
        {events.map((event) => (
          <div key={event.id} className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{event.title}</p>
              <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
                {event.type === 'event' ? 'Evento' : 'Ensaio'}
                {event.event_date && ` · ${new Date(event.event_date).toLocaleDateString('pt-BR')}`}
                {event.users?.email && ` · por ${event.users.email}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleAction(event.id, 'reject')}
                disabled={processing === event.id}
                className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors disabled:opacity-40"
              >
                Rejeitar
              </button>
              <button
                onClick={() => handleAction(event.id, 'approve')}
                disabled={processing === event.id}
                className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-colors disabled:opacity-40"
              >
                {processing === event.id ? '...' : 'Aprovar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4.5: Badge de aprovações no nav do dashboard**

Em `src/app/(dashboard)/dashboard/layout.tsx`, adicionar link "Aprovações" no nav, visível apenas para role `photographer`. Ler o arquivo, identificar onde estão os links de navegação, e adicionar:

```typescript
// Após os links existentes, condicionalmente:
{profile.role === 'photographer' && pendingCount > 0 && (
  <Link href="/dashboard/aprovacoes" className="...">
    Aprovações
    <span className="ml-1 text-xs bg-[var(--color-gold)] text-[var(--color-ink)] rounded-full px-1.5 py-0.5 font-bold">
      {pendingCount}
    </span>
  </Link>
)}
```

Para o `pendingCount`, fazer query adicional no layout:
```typescript
const pendingCount = profile.role === 'photographer'
  ? ((await (admin as any).from('events').select('id', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id).eq('status', 'pending_approval')).count ?? 0)
  : 0
```

- [ ] **Step 4.6: Toggle auto-aprovação no painel admin**

Em `src/app/(admin)/admin/configuracoes/_components/admin-settings-form.tsx`, adicionar:

1. Ao tipo `Settings`, adicionar `auto_approve_sub_events: string` (valor `'true'` ou `'false'`)
2. Input toggle/checkbox na seção de configurações

```tsx
{/* Seção de comportamento de sub-fotógrafos */}
<div>
  <label htmlFor="auto_approve" className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
    Aprovação automática de eventos de sub-fotógrafos
  </label>
  <div className="flex items-center gap-3">
    <input
      id="auto_approve"
      type="checkbox"
      checked={values.auto_approve_sub_events === 'true'}
      onChange={(e) => handleChange('auto_approve_sub_events', e.target.checked ? 'true' : 'false')}
      className="w-4 h-4 accent-[var(--color-gold)]"
    />
    <span className="text-sm text-[var(--color-ink-muted)]">
      Quando ativado, eventos criados por sub-fotógrafos ficam como rascunho (sem necessidade de aprovação manual).
    </span>
  </div>
</div>
```

Em `src/app/api/admin/settings/route.ts` (PUT), incluir `auto_approve_sub_events` na lista de chaves permitidas.

Em `src/app/(admin)/admin/configuracoes/page.tsx`, buscar e passar `auto_approve_sub_events` para o form.

- [ ] **Step 4.7: Commit**

```bash
git add supabase/migrations/0010_sub_photographer_management.sql \
  docker/db/07-sub-photographer-management.sql \
  src/app/api/events/route.ts \
  src/app/api/events/\[id\]/approve/ \
  src/app/\(dashboard\)/dashboard/aprovacoes/ \
  src/app/\(dashboard\)/dashboard/layout.tsx \
  src/app/api/admin/settings/route.ts \
  src/app/\(admin\)/admin/configuracoes/
git commit -m "feat: aprovação de eventos de sub-fotógrafos e auto-aprovação configurável"
```

---

## Task 6: Permissão por Sub-fotógrafo (pode criar eventos)

**Files:**
- Modify: `src/app/api/team/[id]/route.ts`
- Modify: `src/app/(dashboard)/dashboard/equipe/_components/member-list.tsx`

*(Migration já feita na Task 4 — `can_create_events` já adicionado)*

- [ ] **Step 6.1: API PATCH para atualizar can_create_events**

Ler `src/app/api/team/[id]/route.ts`. O PATCH atual altera `role`. Estender para também aceitar `can_create_events`:

```typescript
// No PATCH handler, após a validação de role existente, adicionar:
const updates: Record<string, unknown> = {}

if (body.role && ['sub_photographer', 'photographer'].includes(body.role)) {
  updates.role = body.role
}
if (typeof body.can_create_events === 'boolean') {
  updates.can_create_events = body.can_create_events
}
if (typeof body.internal_commission_percent === 'number') {
  updates.internal_commission_percent = body.internal_commission_percent
}

if (Object.keys(updates).length === 0) {
  return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
}

const { error } = await (admin as any)
  .from('users')
  .update(updates)
  .eq('id', memberId)
  .eq('tenant_id', profile.tenant_id)
```

- [ ] **Step 6.2: Toggle no MemberList**

Ler `src/app/(dashboard)/dashboard/equipe/_components/member-list.tsx`.

Ao tipo `Member`, adicionar:
```typescript
can_create_events: boolean
internal_commission_percent: number | null
```

Adicionar toggle por membro na UI:
```tsx
{/* Dentro do item de cada membro, após o email/role: */}
{member.role === 'sub_photographer' && (
  <div className="flex items-center gap-2 text-xs">
    <button
      onClick={() => handleTogglePermission(member.id, !member.can_create_events)}
      className={`px-2 py-0.5 rounded-full font-semibold transition-colors ${
        member.can_create_events
          ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
          : 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)]'
      }`}
    >
      {member.can_create_events ? 'Pode criar eventos' : 'Sem permissão de eventos'}
    </button>
  </div>
)}
```

Função `handleTogglePermission`:
```typescript
async function handleTogglePermission(memberId: string, canCreate: boolean) {
  await fetch(`/api/team/${memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ can_create_events: canCreate }),
  })
  router.refresh()
}
```

Na query da página de equipe, adicionar `can_create_events` ao select.

- [ ] **Step 6.3: Commit**

```bash
git add src/app/api/team/\[id\]/route.ts \
  src/app/\(dashboard\)/dashboard/equipe/
git commit -m "feat: permissão por sub-fotógrafo para criar eventos"
```

---

## Task 7: Taxa Interna por Sub-fotógrafo

**Files:**
- Modify: `src/app/api/team/[id]/route.ts` *(já estendido na Task 6)*
- Modify: `src/app/(dashboard)/dashboard/equipe/_components/member-list.tsx`
- Modify: `src/app/(dashboard)/dashboard/financeiro/page.tsx`

*(Migration já feita na Task 4 — `internal_commission_percent` já adicionado)*

- [ ] **Step 7.1: Input de taxa por membro na equipe**

Em `member-list.tsx`, adicionar input de taxa para sub-fotógrafos:

```tsx
{/* Campo de taxa interna, dentro do startEdit/saveEdit flow */}
{editing === member.id ? (
  <div className="flex items-center gap-2">
    <input
      type="number"
      min="0"
      max="100"
      value={editRate[member.id] ?? (member.internal_commission_percent ?? '')}
      onChange={(e) => setEditRate((prev) => ({ ...prev, [member.id]: e.target.value }))}
      className="w-20 h-8 px-2 text-sm rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)]"
      placeholder="0"
    />
    <span className="text-xs text-[var(--color-ink-muted)]">% taxa</span>
    <button onClick={() => saveRate(member.id)} className="text-xs text-[var(--color-success)] font-semibold hover:underline">Salvar</button>
  </div>
) : (
  <span className="text-xs text-[var(--color-ink-muted)]">
    Taxa: {member.internal_commission_percent ?? 0}%
    <button onClick={() => setEditing(member.id)} className="ml-1 text-[var(--color-gold)] hover:underline">editar</button>
  </span>
)}
```

State adicional: `const [editRate, setEditRate] = useState<Record<string, string>>({})`

Função `saveRate`:
```typescript
async function saveRate(memberId: string) {
  const rate = parseInt(editRate[memberId] ?? '0', 10)
  if (isNaN(rate) || rate < 0 || rate > 100) return
  await fetch(`/api/team/${memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ internal_commission_percent: rate }),
  })
  setEditing(null)
  router.refresh()
}
```

- [ ] **Step 7.2: Mostrar taxa interna no painel financeiro**

Em `src/app/(dashboard)/dashboard/financeiro/page.tsx`, adicionar uma nota informativa abaixo dos StatCards mostrando as taxas dos sub-fotógrafos da equipe (informativo, não calculado ainda sobre os pedidos individuais pois não sabemos qual sub criou cada pedido — isso seria fase 2):

```tsx
{/* Informativo de taxas internas */}
{subMembers.length > 0 && (
  <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-6 py-4">
    <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-3">
      Taxas Internas da Equipe
    </p>
    <div className="flex flex-wrap gap-4">
      {subMembers.map((m) => (
        <div key={m.id} className="text-sm">
          <span className="text-[var(--color-ink)]">{m.email}</span>
          <span className="ml-2 text-[var(--color-ink-muted)]">{m.internal_commission_percent ?? 0}%</span>
        </div>
      ))}
    </div>
  </div>
)}
```

Na query da página financeiro, buscar sub-membros da equipe:
```typescript
const { data: subMembers } = await (adminClient as any)
  .from('users')
  .select('id, email, internal_commission_percent')
  .eq('tenant_id', profile.tenant_id)
  .eq('role', 'sub_photographer')
```

- [ ] **Step 7.3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/equipe/ \
  src/app/\(dashboard\)/dashboard/financeiro/page.tsx
git commit -m "feat: taxa interna configurável por sub-fotógrafo"
```

---

## Deploy das Migrações na VPS

```bash
ssh root@2.25.150.248
docker exec -i fotosaas-db psql -U postgres -d postgres < /opt/fotosaas/docker/db/07-sub-photographer-management.sql
cd /opt/fotosaas
docker compose -f docker-compose.prod.yml build nextjs
docker compose -f docker-compose.prod.yml up -d nextjs
```
