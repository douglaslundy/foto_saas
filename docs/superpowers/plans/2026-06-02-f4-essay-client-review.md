# F4 — Envio de Ensaio para Cliente Externo: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o fotógrafo envie um magic link para o cliente selecionar fotos de um ensaio, com opção de pagamento no ato da seleção.

**Architecture:** Nova tabela `essay_reviews` registra cada envio. Backend gera magic link via Supabase admin API (`generateLink`). Cliente é logado automaticamente via `/auth/callback` com troca PKCE/OTP, cai na página de seleção, confirma fotos e opcionalmente paga. Fotógrafo é notificado via email + polling no dashboard.

**Tech Stack:** Next.js 14 App Router, Supabase (GoTrue + PostgREST), nodemailer (email direto, padrão existente), Stripe (`createStripePaymentIntent`), MercadoPago (`createMercadoPagoPix`), Jest (testes unitários).

**Spec:** `docs/superpowers/specs/2026-06-02-f4-essay-client-review-design.md`

---

## File Map

**Novos arquivos:**
- `supabase/migrations/0013_essay_reviews.sql` — tabela + RLS
- `src/app/auth/callback/route.ts` — troca PKCE/OTP do magic link
- `src/app/api/clients/search/route.ts` — busca clientes por nome/email
- `src/app/api/essay-reviews/route.ts` — GET lista + POST criar review
- `src/app/api/essay-reviews/[id]/route.ts` — GET review individual
- `src/app/api/essay-reviews/[id]/submit/route.ts` — POST enviar seleção
- `src/app/api/essay-reviews/[id]/resend/route.ts` — POST reenviar link
- `src/app/[tenant]/ensaio-review/[reviewId]/page.tsx` — página pública de seleção (server)
- `src/app/[tenant]/ensaio-review/[reviewId]/_components/review-client.tsx` — seleção client-side
- `src/components/essay/send-to-client-modal.tsx` — modal no dashboard
- `__tests__/api/essay-reviews/create.test.ts`
- `__tests__/api/essay-reviews/submit.test.ts`
- `__tests__/lib/notifications/essay-emails.test.ts`

**Arquivos modificados:**
- `src/lib/route-utils.ts` — adicionar `/auth` como rota auth (evitar rewrite de tenant)
- `src/lib/notifications/email.ts` — adicionar `sendEssayReviewLink` + `sendEssaySubmitted`
- `src/app/(dashboard)/dashboard/eventos/[id]/fotos/page.tsx` — botão "Enviar para cliente" + modal

---

## Task 1: Migração do banco de dados

**Files:**
- Create: `supabase/migrations/0013_essay_reviews.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/0013_essay_reviews.sql

CREATE TABLE essay_reviews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id              uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  client_id             uuid NOT NULL REFERENCES auth.users(id),
  status                text NOT NULL DEFAULT 'pending_selection'
                          CHECK (status IN ('pending_selection', 'submitted', 'in_progress', 'delivered')),
  selected_photo_ids    uuid[] DEFAULT '{}',
  notes                 text,
  payment_status        text NOT NULL DEFAULT 'pending'
                          CHECK (payment_status IN ('pending', 'paid', 'manual')),
  payment_intent_id     text,
  sent_at               timestamptz NOT NULL DEFAULT now(),
  submitted_at          timestamptz,
  magic_link_expires_at timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Índices para queries frequentes
CREATE INDEX essay_reviews_tenant_id_idx ON essay_reviews(tenant_id);
CREATE INDEX essay_reviews_event_id_idx ON essay_reviews(event_id);
CREATE INDEX essay_reviews_client_id_idx ON essay_reviews(client_id);
CREATE INDEX essay_reviews_status_idx ON essay_reviews(tenant_id, status);

-- RLS
ALTER TABLE essay_reviews ENABLE ROW LEVEL SECURITY;

-- Cliente pode ler e atualizar apenas o próprio review
CREATE POLICY "client_select" ON essay_reviews
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "client_update" ON essay_reviews
  FOR UPDATE USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Service role tem acesso total (usado pelas APIs do servidor)
CREATE POLICY "service_role_all" ON essay_reviews
  FOR ALL USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Aplicar a migration na VPS**

```bash
# SSH na VPS e aplicar via psql
ssh root@2.25.150.248
cd /opt/fotosaas
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d postgres -f /dev/stdin < supabase/migrations/0013_essay_reviews.sql
```

OU copiar o arquivo e rodar:
```bash
docker cp supabase/migrations/0013_essay_reviews.sql fotosaas-db-1:/tmp/
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d postgres -f /tmp/0013_essay_reviews.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX` (×4), `ALTER TABLE`, `CREATE POLICY` (×3)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0013_essay_reviews.sql
git commit -m "feat: add essay_reviews table with RLS"
```

---

## Task 2: Atualizar route-utils para proteger /auth/callback

**Files:**
- Modify: `src/lib/route-utils.ts`

- [ ] **Step 1: Escrever o teste**

Criar `__tests__/lib/route-utils-auth.test.ts`:

```typescript
import { getRouteType } from '@/lib/route-utils'

describe('getRouteType — /auth paths', () => {
  it('classifies /auth/callback as auth route', () => {
    expect(getRouteType('/auth/callback', null)).toBe('auth')
  })

  it('classifies /auth/callback with tenant slug as auth (not tenant)', () => {
    expect(getRouteType('/auth/callback', 'my-studio')).toBe('auth')
  })

  it('classifies /auth/error as auth route', () => {
    expect(getRouteType('/auth/error', null)).toBe('auth')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd C:/Users/dougl/workspace5/fotosaas
npx jest __tests__/lib/route-utils-auth.test.ts --no-coverage
```

Expected: FAIL — `/auth/callback` retorna `root` ou `tenant`, não `auth`

- [ ] **Step 3: Atualizar route-utils.ts**

Arquivo atual em `src/lib/route-utils.ts`:

```typescript
export type RouteType = 'admin' | 'dashboard' | 'auth' | 'tenant' | 'root'

export function getRouteType(pathname: string, tenantSlug: string | null): RouteType {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname === '/login' || pathname.startsWith('/esqueci-minha-senha')) return 'auth'
  if (tenantSlug) return 'tenant'
  return 'root'
}
```

Substituir pela versão atualizada:

```typescript
export type RouteType = 'admin' | 'dashboard' | 'auth' | 'tenant' | 'root'

export function getRouteType(pathname: string, tenantSlug: string | null): RouteType {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (
    pathname === '/login' ||
    pathname.startsWith('/esqueci-minha-senha') ||
    pathname.startsWith('/auth')
  ) return 'auth'
  if (tenantSlug) return 'tenant'
  return 'root'
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx jest __tests__/lib/route-utils-auth.test.ts --no-coverage
```

Expected: PASS (3 testes)

- [ ] **Step 5: Rodar todos os testes de route-utils para garantir sem regressão**

```bash
npx jest __tests__/lib/route-utils.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/route-utils.ts __tests__/lib/route-utils-auth.test.ts
git commit -m "feat: classify /auth/* as auth route to prevent tenant rewrite"
```

---

## Task 3: Auth callback route (magic link exchange)

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  const supabase = await createClient()

  // PKCE flow (Supabase SSR padrão)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  // OTP flow (fallback para GoTrue self-hosted)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
```

- [ ] **Step 2: Criar a página de erro de auth**

Criar `src/app/auth/error/page.tsx`:

```typescript
export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Link inválido ou expirado</h1>
        <p className="text-gray-600 text-sm">
          Solicite um novo link ao fotógrafo.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts src/app/auth/error/page.tsx
git commit -m "feat: add auth callback route for magic link exchange"
```

---

## Task 4: Funções de email para essay review

**Files:**
- Modify: `src/lib/notifications/email.ts`
- Create: `__tests__/lib/notifications/essay-emails.test.ts`

- [ ] **Step 1: Escrever os testes**

```typescript
// __tests__/lib/notifications/essay-emails.test.ts
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({}),
  }),
}))

import nodemailer from 'nodemailer'
import { sendEssayReviewLink, sendEssaySubmitted } from '@/lib/notifications/email'

describe('sendEssayReviewLink', () => {
  it('sends email with magic link to client', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock

    await sendEssayReviewLink({
      to: 'cliente@email.com',
      clientName: 'João Silva',
      reviewLink: 'http://app/auth/callback?next=/studio/ensaio-review/abc',
      sessionTitle: 'Ensaio Família Silva',
      studioName: 'Studio X',
    })

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'cliente@email.com',
        subject: expect.stringContaining('Studio X'),
      })
    )
  })

  it('does not throw on nodemailer failure', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock
    sendMail.mockRejectedValueOnce(new Error('SMTP error'))

    await expect(
      sendEssayReviewLink({
        to: 'cliente@email.com',
        clientName: 'João',
        reviewLink: 'http://app/link',
        sessionTitle: 'Ensaio',
        studioName: 'Studio',
      })
    ).resolves.not.toThrow()
  })
})

describe('sendEssaySubmitted', () => {
  it('sends notification email to photographer', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock

    await sendEssaySubmitted({
      to: 'fotografo@studio.com',
      clientName: 'João Silva',
      sessionTitle: 'Ensaio Família Silva',
      selectedCount: 15,
      dashboardUrl: 'http://app/dashboard/eventos/123/fotos',
      studioName: 'Studio X',
    })

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'fotografo@studio.com',
        subject: expect.stringContaining('João Silva'),
      })
    )
  })
})
```

- [ ] **Step 2: Rodar e confirmar que os testes falham**

```bash
npx jest __tests__/lib/notifications/essay-emails.test.ts --no-coverage
```

Expected: FAIL — `sendEssayReviewLink` is not exported

- [ ] **Step 3: Adicionar as funções em email.ts**

Ao final de `src/lib/notifications/email.ts`, adicionar:

```typescript
export async function sendEssayReviewLink({
  to,
  clientName,
  reviewLink,
  sessionTitle,
  studioName,
}: {
  to: string
  clientName: string
  reviewLink: string
  sessionTitle: string
  studioName?: string
}): Promise<void> {
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
      to,
      subject: `${studioName ?? 'FotoSaaS'} — Selecione suas fotos do ensaio`,
      html: `
        <h2>Olá, ${clientName}!</h2>
        <p>Seu ensaio <strong>${sessionTitle}</strong> está pronto para seleção.</p>
        <p>Clique no botão abaixo para visualizar e selecionar suas fotos favoritas. O link expira em <strong>72 horas</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${reviewLink}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Selecionar minhas fotos
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;">Se o botão não funcionar, copie e cole este link: ${reviewLink}</p>
      `,
    })
  } catch (err) {
    console.error('[email] sendEssayReviewLink failed:', err)
  }
}

export async function sendEssaySubmitted({
  to,
  clientName,
  sessionTitle,
  selectedCount,
  dashboardUrl,
  studioName,
}: {
  to: string
  clientName: string
  sessionTitle: string
  selectedCount: number
  dashboardUrl: string
  studioName?: string
}): Promise<void> {
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
      to,
      subject: `${clientName} selecionou fotos — ${sessionTitle}`,
      html: `
        <h2>Seleção recebida!</h2>
        <p><strong>${clientName}</strong> acabou de selecionar as fotos do ensaio <strong>${sessionTitle}</strong>.</p>
        <p>Total selecionado: <strong>${selectedCount} foto${selectedCount !== 1 ? 's' : ''}</strong></p>
        <p style="margin: 24px 0;">
          <a href="${dashboardUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Ver seleção no dashboard
          </a>
        </p>
      `,
    })
  } catch (err) {
    console.error('[email] sendEssaySubmitted failed:', err)
  }
}
```

- [ ] **Step 4: Rodar os testes**

```bash
npx jest __tests__/lib/notifications/essay-emails.test.ts --no-coverage
```

Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/email.ts __tests__/lib/notifications/essay-emails.test.ts
git commit -m "feat: add sendEssayReviewLink and sendEssaySubmitted email functions"
```

---

## Task 5: API de busca de clientes

**Files:**
- Create: `src/app/api/clients/search/route.ts`

- [ ] **Step 1: Criar a rota de busca**

```typescript
// src/app/api/clients/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
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

  if (!profile?.tenant_id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const q = request.nextUrl.searchParams.get('q') ?? ''
  if (q.trim().length < 2) return NextResponse.json({ clients: [] })

  const search = `%${q.trim()}%`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('users')
    .select('id, name, email, cpf')
    .eq('tenant_id', profile.tenant_id)
    .eq('role', 'client')
    .or(`name.ilike.${search},email.ilike.${search}`)
    .order('name', { ascending: true })
    .limit(10) as { data: { id: string; name: string; email: string; cpf: string | null }[] | null; error: unknown }

  if (error) return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })

  return NextResponse.json({ clients: data ?? [] })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/clients/search/route.ts
git commit -m "feat: add client search API endpoint"
```

---

## Task 6: API de criação de essay review (POST /api/essay-reviews)

**Files:**
- Create: `src/app/api/essay-reviews/route.ts`
- Create: `__tests__/api/essay-reviews/create.test.ts`

- [ ] **Step 1: Escrever os testes**

```typescript
// __tests__/api/essay-reviews/create.test.ts
/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/notifications/email', () => ({
  sendEssayReviewLink: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEssayReviewLink } from '@/lib/notifications/email'
import { POST } from '@/app/api/essay-reviews/route'

const mockUser = { id: 'user-1' }
const mockProfile = { tenant_id: 'tenant-1', role: 'photographer', email: 'foto@studio.com' }
const mockEvent = { id: 'event-1', title: 'Ensaio Família', tenant_id: 'tenant-1', type: 'session', slug: 'ensaio-familia' }
const mockReview = { id: 'review-1' }

function buildMockAdmin(overrides: Record<string, unknown> = {}) {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { ...mockProfile, name: 'Fotógrafo' }, error: null }),
          insert: jest.fn().mockReturnThis(),
        }
      }
      if (table === 'events') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockEvent, error: null }),
        }
      }
      if (table === 'essay_reviews') {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockReview, error: null }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null }) }
    }),
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'new-client-1' } }, error: null }),
        generateLink: jest.fn().mockResolvedValue({
          data: { properties: { action_link: 'http://supabase/verify?token=abc' } },
          error: null,
        }),
      },
    },
    ...overrides,
  }
}

describe('POST /api/essay-reviews', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser } }) },
    })
  })

  it('returns 401 when not authenticated', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    })
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews', {
      method: 'POST',
      body: JSON.stringify({ event_id: 'event-1', client_id: 'client-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates review for existing client and sends email', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews', {
      method: 'POST',
      body: JSON.stringify({ event_id: 'event-1', client_id: 'client-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toHaveProperty('review_id')
    expect(sendEssayReviewLink).toHaveBeenCalled()
  })

  it('creates new client account when client data provided', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews', {
      method: 'POST',
      body: JSON.stringify({
        event_id: 'event-1',
        client: { name: 'João Silva', email: 'joao@email.com', cpf: '123.456.789-00' },
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 when neither client_id nor client provided', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews', {
      method: 'POST',
      body: JSON.stringify({ event_id: 'event-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que os testes falham**

```bash
npx jest __tests__/api/essay-reviews/create.test.ts --no-coverage
```

Expected: FAIL — `POST` não existe

- [ ] **Step 3: Implementar a rota**

```typescript
// src/app/api/essay-reviews/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEssayReviewLink } from '@/lib/notifications/email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const MAGIC_LINK_TTL_SECONDS = 72 * 60 * 60 // 72h

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single() as
    { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reviews, error } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, status, payment_status, sent_at, submitted_at, magic_link_expires_at')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false }) as
    { data: unknown[] | null; error: unknown }

  if (error) return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  return NextResponse.json({ reviews: reviews ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role, name, email')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string; name: string | null; email: string } | null }

  if (!profile?.tenant_id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  let body: {
    event_id?: string
    client_id?: string
    client?: { name: string; email: string; cpf: string }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { event_id, client_id, client: newClient } = body

  if (!event_id) return NextResponse.json({ error: 'event_id é obrigatório.' }, { status: 400 })
  if (!client_id && !newClient) {
    return NextResponse.json({ error: 'Informe client_id ou dados do novo cliente.' }, { status: 400 })
  }
  if (newClient && (!newClient.name || !newClient.email || !newClient.cpf)) {
    return NextResponse.json({ error: 'Nome, email e CPF são obrigatórios para novo cliente.' }, { status: 400 })
  }

  // Verificar que o evento pertence ao tenant e é do tipo session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, title, slug, tenant_id, type')
    .eq('id', event_id)
    .eq('tenant_id', profile.tenant_id)
    .eq('type', 'session')
    .single() as { data: { id: string; title: string; slug: string; tenant_id: string; type: string } | null }

  if (!event) return NextResponse.json({ error: 'Ensaio não encontrado.' }, { status: 404 })

  // Buscar slug do tenant para construir a URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants')
    .select('slug')
    .eq('id', profile.tenant_id)
    .single() as { data: { slug: string } | null }

  if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado.' }, { status: 404 })

  // Resolver o client_id — criar conta se necessário
  let resolvedClientId = client_id
  let clientEmail = ''
  let clientName = ''

  if (newClient) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: createError } = await (admin as any).auth.admin.createUser({
      email: newClient.email,
      password: '123456',
      email_confirm: true,
    })
    if (createError) {
      // Se já existe, buscar pelo email
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingList } = await (admin as any).auth.admin.listUsers()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (existingList?.users ?? []).find((u: any) => u.email === newClient.email)
      if (!existing) return NextResponse.json({ error: 'Erro ao criar conta do cliente.' }, { status: 500 })
      resolvedClientId = existing.id
    } else {
      resolvedClientId = created.user.id
    }
    // Inserir na tabela users do tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('users').upsert({
      id: resolvedClientId,
      tenant_id: profile.tenant_id,
      email: newClient.email,
      name: newClient.name,
      cpf: newClient.cpf,
      role: 'client',
    }, { onConflict: 'id' })

    clientEmail = newClient.email
    clientName = newClient.name
  } else {
    // Buscar email e nome do cliente existente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientData } = await (admin as any)
      .from('users')
      .select('email, name')
      .eq('id', resolvedClientId)
      .eq('tenant_id', profile.tenant_id)
      .single() as { data: { email: string; name: string } | null }

    if (!clientData) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    clientEmail = clientData.email
    clientName = clientData.name
  }

  // Criar o registro essay_reviews
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review, error: reviewError } = await (admin as any)
    .from('essay_reviews')
    .insert({
      tenant_id: profile.tenant_id,
      event_id,
      client_id: resolvedClientId,
      magic_link_expires_at: expiresAt,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown }

  if (reviewError || !review) {
    console.error('[POST /api/essay-reviews]', reviewError)
    return NextResponse.json({ error: 'Erro ao criar revisão.' }, { status: 500 })
  }

  // Gerar magic link
  const redirectTo = `${SITE_URL}/auth/callback?next=/${tenant.slug}/ensaio-review/${review.id}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linkData, error: linkError } = await (admin as any).auth.admin.generateLink({
    type: 'magiclink',
    email: clientEmail,
    options: { redirectTo, expiresIn: MAGIC_LINK_TTL_SECONDS },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[POST /api/essay-reviews] generateLink error:', linkError)
    return NextResponse.json({ error: 'Erro ao gerar link.' }, { status: 500 })
  }

  // Enviar email ao cliente
  await sendEssayReviewLink({
    to: clientEmail,
    clientName,
    reviewLink: linkData.properties.action_link,
    sessionTitle: event.title,
    studioName: profile.name ?? undefined,
  })

  return NextResponse.json({ review_id: review.id }, { status: 201 })
}
```

- [ ] **Step 4: Rodar os testes**

```bash
npx jest __tests__/api/essay-reviews/create.test.ts --no-coverage
```

Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/essay-reviews/route.ts __tests__/api/essay-reviews/create.test.ts
git commit -m "feat: add POST /api/essay-reviews — create review, create client, send magic link"
```

---

## Task 7: API GET review (individual)

**Files:**
- Create: `src/app/api/essay-reviews/[id]/route.ts`

- [ ] **Step 1: Implementar**

```typescript
// src/app/api/essay-reviews/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Props = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, tenant_id, status, selected_photo_ids, notes, payment_status, sent_at, submitted_at, magic_link_expires_at')
    .eq('id', id)
    .single() as { data: {
      id: string; event_id: string; client_id: string; tenant_id: string;
      status: string; selected_photo_ids: string[]; notes: string | null;
      payment_status: string; sent_at: string; submitted_at: string | null;
      magic_link_expires_at: string;
    } | null }

  if (!review) return NextResponse.json({ error: 'Review não encontrado.' }, { status: 404 })

  // Verificar permissão: cliente do review OU fotógrafo do tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null }

  const isClient = review.client_id === user.id
  const isPhotographer = profile?.tenant_id === review.tenant_id &&
    ['photographer', 'sub_photographer', 'admin'].includes(profile.role)

  if (!isClient && !isPhotographer) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // Buscar dados do evento + fotos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, title, slug, price_cents')
    .eq('id', review.event_id)
    .single() as { data: { id: string; title: string; slug: string; price_cents: number } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos } = await (admin as any)
    .from('photos')
    .select('id, public_storage_path, status')
    .eq('event_id', review.event_id)
    .eq('status', 'ready')
    .order('created_at', { ascending: true }) as
    { data: { id: string; public_storage_path: string | null; status: string }[] | null }

  // Buscar dados do cliente (apenas para fotógrafo)
  let clientData: { name: string; email: string } | null = null
  if (isPhotographer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: c } = await (admin as any)
      .from('users').select('name, email').eq('id', review.client_id).single() as
      { data: { name: string; email: string } | null }
    clientData = c
  }

  // Calcular valor com desconto de pacote
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packages } = await (admin as any)
    .from('photo_packages')
    .select('name, min_quantity, discount_percent')
    .eq('tenant_id', review.tenant_id)
    .eq('active', true)
    .order('min_quantity', { ascending: false }) as
    { data: { name: string; min_quantity: number; discount_percent: number }[] | null }

  return NextResponse.json({
    review,
    event: event ?? null,
    photos: photos ?? [],
    client: clientData,
    packages: packages ?? [],
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/essay-reviews/[id]/route.ts
git commit -m "feat: add GET /api/essay-reviews/[id]"
```

---

## Task 8: API de submissão da seleção

**Files:**
- Create: `src/app/api/essay-reviews/[id]/submit/route.ts`
- Create: `__tests__/api/essay-reviews/submit.test.ts`

- [ ] **Step 1: Escrever os testes**

```typescript
// __tests__/api/essay-reviews/submit.test.ts
/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/notifications/email', () => ({
  sendEssaySubmitted: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/payments/stripe', () => ({
  createStripePaymentIntent: jest.fn().mockResolvedValue({
    paymentIntentId: 'pi_test',
    clientSecret: 'pi_test_secret',
  }),
}))

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/essay-reviews/[id]/submit/route'

const mockUser = { id: 'client-1' }
const mockReview = {
  id: 'review-1',
  event_id: 'event-1',
  client_id: 'client-1',
  tenant_id: 'tenant-1',
  status: 'pending_selection',
  magic_link_expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
}

function buildMockAdmin() {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'essay_reviews') {
        return {
          select: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockReview, error: null }),
        }
      }
      if (table === 'events') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'event-1', title: 'Ensaio', price_cents: 2000, tenant_id: 'tenant-1' },
            error: null,
          }),
        }
      }
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { email: 'foto@studio.com', name: 'Fotógrafo' },
            error: null,
          }),
        }
      }
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { slug: 'studio-x' },
            error: null,
          }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null }) }
    }),
  }
}

describe('POST /api/essay-reviews/[id]/submit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser } }) },
    })
  })

  it('returns 401 when not authenticated', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    })
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews/review-1/submit', {
      method: 'POST',
      body: JSON.stringify({ selected_photo_ids: ['p1', 'p2'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'review-1' }) })
    expect(res.status).toBe(401)
  })

  it('submits selection with manual payment', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews/review-1/submit', {
      method: 'POST',
      body: JSON.stringify({
        selected_photo_ids: ['p1', 'p2', 'p3'],
        notes: 'Prefiro as 3 primeiras',
        payment_method: 'manual',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'review-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.payment_method).toBe('manual')
  })

  it('returns 400 when selected_photo_ids is empty', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())

    const req = new NextRequest('http://localhost/api/essay-reviews/review-1/submit', {
      method: 'POST',
      body: JSON.stringify({ selected_photo_ids: [] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'review-1' }) })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

```bash
npx jest __tests__/api/essay-reviews/submit.test.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implementar a rota de submit**

```typescript
// src/app/api/essay-reviews/[id]/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEssaySubmitted } from '@/lib/notifications/email'
import { createStripePaymentIntent } from '@/lib/payments/stripe'
import { createMercadoPagoPix } from '@/lib/payments/mercadopago'

type Props = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()

  // Buscar review e verificar que pertence ao cliente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, tenant_id, status, magic_link_expires_at')
    .eq('id', id)
    .single() as { data: {
      id: string; event_id: string; client_id: string; tenant_id: string;
      status: string; magic_link_expires_at: string;
    } | null }

  if (!review) return NextResponse.json({ error: 'Review não encontrado.' }, { status: 404 })
  if (review.client_id !== user.id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  if (review.status === 'submitted') return NextResponse.json({ error: 'Seleção já enviada.' }, { status: 409 })
  if (new Date(review.magic_link_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expirado.' }, { status: 410 })
  }

  let body: { selected_photo_ids?: string[]; notes?: string; payment_method?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { selected_photo_ids = [], notes, payment_method = 'manual' } = body

  if (!Array.isArray(selected_photo_ids) || selected_photo_ids.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos uma foto.' }, { status: 400 })
  }

  if (!['stripe', 'pix', 'manual'].includes(payment_method)) {
    return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 })
  }

  // Buscar evento para calcular valor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, title, price_cents, tenant_id')
    .eq('id', review.event_id)
    .single() as { data: { id: string; title: string; price_cents: number; tenant_id: string } | null }

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })

  // Calcular total com desconto de pacotes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packages } = await (admin as any)
    .from('photo_packages')
    .select('name, min_quantity, discount_percent')
    .eq('tenant_id', review.tenant_id)
    .eq('active', true)
    .order('min_quantity', { ascending: false }) as
    { data: { name: string; min_quantity: number; discount_percent: number }[] | null }

  const subtotal = (event.price_cents ?? 0) * selected_photo_ids.length
  const matchedPackage = (packages ?? []).find((p) => selected_photo_ids.length >= p.min_quantity)
  const discountCents = matchedPackage ? Math.round(subtotal * matchedPackage.discount_percent / 100) : 0
  const totalCents = subtotal - discountCents

  // Processar pagamento
  let paymentIntentId: string | null = null
  let stripeClientSecret: string | null = null
  let pixQrCode: string | null = null
  let pixQrCodeBase64: string | null = null
  let resolvedPaymentStatus = 'pending'

  if (payment_method === 'stripe' && totalCents > 0) {
    try {
      const intent = await createStripePaymentIntent({
        amountCents: totalCents,
        currency: 'brl',
        metadata: { review_id: review.id, event_id: review.event_id },
      })
      paymentIntentId = intent.paymentIntentId
      stripeClientSecret = intent.clientSecret
    } catch (err) {
      console.error('[submit] Stripe error:', err)
      return NextResponse.json({ error: 'Erro ao processar pagamento.' }, { status: 500 })
    }
  } else if (payment_method === 'pix' && totalCents > 0) {
    // Buscar email do cliente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientRow } = await (admin as any)
      .from('users').select('email').eq('id', user.id).single() as
      { data: { email: string } | null }
    try {
      const pix = await createMercadoPagoPix({
        amountCents: totalCents,
        description: event.title,
        payerEmail: clientRow?.email ?? '',
        orderId: review.id,
      })
      paymentIntentId = pix.paymentId
      pixQrCode = pix.pixQrCode
      pixQrCodeBase64 = pix.pixQrCodeBase64
    } catch (err) {
      console.error('[submit] PIX error:', err)
      return NextResponse.json({ error: 'Erro ao gerar PIX.' }, { status: 500 })
    }
  } else if (payment_method === 'manual') {
    resolvedPaymentStatus = 'manual'
  }

  // Atualizar review
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('essay_reviews')
    .update({
      status: 'submitted',
      selected_photo_ids,
      notes: notes ?? null,
      submitted_at: new Date().toISOString(),
      payment_status: resolvedPaymentStatus,
      payment_intent_id: paymentIntentId,
    })
    .eq('id', review.id)

  // Buscar email do fotógrafo para notificação
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantData } = await (admin as any)
    .from('tenants').select('slug').eq('id', review.tenant_id).single() as
    { data: { slug: string } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photographerData } = await (admin as any)
    .from('users')
    .select('email, name')
    .eq('tenant_id', review.tenant_id)
    .in('role', ['photographer', 'admin'])
    .order('created_at', { ascending: true })
    .limit(1)
    .single() as { data: { email: string; name: string } | null }

  if (photographerData) {
    const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/dashboard/eventos/${review.event_id}/fotos`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientProfile } = await (admin as any)
      .from('users').select('name').eq('id', user.id).single() as
      { data: { name: string } | null }

    await sendEssaySubmitted({
      to: photographerData.email,
      clientName: clientProfile?.name ?? 'Cliente',
      sessionTitle: event.title,
      selectedCount: selected_photo_ids.length,
      dashboardUrl,
    })
  }

  return NextResponse.json({
    success: true,
    payment_method,
    total_cents: totalCents,
    stripe_client_secret: stripeClientSecret,
    pix_qr_code: pixQrCode,
    pix_qr_code_base64: pixQrCodeBase64,
    tenant_slug: tenantData?.slug,
  })
}
```

- [ ] **Step 4: Rodar os testes**

```bash
npx jest __tests__/api/essay-reviews/submit.test.ts --no-coverage
```

Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/essay-reviews/[id]/submit/route.ts __tests__/api/essay-reviews/submit.test.ts
git commit -m "feat: add POST /api/essay-reviews/[id]/submit with payment support"
```

---

## Task 9: API de reenvio de link

**Files:**
- Create: `src/app/api/essay-reviews/[id]/resend/route.ts`

- [ ] **Step 1: Implementar**

```typescript
// src/app/api/essay-reviews/[id]/resend/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEssayReviewLink } from '@/lib/notifications/email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const MAGIC_LINK_TTL_SECONDS = 72 * 60 * 60

type Props = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role, name').eq('id', user.id).single() as
    { data: { tenant_id: string; role: string; name: string | null } | null }

  if (!profile?.tenant_id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, tenant_id, status')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single() as { data: { id: string; event_id: string; client_id: string; tenant_id: string; status: string } | null }

  if (!review) return NextResponse.json({ error: 'Review não encontrado.' }, { status: 404 })
  if (review.status === 'submitted') {
    return NextResponse.json({ error: 'Seleção já enviada. Reenvio não necessário.' }, { status: 409 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clientData } = await (admin as any)
    .from('users').select('email, name').eq('id', review.client_id).single() as
    { data: { email: string; name: string } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants').select('slug').eq('id', review.tenant_id).single() as
    { data: { slug: string } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events').select('title').eq('id', review.event_id).single() as
    { data: { title: string } | null }

  if (!clientData || !tenant || !event) {
    return NextResponse.json({ error: 'Dados insuficientes para reenvio.' }, { status: 500 })
  }

  const newExpiresAt = new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000).toISOString()
  const redirectTo = `${SITE_URL}/auth/callback?next=/${tenant.slug}/ensaio-review/${review.id}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linkData, error: linkError } = await (admin as any).auth.admin.generateLink({
    type: 'magiclink',
    email: clientData.email,
    options: { redirectTo, expiresIn: MAGIC_LINK_TTL_SECONDS },
  })

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: 'Erro ao gerar link.' }, { status: 500 })
  }

  // Atualizar expiração no banco
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('essay_reviews')
    .update({ magic_link_expires_at: newExpiresAt })
    .eq('id', review.id)

  await sendEssayReviewLink({
    to: clientData.email,
    clientName: clientData.name,
    reviewLink: linkData.properties.action_link,
    sessionTitle: event.title,
    studioName: profile.name ?? undefined,
  })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/essay-reviews/[id]/resend/route.ts
git commit -m "feat: add POST /api/essay-reviews/[id]/resend"
```

---

## Task 10: Página pública de seleção do cliente

**Files:**
- Create: `src/app/[tenant]/ensaio-review/[reviewId]/page.tsx`
- Create: `src/app/[tenant]/ensaio-review/[reviewId]/_components/review-client.tsx`

- [ ] **Step 1: Criar o server component da página**

```typescript
// src/app/[tenant]/ensaio-review/[reviewId]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReviewClient } from './_components/review-client'

type Props = { params: Promise<{ tenant: string; reviewId: string }> }

export default async function EnsaioReviewPage({ params }: Props) {
  const { tenant: tenantSlug, reviewId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${tenantSlug}/login?redirect=/${tenantSlug}/ensaio-review/${reviewId}`)
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, tenant_id, status, selected_photo_ids, notes, magic_link_expires_at')
    .eq('id', reviewId)
    .single() as { data: {
      id: string; event_id: string; client_id: string; tenant_id: string;
      status: string; selected_photo_ids: string[]; notes: string | null;
      magic_link_expires_at: string;
    } | null }

  if (!review) notFound()

  // Apenas o cliente do review pode acessar
  if (review.client_id !== user.id) notFound()

  // Link expirado
  if (new Date(review.magic_link_expires_at) < new Date() && review.status === 'pending_selection') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link expirado</h1>
          <p className="text-gray-600 text-sm">Solicite um novo link ao fotógrafo.</p>
        </div>
      </div>
    )
  }

  // Seleção já enviada
  if (review.status === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Seleção enviada!</h1>
          <p className="text-gray-600 text-sm">Você já enviou sua seleção. O fotógrafo entrará em contato em breve.</p>
        </div>
      </div>
    )
  }

  // Buscar evento + fotos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, title, slug, price_cents, tenant_id')
    .eq('id', review.event_id)
    .single() as { data: { id: string; title: string; slug: string; price_cents: number; tenant_id: string } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos } = await (admin as any)
    .from('photos')
    .select('id, public_storage_path, status')
    .eq('event_id', review.event_id)
    .eq('status', 'ready')
    .order('created_at', { ascending: true }) as
    { data: { id: string; public_storage_path: string | null; status: string }[] | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packages } = await (admin as any)
    .from('photo_packages')
    .select('name, min_quantity, discount_percent')
    .eq('tenant_id', review.tenant_id)
    .eq('active', true)
    .order('min_quantity', { ascending: false }) as
    { data: { name: string; min_quantity: number; discount_percent: number }[] | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants').select('name').eq('slug', tenantSlug).single() as
    { data: { name: string } | null }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-semibold text-gray-900">{tenant?.name ?? tenantSlug}</span>
          {event && <span className="text-sm text-gray-500">{event.title}</span>}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <ReviewClient
          reviewId={review.id}
          photos={photos ?? []}
          pricePerPhotoCents={event?.price_cents ?? 0}
          packages={packages ?? []}
          tenantSlug={tenantSlug}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar o client component de seleção**

```typescript
// src/app/[tenant]/ensaio-review/[reviewId]/_components/review-client.tsx
'use client'

import { useState } from 'react'

type Photo = {
  id: string
  public_storage_path: string | null
  status: string
}

type Package = {
  name: string
  min_quantity: number
  discount_percent: number
}

type Props = {
  reviewId: string
  photos: Photo[]
  pricePerPhotoCents: number
  packages: Package[]
  tenantSlug: string
}

const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

function getPhotoUrl(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${STORAGE_URL}/${path}`
}

function calcTotal(count: number, pricePerPhotoCents: number, packages: Package[]) {
  const subtotal = pricePerPhotoCents * count
  const matched = packages.find((p) => count >= p.min_quantity)
  const discount = matched ? Math.round(subtotal * matched.discount_percent / 100) : 0
  return { subtotal, discount, total: subtotal - discount, pkg: matched ?? null }
}

type Step = 'select' | 'confirm' | 'payment' | 'done'

export function ReviewClient({ reviewId, photos, pricePerPhotoCents, packages, tenantSlug }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<Step>('select')
  const [submitting, setSubmitting] = useState(false)
  const [paymentData, setPaymentData] = useState<{
    payment_method: string
    total_cents: number
    pix_qr_code?: string | null
    pix_qr_code_base64?: string | null
    stripe_client_secret?: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function togglePhoto(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const { subtotal, discount, total, pkg } = calcTotal(selected.size, pricePerPhotoCents, packages)

  async function handleSubmit(paymentMethod: 'stripe' | 'pix' | 'manual') {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/essay-reviews/${reviewId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_photo_ids: Array.from(selected),
          notes: notes.trim() || undefined,
          payment_method: paymentMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao enviar seleção.')
        return
      }
      if (paymentMethod === 'manual') {
        setStep('done')
        return
      }
      setPaymentData(data)
      setStep('payment')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Tela de seleção ──────────────────────────────────────────
  if (step === 'select') {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Selecione suas fotos</h1>
          <p className="text-sm text-gray-500">Clique nas fotos que deseja. Você pode selecionar quantas quiser.</p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
          {photos.map((photo) => {
            const isSelected = selected.has(photo.id)
            return (
              <div
                key={photo.id}
                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'
                }`}
                onClick={() => togglePhoto(photo.id)}
              >
                {photo.public_storage_path ? (
                  <img
                    src={getPhotoUrl(photo.public_storage_path) ?? ''}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable="false"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <span className="text-xs text-gray-400">Processando…</span>
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Observações */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observações para o fotógrafo (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: prefiro as fotos com fundo branco, quero incluir as do parque…"
          />
        </div>

        {/* Resumo e ação */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">
                {selected.size} foto{selected.size !== 1 ? 's' : ''} selecionada{selected.size !== 1 ? 's' : ''}
              </span>
              {pricePerPhotoCents > 0 && selected.size > 0 && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {pkg && (
                    <span className="text-green-600 mr-2">Pacote {pkg.name} ({pkg.discount_percent}% off)</span>
                  )}
                  Total: R$ {(total / 100).toFixed(2).replace('.', ',')}
                </div>
              )}
            </div>
            <button
              onClick={() => setStep('confirm')}
              disabled={selected.size === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Confirmar seleção
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Tela de confirmação / pagamento ──────────────────────────
  if (step === 'confirm') {
    return (
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Confirmar envio</h1>

        <div className="border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Fotos selecionadas</span>
            <span className="font-medium">{selected.size}</span>
          </div>
          {pricePerPhotoCents > 0 && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>R$ {(subtotal / 100).toFixed(2).replace('.', ',')}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Desconto ({pkg?.name})</span>
                  <span>-R$ {(discount / 100).toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t border-gray-100 pt-2">
                <span>Total</span>
                <span>R$ {(total / 100).toFixed(2).replace('.', ',')}</span>
              </div>
            </>
          )}
          {notes && (
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-500">Observações: {notes}</p>
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {pricePerPhotoCents > 0 && total > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Forma de pagamento:</p>
            <button
              onClick={() => handleSubmit('pix')}
              disabled={submitting}
              className="w-full py-3 border-2 border-blue-600 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-50 disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Processando…' : 'Pagar com PIX'}
            </button>
            <button
              onClick={() => handleSubmit('stripe')}
              disabled={submitting}
              className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Processando…' : 'Pagar com cartão'}
            </button>
            <button
              onClick={() => handleSubmit('manual')}
              disabled={submitting}
              className="w-full py-3 text-gray-500 text-sm hover:text-gray-700 disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Enviando…' : 'Pagarei depois'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => handleSubmit('manual')}
            disabled={submitting}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Enviando…' : 'Enviar seleção'}
          </button>
        )}

        <button
          onClick={() => setStep('select')}
          disabled={submitting}
          className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar e revisar seleção
        </button>
      </div>
    )
  }

  // ── Tela de pagamento PIX ────────────────────────────────────
  if (step === 'payment' && paymentData) {
    return (
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Pagamento PIX</h1>
        <p className="text-sm text-gray-500 mb-6">
          Total: <strong>R$ {((paymentData.total_cents ?? 0) / 100).toFixed(2).replace('.', ',')}</strong>
        </p>
        {paymentData.pix_qr_code_base64 && (
          <img
            src={`data:image/png;base64,${paymentData.pix_qr_code_base64}`}
            alt="QR Code PIX"
            className="mx-auto w-48 h-48 mb-4"
          />
        )}
        {paymentData.pix_qr_code && (
          <div className="bg-gray-50 rounded-lg p-3 mb-6 text-xs text-gray-700 break-all select-all">
            {paymentData.pix_qr_code}
          </div>
        )}
        <p className="text-xs text-gray-500 mb-6">
          Sua seleção já foi enviada ao fotógrafo. Após o pagamento ser confirmado, suas fotos serão tratadas.
        </p>
        <button
          onClick={() => setStep('done')}
          className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Concluir
        </button>
      </div>
    )
  }

  // ── Tela de sucesso ──────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-green-600 text-2xl">✓</span>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Seleção enviada!</h1>
      <p className="text-gray-500 text-sm">
        O fotógrafo recebeu sua seleção e entrará em contato em breve.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/[tenant]/ensaio-review/
git commit -m "feat: add public essay review selection page for clients"
```

---

## Task 11: Modal de envio para cliente no dashboard

**Files:**
- Create: `src/components/essay/send-to-client-modal.tsx`

- [ ] **Step 1: Criar o modal**

```typescript
// src/components/essay/send-to-client-modal.tsx
'use client'

import { useState, useCallback, useRef } from 'react'

type ClientResult = {
  id: string
  name: string
  email: string
  cpf: string | null
}

type Props = {
  eventId: string
  onClose: () => void
  onSent: () => void
}

export function SendToClientModal({ eventId, onClose, onSent }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClientResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newCpf, setNewCpf] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    setSelectedClient(null)
    setShowNewForm(false)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (q.trim().length < 2) { setResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.clients ?? [])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      const body = selectedClient
        ? { event_id: eventId, client_id: selectedClient.id }
        : {
            event_id: eventId,
            client: { name: newName.trim(), email: newEmail.trim(), cpf: newCpf.trim() },
          }

      const res = await fetch('/api/essay-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao enviar.')
        return
      }
      onSent()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  const canSend = selectedClient || (showNewForm && newName.trim() && newEmail.trim() && newCpf.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Enviar para cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {/* Busca */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Buscar cliente</label>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Nome ou email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Resultados */}
        {searching && <p className="text-xs text-gray-500 mb-2">Buscando…</p>}
        {!searching && results.length > 0 && !selectedClient && (
          <div className="border border-gray-200 rounded-lg mb-3 divide-y divide-gray-100 max-h-40 overflow-y-auto">
            {results.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedClient(c); setResults([]); setShowNewForm(false) }}
                className="w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-500">{c.email}</div>
              </button>
            ))}
          </div>
        )}
        {!searching && query.trim().length >= 2 && results.length === 0 && !selectedClient && !showNewForm && (
          <div className="mb-3">
            <p className="text-sm text-gray-500 mb-2">Nenhum cliente encontrado.</p>
            <button
              onClick={() => { setShowNewForm(true); setNewEmail(query.includes('@') ? query : '') }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Cadastrar novo cliente
            </button>
          </div>
        )}

        {/* Cliente selecionado */}
        {selectedClient && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
            <div>
              <div className="text-sm font-medium text-gray-900">{selectedClient.name}</div>
              <div className="text-xs text-gray-500">{selectedClient.email}</div>
            </div>
            <button onClick={() => { setSelectedClient(null); setQuery('') }} className="text-xs text-gray-500 hover:text-gray-700 ml-2">
              Trocar
            </button>
          </div>
        )}

        {/* Formulário novo cliente */}
        {showNewForm && (
          <div className="space-y-2 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-600 mb-2">Novo cliente</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome completo"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={newCpf}
              onChange={(e) => setNewCpf(e.target.value)}
              placeholder="CPF (000.000.000-00)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend || sending}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {sending ? 'Enviando…' : 'Enviar link'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/essay/send-to-client-modal.tsx
git commit -m "feat: add SendToClientModal component"
```

---

## Task 12: Integrar modal e badge de status na página de fotos do dashboard

**Files:**
- Modify: `src/app/(dashboard)/dashboard/eventos/[id]/fotos/page.tsx`

- [ ] **Step 1: Adicionar busca de review status e importações**

O arquivo atual inicia com imports e renderiza `FotosManager`. Vamos adicionar:
1. Busca do review mais recente do ensaio (se for tipo session)
2. Botão "Enviar para cliente" + modal
3. Badge de status

Substituir o conteúdo de `src/app/(dashboard)/dashboard/eventos/[id]/fotos/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { FotosManager } from '@/components/photos/fotos-manager'
import { SendToClientButton } from '@/components/essay/send-to-client-button'

type Props = { params: Promise<{ id: string }> }

type Photo = {
  id: string
  status: string
  thumbnail_path: string | null
  public_storage_path: string | null
  created_at: string
}

type EssayReview = {
  id: string
  status: string
  magic_link_expires_at: string
  submitted_at: string | null
  selected_photo_ids: string[]
}

const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending_selection: 'Aguardando seleção do cliente',
  submitted: 'Seleção recebida',
  in_progress: 'Em tratamento',
  delivered: 'Entregue',
}

const REVIEW_STATUS_COLOR: Record<string, string> = {
  pending_selection: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
}

export default async function FotosEventoPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = (await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()) as { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    redirect('/login')
  }

  const [eventResult, photosResult, reviewResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('events')
      .select('id, title, slug, status, type')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single() as Promise<{ data: { id: string; title: string; slug: string; status: string; type: string } | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('photos')
      .select('id, status, thumbnail_path, public_storage_path, created_at')
      .eq('event_id', id)
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false }) as Promise<{ data: Photo[] | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('essay_reviews')
      .select('id, status, magic_link_expires_at, submitted_at, selected_photo_ids')
      .eq('event_id', id)
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as Promise<{ data: EssayReview | null }>,
  ])

  const event = eventResult.data
  const photos = photosResult.data ?? []
  const review = reviewResult.data
  if (!event) notFound()

  const isSession = event.type === 'session'
  const isLinkExpired = review?.status === 'pending_selection' &&
    new Date(review.magic_link_expires_at) < new Date()

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
        <Link href="/dashboard/eventos" className="hover:text-[var(--color-ink)] transition-colors">
          Eventos
        </Link>
        <span>/</span>
        <span className="text-[var(--color-ink)]">{event.title}</span>
        <span>/</span>
        <span>Fotos</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            {event.title}
          </h1>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-gold-light)] text-[var(--color-gold)] border border-[var(--color-gold)]/30">
            {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
          </span>
          {review && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${REVIEW_STATUS_COLOR[review.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {REVIEW_STATUS_LABEL[review.status] ?? review.status}
              {review.status === 'submitted' && ` (${review.selected_photo_ids?.length ?? 0} fotos)`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSession && (
            <SendToClientButton
              eventId={id}
              hasActiveReview={!!review && !isLinkExpired && review.status === 'pending_selection'}
              canResend={!!review && isLinkExpired}
              reviewId={review?.id}
            />
          )}
          <Link
            href={`/dashboard/eventos/${id}/editar`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-sm font-medium hover:bg-[var(--color-surface-alt)] transition-colors"
          >
            ← Voltar ao Evento
          </Link>
        </div>
      </div>

      <FotosManager eventId={id} initialPhotos={photos} storageBase={storageBase} />
    </div>
  )
}
```

- [ ] **Step 2: Criar o botão client-side (SendToClientButton)**

Criar `src/components/essay/send-to-client-button.tsx`:

```typescript
// src/components/essay/send-to-client-button.tsx
'use client'

import { useState } from 'react'
import { SendToClientModal } from './send-to-client-modal'

type Props = {
  eventId: string
  hasActiveReview: boolean
  canResend: boolean
  reviewId?: string
}

export function SendToClientButton({ eventId, hasActiveReview, canResend, reviewId }: Props) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  async function handleResend() {
    if (!reviewId) return
    setResending(true)
    try {
      await fetch(`/api/essay-reviews/${reviewId}/resend`, { method: 'POST' })
      setResendDone(true)
    } finally {
      setResending(false)
    }
  }

  if (sent || resendDone) {
    return (
      <span className="px-4 py-2 text-sm text-green-700 bg-green-50 rounded-lg border border-green-200">
        Link enviado!
      </span>
    )
  }

  if (hasActiveReview) {
    return (
      <span className="px-4 py-2 text-sm text-yellow-700 bg-yellow-50 rounded-lg border border-yellow-200">
        Link enviado (aguardando cliente)
      </span>
    )
  }

  if (canResend) {
    return (
      <button
        onClick={handleResend}
        disabled={resending}
        className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
      >
        {resending ? 'Reenviando…' : 'Reenviar link'}
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Enviar para cliente
      </button>
      {open && (
        <SendToClientModal
          eventId={eventId}
          onClose={() => setOpen(false)}
          onSent={() => { setOpen(false); setSent(true) }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/eventos/[id]/fotos/page.tsx \
        src/components/essay/send-to-client-button.tsx
git commit -m "feat: add send-to-client button and review status badge in dashboard fotos page"
```

---

## Task 13: Teste final de integração manual (verificação)

- [ ] **Step 1: Rodar todos os testes do projeto**

```bash
cd C:/Users/dougl/workspace5/fotosaas
npx jest --no-coverage
```

Expected: PASS — sem falhas nos testes existentes nem nos novos

- [ ] **Step 2: Verificar build sem erros de TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros de tipagem

- [ ] **Step 3: Aplicar migration na VPS**

Se ainda não aplicado na Task 1:

```bash
scp supabase/migrations/0013_essay_reviews.sql root@2.25.150.248:/tmp/
ssh root@2.25.150.248 "docker exec fotosaas-db-1 psql -U postgres -d postgres -f /tmp/0013_essay_reviews.sql"
```

- [ ] **Step 4: Adicionar NEXT_PUBLIC_SITE_URL ao .env da VPS**

```bash
ssh root@2.25.150.248
echo "NEXT_PUBLIC_SITE_URL=http://2.25.150.248:8080" >> /opt/fotosaas/.env
```

- [ ] **Step 5: Rebuild e restart da aplicação na VPS**

```bash
ssh root@2.25.150.248
cd /opt/fotosaas
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app
```

- [ ] **Step 6: Commit final**

```bash
git add .
git commit -m "feat: F4 essay client review — complete implementation"
```

---

## Checklist de spec coverage

| Requisito do spec | Task |
|---|---|
| Tabela essay_reviews + RLS | Task 1 |
| /auth/callback para magic link | Task 3 |
| route-utils /auth como auth route | Task 2 |
| Email cliente (magic link) | Task 4 |
| Email fotógrafo (seleção recebida) | Task 4 |
| POST /api/essay-reviews (criar + criar cliente) | Task 6 |
| GET /api/essay-reviews/[id] | Task 7 |
| POST /api/essay-reviews/[id]/submit | Task 8 |
| POST /api/essay-reviews/[id]/resend | Task 9 |
| GET /api/clients/search | Task 5 |
| Página pública /[tenant]/ensaio-review/[id] | Task 10 |
| Seleção de fotos com contador | Task 10 |
| Tela de pagamento (PIX / cartão / manual) | Task 10 |
| Tela de sucesso | Task 10 |
| Modal de envio no dashboard | Task 11 |
| Badge de status no dashboard | Task 12 |
| Botão reenviar link | Task 12 |
| Magic link expirado (estado visual) | Task 10 |
| Conta criada com senha 123456 | Task 6 |
| Magic link via Supabase generateLink | Task 6 |
