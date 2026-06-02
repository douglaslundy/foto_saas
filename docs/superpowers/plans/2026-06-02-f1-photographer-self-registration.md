# F1 — Auto-Cadastro do Fotógrafo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que fotógrafos se auto-cadastrem na homepage, criando tenant+conta com status `pending`, aguardando aprovação do super admin via painel dedicado.

**Architecture:** Cadastro público (`POST /api/auth/register`) cria auth user + tenant(`status='pending'`) + row em `users` + row em `tenant_registrations`. Dashboard layout verifica status do tenant e bloqueia fotógrafos pendentes/rejeitados. Admin vê pedidos em `/admin/cadastros` e aprova/rejeita com notificação por email.

**Tech Stack:** Next.js 14 App Router, Supabase admin API, nodemailer (padrão existente), `slugify` de `@/lib/slug`, Jest.

**Spec:** `docs/superpowers/specs/2026-06-02-f1-photographer-self-registration-design.md`

---

## File Map

**Novos arquivos:**
- `supabase/migrations/0014_tenant_registrations.sql`
- `src/app/api/auth/register/route.ts`
- `src/app/api/admin/registrations/route.ts`
- `src/app/api/admin/registrations/[tenantId]/approve/route.ts`
- `src/app/api/admin/registrations/[tenantId]/reject/route.ts`
- `src/app/cadastro/page.tsx`
- `src/app/cadastro/_components/registration-form.tsx`
- `src/app/conta-em-analise/page.tsx`
- `src/app/conta-rejeitada/page.tsx`
- `src/app/(admin)/admin/cadastros/page.tsx`
- `src/app/(admin)/admin/cadastros/_components/registrations-table.tsx`
- `__tests__/api/auth/register.test.ts`
- `__tests__/api/admin/registrations.test.ts`

**Arquivos modificados:**
- `src/app/page.tsx` — substituir redirect por landing page
- `src/app/(dashboard)/dashboard/layout.tsx` — bloquear tenants pending/rejected
- `src/app/(admin)/admin/layout.tsx` — adicionar "Cadastros" no nav com badge
- `src/lib/notifications/email.ts` — 3 novas funções de email

---

## Task 1: Migração — tabela tenant_registrations

**Files:**
- Create: `supabase/migrations/0014_tenant_registrations.sql`

- [ ] **Step 1: Criar o arquivo**

```sql
-- supabase/migrations/0014_tenant_registrations.sql

CREATE TABLE tenant_registrations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  cpf_cnpj    text NOT NULL,
  city        text NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tenant_registrations_tenant_id_idx ON tenant_registrations(tenant_id);

ALTER TABLE tenant_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON tenant_registrations
  FOR ALL USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Aplicar na VPS**

```bash
scp supabase/migrations/0014_tenant_registrations.sql root@2.25.150.248:/tmp/
ssh root@2.25.150.248 "docker exec fotosaas-db-1 psql -U postgres -d postgres -f /tmp/0014_tenant_registrations.sql"
```

Expected: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, `CREATE POLICY`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0014_tenant_registrations.sql
git commit -m "feat: add tenant_registrations table for self-registration"
```

---

## Task 2: Funções de email para registro

**Files:**
- Modify: `src/lib/notifications/email.ts`
- Create: `__tests__/lib/notifications/registration-emails.test.ts`

- [ ] **Step 1: Criar os testes**

```typescript
// __tests__/lib/notifications/registration-emails.test.ts
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({}),
  }),
}))

import nodemailer from 'nodemailer'
import {
  sendRegistrationNotification,
  sendRegistrationApproved,
  sendRegistrationRejected,
} from '@/lib/notifications/email'

describe('sendRegistrationNotification', () => {
  it('sends notification to super admin', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock
    await sendRegistrationNotification({
      to: 'admin@fotosaas.com',
      studioName: 'Studio Silva',
      photographerName: 'João Silva',
      email: 'joao@studio.com',
      city: 'São Paulo',
      phone: '11999999999',
      cpfCnpj: '123.456.789-00',
    })
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Studio Silva') })
    )
  })
})

describe('sendRegistrationApproved', () => {
  it('sends approval email to photographer', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock
    await sendRegistrationApproved({
      to: 'joao@studio.com',
      photographerName: 'João',
      loginUrl: 'http://app/login',
    })
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'joao@studio.com' })
    )
  })
})

describe('sendRegistrationRejected', () => {
  it('sends rejection email with optional notes', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock
    await sendRegistrationRejected({
      to: 'joao@studio.com',
      photographerName: 'João',
      notes: 'Dados incompletos.',
    })
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'joao@studio.com' })
    )
  })

  it('does not throw on smtp failure', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock
    sendMail.mockRejectedValueOnce(new Error('SMTP error'))
    await expect(
      sendRegistrationRejected({ to: 'a@b.com', photographerName: 'X' })
    ).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Rodar — confirmar FAIL**

```bash
cd C:/Users/dougl/workspace5/fotosaas
npx jest __tests__/lib/notifications/registration-emails.test.ts --no-coverage
```

Expected: FAIL — funções não exportadas

- [ ] **Step 3: Adicionar funções ao final de `src/lib/notifications/email.ts`**

```typescript
export async function sendRegistrationNotification({
  to,
  studioName,
  photographerName,
  email,
  city,
  phone,
  cpfCnpj,
}: {
  to: string
  studioName: string
  photographerName: string
  email: string
  city: string
  phone: string
  cpfCnpj: string
}): Promise<void> {
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
      to,
      subject: `Novo pedido de cadastro — ${studioName}`,
      html: `
        <h2>Novo pedido de cadastro</h2>
        <p><strong>Estúdio:</strong> ${studioName}</p>
        <p><strong>Fotógrafo:</strong> ${photographerName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Cidade:</strong> ${city}</p>
        <p><strong>Telefone:</strong> ${phone}</p>
        <p><strong>CPF/CNPJ:</strong> ${cpfCnpj}</p>
        <p style="margin-top:16px">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/admin/cadastros"
             style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
            Revisar no painel admin
          </a>
        </p>
      `,
    })
  } catch (err) {
    console.error('[email] sendRegistrationNotification failed:', err)
  }
}

export async function sendRegistrationApproved({
  to,
  photographerName,
  loginUrl,
}: {
  to: string
  photographerName: string
  loginUrl: string
}): Promise<void> {
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
      to,
      subject: 'Seu cadastro foi aprovado!',
      html: `
        <h2>Parabéns, ${photographerName}!</h2>
        <p>Seu cadastro foi aprovado. Acesse agora o painel do seu estúdio:</p>
        <p style="margin-top:16px">
          <a href="${loginUrl}"
             style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
            Entrar no painel
          </a>
        </p>
      `,
    })
  } catch (err) {
    console.error('[email] sendRegistrationApproved failed:', err)
  }
}

export async function sendRegistrationRejected({
  to,
  photographerName,
  notes,
}: {
  to: string
  photographerName: string
  notes?: string
}): Promise<void> {
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
      to,
      subject: 'Atualização sobre seu cadastro',
      html: `
        <h2>Olá, ${photographerName}</h2>
        <p>Infelizmente não foi possível aprovar seu cadastro no momento.</p>
        ${notes ? `<p><strong>Motivo:</strong> ${notes}</p>` : ''}
        <p>Se tiver dúvidas, entre em contato conosco.</p>
      `,
    })
  } catch (err) {
    console.error('[email] sendRegistrationRejected failed:', err)
  }
}
```

- [ ] **Step 4: Rodar — confirmar PASS**

```bash
npx jest __tests__/lib/notifications/registration-emails.test.ts --no-coverage
```

Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/email.ts __tests__/lib/notifications/registration-emails.test.ts
git commit -m "feat: add registration email functions"
```

---

## Task 3: API pública de registro

**Files:**
- Create: `src/app/api/auth/register/route.ts`
- Create: `__tests__/api/auth/register.test.ts`

- [ ] **Step 1: Criar o teste**

```typescript
// __tests__/api/auth/register.test.ts
/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/notifications/email', () => ({
  sendRegistrationNotification: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/auth/register/route'

const validBody = {
  name: 'João Silva',
  email: 'joao@studio.com',
  password: '12345678',
  phone: '11999999999',
  cpf_cnpj: '123.456.789-00',
  studio_name: 'Studio Silva',
  city: 'São Paulo',
}

function buildMockAdmin() {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null }),
          insert: jest.fn().mockReturnThis(),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null }),
      }
    }),
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'new-user-id' } },
          error: null,
        }),
      },
    },
  }
}

describe('POST /api/auth/register', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when required fields are missing', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is too short', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...validBody, password: '123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 201 on successful registration', async () => {
    const mock = buildMockAdmin()
    // Make tenant insert succeed
    mock.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          insert: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'tenant-id', name: 'Studio Silva', slug: 'studio-silva' } }),
        }
      }
      return {
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null }),
      }
    })
    ;(createAdminClient as jest.Mock).mockReturnValue(mock)

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 2: Rodar — confirmar FAIL**

```bash
npx jest __tests__/api/auth/register.test.ts --no-coverage
```

Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Criar a rota**

```typescript
// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/slug'
import { sendRegistrationNotification } from '@/lib/notifications/email'

export async function POST(request: NextRequest) {
  let body: {
    name?: string
    email?: string
    password?: string
    phone?: string
    cpf_cnpj?: string
    studio_name?: string
    city?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { name, email, password, phone, cpf_cnpj, studio_name, city } = body

  if (!name?.trim() || !email?.trim() || !password || !phone?.trim() ||
      !cpf_cnpj?.trim() || !studio_name?.trim() || !city?.trim()) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Senha deve ter ao menos 8 caracteres.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Generate unique slug
  const baseSlug = slugify(studio_name)
  let slug = baseSlug
  let suffix = 1
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!existing) break
    slug = `${baseSlug}-${suffix++}`
  }

  // Create tenant with status pending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant, error: tenantError } = await (admin as any)
    .from('tenants')
    .insert({ name: studio_name.trim(), slug, status: 'pending' })
    .select('id, name, slug')
    .single() as { data: { id: string; name: string; slug: string } | null; error: unknown }

  if (tenantError || !tenant) {
    console.error('[register] tenant insert error:', tenantError)
    return NextResponse.json({ error: 'Erro ao criar estúdio.' }, { status: 500 })
  }

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  })

  if (authError) {
    // Rollback tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('tenants').delete().eq('id', tenant.id)
    const isConflict = authError.message?.toLowerCase().includes('already')
    return NextResponse.json(
      { error: isConflict ? 'Email já cadastrado.' : 'Erro ao criar conta.' },
      { status: isConflict ? 409 : 500 }
    )
  }

  const userId = authData.user.id

  // Create users row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('users').insert({
    id: userId,
    email: email.trim(),
    name: name.trim(),
    role: 'photographer',
    tenant_id: tenant.id,
  })

  // Create registration details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('tenant_registrations').insert({
    tenant_id: tenant.id,
    phone: phone.trim(),
    cpf_cnpj: cpf_cnpj.trim(),
    city: city.trim(),
  })

  // Notify super admin
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
  if (superAdminEmail) {
    await sendRegistrationNotification({
      to: superAdminEmail,
      studioName: tenant.name,
      photographerName: name.trim(),
      email: email.trim(),
      city: city.trim(),
      phone: phone.trim(),
      cpfCnpj: cpf_cnpj.trim(),
    })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
```

- [ ] **Step 4: Rodar — confirmar PASS**

```bash
npx jest __tests__/api/auth/register.test.ts --no-coverage
```

Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/register/route.ts __tests__/api/auth/register.test.ts
git commit -m "feat: add POST /api/auth/register — photographer self-registration"
```

---

## Task 4: APIs admin de registros (list + approve + reject)

**Files:**
- Create: `src/app/api/admin/registrations/route.ts`
- Create: `src/app/api/admin/registrations/[tenantId]/approve/route.ts`
- Create: `src/app/api/admin/registrations/[tenantId]/reject/route.ts`
- Create: `__tests__/api/admin/registrations.test.ts`

- [ ] **Step 1: Criar o teste**

```typescript
// __tests__/api/admin/registrations.test.ts
/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/notifications/email', () => ({
  sendRegistrationApproved: jest.fn().mockResolvedValue(undefined),
  sendRegistrationRejected: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET } from '@/app/api/admin/registrations/route'
import { PATCH as approve } from '@/app/api/admin/registrations/[tenantId]/approve/route'
import { PATCH as reject } from '@/app/api/admin/registrations/[tenantId]/reject/route'

const adminUser = { id: 'admin-1' }
const adminProfile = { role: 'admin', tenant_id: null }

function buildMock() {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: adminProfile }),
        }
      }
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'tenant-1', name: 'Studio X', status: 'pending' },
          }),
        }
      }
      if (table === 'tenant_registrations') {
        return {
          select: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { phone: '11999', cpf_cnpj: '123', city: 'SP' } }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null }) }
    }),
  }
}

describe('GET /api/admin/registrations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: adminUser } }) },
    })
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMock())
  })

  it('returns 401 when not authenticated', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    })
    const req = new NextRequest('http://localhost/api/admin/registrations')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { role: 'photographer' } }),
      }),
    })
    const req = new NextRequest('http://localhost/api/admin/registrations')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/admin/registrations/[tenantId]/approve', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: adminUser } }) },
    })
  })

  it('returns 200 and approves tenant', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMock())
    const req = new NextRequest('http://localhost/api/admin/registrations/tenant-1/approve', {
      method: 'PATCH',
    })
    const res = await approve(req, { params: Promise.resolve({ tenantId: 'tenant-1' }) })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/admin/registrations/[tenantId]/reject', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: adminUser } }) },
    })
  })

  it('returns 200 and rejects tenant', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMock())
    const req = new NextRequest('http://localhost/api/admin/registrations/tenant-1/reject', {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'Dados incompletos.' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await reject(req, { params: Promise.resolve({ tenantId: 'tenant-1' }) })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Rodar — confirmar FAIL**

```bash
npx jest __tests__/api/admin/registrations.test.ts --no-coverage
```

Expected: FAIL — módulos não encontrados

- [ ] **Step 3: Criar `src/app/api/admin/registrations/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('role').eq('id', user.id).single() as
    { data: { role: string } | null }

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // Fetch pending tenants with registration details and photographer info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenants, error } = await (admin as any)
    .from('tenants')
    .select('id, name, slug, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) as
    { data: { id: string; name: string; slug: string; created_at: string }[] | null; error: unknown }

  if (error) return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  if (!tenants?.length) return NextResponse.json({ registrations: [] })

  const tenantIds = tenants.map((t) => t.id)

  // Fetch photographers for these tenants
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photographers } = await (admin as any)
    .from('users')
    .select('tenant_id, name, email')
    .in('tenant_id', tenantIds)
    .eq('role', 'photographer') as
    { data: { tenant_id: string; name: string; email: string }[] | null }

  // Fetch registration details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: registrations } = await (admin as any)
    .from('tenant_registrations')
    .select('tenant_id, phone, cpf_cnpj, city')
    .in('tenant_id', tenantIds) as
    { data: { tenant_id: string; phone: string; cpf_cnpj: string; city: string }[] | null }

  const result = tenants.map((t) => ({
    tenant_id: t.id,
    studio_name: t.name,
    slug: t.slug,
    created_at: t.created_at,
    photographer: (photographers ?? []).find((p) => p.tenant_id === t.id) ?? null,
    registration: (registrations ?? []).find((r) => r.tenant_id === t.id) ?? null,
  }))

  return NextResponse.json({ registrations: result })
}
```

- [ ] **Step 4: Criar `src/app/api/admin/registrations/[tenantId]/approve/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendRegistrationApproved } from '@/lib/notifications/email'

type Props = { params: Promise<{ tenantId: string }> }

export async function PATCH(_request: NextRequest, { params }: Props) {
  const { tenantId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('role').eq('id', user.id).single() as
    { data: { role: string } | null }

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // Verify tenant is pending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants').select('id, name, status').eq('id', tenantId).single() as
    { data: { id: string; name: string; status: string } | null }

  if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado.' }, { status: 404 })
  if (tenant.status !== 'pending') {
    return NextResponse.json({ error: 'Tenant não está pendente.' }, { status: 409 })
  }

  // Approve
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('tenants').update({ status: 'active' }).eq('id', tenantId)

  // Get photographer email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photographer } = await (admin as any)
    .from('users').select('email, name').eq('tenant_id', tenantId).eq('role', 'photographer').single() as
    { data: { email: string; name: string } | null }

  if (photographer) {
    await sendRegistrationApproved({
      to: photographer.email,
      photographerName: photographer.name,
      loginUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/login`,
    })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Criar `src/app/api/admin/registrations/[tenantId]/reject/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendRegistrationRejected } from '@/lib/notifications/email'

type Props = { params: Promise<{ tenantId: string }> }

export async function PATCH(request: NextRequest, { params }: Props) {
  const { tenantId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('role').eq('id', user.id).single() as
    { data: { role: string } | null }

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  let notes: string | undefined
  try {
    const body = await request.json()
    notes = body.notes?.trim() || undefined
  } catch {
    // notes is optional
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants').select('id, name, status').eq('id', tenantId).single() as
    { data: { id: string; name: string; status: string } | null }

  if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado.' }, { status: 404 })
  if (tenant.status !== 'pending') {
    return NextResponse.json({ error: 'Tenant não está pendente.' }, { status: 409 })
  }

  // Reject
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('tenants').update({ status: 'rejected' }).eq('id', tenantId)

  // Save notes
  if (notes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('tenant_registrations').update({ notes }).eq('tenant_id', tenantId)
  }

  // Notify photographer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photographer } = await (admin as any)
    .from('users').select('email, name').eq('tenant_id', tenantId).eq('role', 'photographer').single() as
    { data: { email: string; name: string } | null }

  if (photographer) {
    await sendRegistrationRejected({
      to: photographer.email,
      photographerName: photographer.name,
      notes,
    })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 6: Rodar os testes**

```bash
npx jest __tests__/api/admin/registrations.test.ts --no-coverage
```

Expected: PASS (4 testes)

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/registrations/ __tests__/api/admin/registrations.test.ts
git commit -m "feat: add admin registrations APIs (list, approve, reject)"
```

---

## Task 5: Homepage — landing page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Substituir o redirect por landing page**

O arquivo atual tem apenas `redirect('/login')`. Substituir pelo conteúdo completo:

```typescript
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left — branding */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-[#111827]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2563eb] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
              <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-semibold text-white">FotoSaaS</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Gestão de eventos &amp; ensaios fotográficos
          </h1>
          <p className="text-white/50 text-base">
            A plataforma completa para fotógrafos profissionais.
          </p>
        </div>
      </div>

      {/* Right — ações */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[380px]">
          {/* Logo mobile */}
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
                <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold text-[#111827]">FotoSaaS</span>
          </div>

          <h2 className="text-2xl font-bold text-[#111827] mb-2">Bem-vindo</h2>
          <p className="text-sm text-[#6b7280] mb-8">
            Gerencie eventos, ensaios e vendas de fotos em um só lugar.
          </p>

          <div className="space-y-3">
            <Link
              href="/login"
              className="flex items-center justify-center w-full h-12 rounded-lg bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="flex items-center justify-center w-full h-12 rounded-lg border-2 border-[#2563eb] text-[#2563eb] font-semibold text-sm hover:bg-[#eff6ff] transition-colors"
            >
              Cadastre seu estúdio
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-[#9ca3af]">
            Já tem conta?{' '}
            <Link href="/login" className="text-[#2563eb] hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que TypeScript não tem erros**

```bash
cd C:/Users/dougl/workspace5/fotosaas && npx tsc --noEmit 2>&1 | head -10
```

Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace homepage redirect with landing page + register CTA"
```

---

## Task 6: Página de cadastro

**Files:**
- Create: `src/app/cadastro/page.tsx`
- Create: `src/app/cadastro/_components/registration-form.tsx`

- [ ] **Step 1: Criar `src/app/cadastro/page.tsx`**

```typescript
import { Suspense } from 'react'
import Link from 'next/link'
import { RegistrationForm } from './_components/registration-form'

export default function CadastroPage() {
  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-6">
      <div className="w-full max-w-[480px]">
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
                <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold text-[#111827]">FotoSaaS</span>
          </Link>
          <h1 className="text-2xl font-bold text-[#111827] mb-1">Cadastre seu estúdio</h1>
          <p className="text-sm text-[#6b7280]">
            Preencha os dados abaixo. Seu cadastro passará por aprovação.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#e5e7eb] p-6 shadow-sm">
          <Suspense>
            <RegistrationForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-sm text-[#6b7280]">
          Já tem conta?{' '}
          <Link href="/login" className="text-[#2563eb] hover:underline font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/app/cadastro/_components/registration-form.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RegistrationForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    cpf_cnpj: '',
    studio_name: '',
    city: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao realizar cadastro.')
        return
      }
      router.push('/conta-em-analise')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full h-11 px-3 rounded-lg border border-[#e5e7eb] bg-white text-[#111827] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition-all'
  const labelClass = 'block text-xs font-semibold text-[#374151] mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-2">Dados pessoais</p>

      <div>
        <label htmlFor="name" className={labelClass}>Nome completo</label>
        <input id="name" name="name" type="text" required value={form.name} onChange={handleChange} className={inputClass} placeholder="João Silva" />
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} className={inputClass} placeholder="joao@studio.com" />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>Senha (mínimo 8 caracteres)</label>
        <input id="password" name="password" type="password" required minLength={8} value={form.password} onChange={handleChange} className={inputClass} placeholder="••••••••" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="phone" className={labelClass}>Telefone</label>
          <input id="phone" name="phone" type="tel" required value={form.phone} onChange={handleChange} className={inputClass} placeholder="(11) 99999-9999" />
        </div>
        <div>
          <label htmlFor="cpf_cnpj" className={labelClass}>CPF / CNPJ</label>
          <input id="cpf_cnpj" name="cpf_cnpj" type="text" required value={form.cpf_cnpj} onChange={handleChange} className={inputClass} placeholder="000.000.000-00" />
        </div>
      </div>

      <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider pt-2">Dados do estúdio</p>

      <div>
        <label htmlFor="studio_name" className={labelClass}>Nome do estúdio</label>
        <input id="studio_name" name="studio_name" type="text" required value={form.studio_name} onChange={handleChange} className={inputClass} placeholder="Studio Silva" />
      </div>

      <div>
        <label htmlFor="city" className={labelClass}>Cidade</label>
        <input id="city" name="city" type="text" required value={form.city} onChange={handleChange} className={inputClass} placeholder="São Paulo, SP" />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 rounded-lg bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
      >
        {loading ? 'Enviando cadastro…' : 'Enviar cadastro'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/cadastro/
git commit -m "feat: add photographer registration page /cadastro"
```

---

## Task 7: Páginas de status (pending + rejected)

**Files:**
- Create: `src/app/conta-em-analise/page.tsx`
- Create: `src/app/conta-rejeitada/page.tsx`

- [ ] **Step 1: Criar `src/app/conta-em-analise/page.tsx`**

```typescript
import Link from 'next/link'

export default function ContaEmAnalisePage() {
  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#111827] mb-2">Cadastro em análise</h1>
        <p className="text-sm text-[#6b7280] mb-6">
          Recebemos seu pedido! Nossa equipe irá analisá-lo em breve. Você receberá um email quando for aprovado.
        </p>
        <Link
          href="/api/auth/signout"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg border border-[#e5e7eb] text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          Sair
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/app/conta-rejeitada/page.tsx`**

Esta página precisa buscar o motivo da rejeição. Usar um server component que consulta o banco:

```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function ContaRejeitadaPage() {
  let rejectionNote: string | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const admin = createAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (admin as any)
        .from('users').select('tenant_id').eq('id', user.id).single() as
        { data: { tenant_id: string } | null }

      if (profile?.tenant_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: reg } = await (admin as any)
          .from('tenant_registrations').select('notes').eq('tenant_id', profile.tenant_id).single() as
          { data: { notes: string | null } | null }
        rejectionNote = reg?.notes ?? null
      }
    }
  } catch {
    // fail gracefully
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#111827] mb-2">Cadastro não aprovado</h1>
        <p className="text-sm text-[#6b7280] mb-4">
          Infelizmente seu cadastro não foi aprovado no momento.
        </p>
        {rejectionNote && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4 text-left">
            <strong>Motivo:</strong> {rejectionNote}
          </div>
        )}
        <p className="text-xs text-[#9ca3af] mb-6">
          Se tiver dúvidas, entre em contato conosco.
        </p>
        <Link
          href="/api/auth/signout"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg border border-[#e5e7eb] text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          Sair
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Criar a rota de signout**

A página usa `/api/auth/signout`. Criar `src/app/api/auth/signout/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'))
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/conta-em-analise/ src/app/conta-rejeitada/ src/app/api/auth/signout/
git commit -m "feat: add pending and rejected account status pages"
```

---

## Task 8: Dashboard layout — bloquear tenants pending/rejected

**Files:**
- Modify: `src/app/(dashboard)/dashboard/layout.tsx`

- [ ] **Step 1: Ler o arquivo atual**

Ler `src/app/(dashboard)/dashboard/layout.tsx` para entender a estrutura atual antes de modificar.

- [ ] **Step 2: Adicionar verificação de status do tenant**

No layout atual, após a verificação de role (linha `if (!profile || !['photographer', ...`), adicionar a verificação de status. Localizar o bloco:

```typescript
// @ts-expect-error: profile type
if (!profile || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
  redirect('/login')
}
```

Substituir por:

```typescript
// @ts-expect-error: profile type
if (!profile || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
  redirect('/login')
}

// Block pending/rejected photographers
const profileData = profile as { name?: string; role?: string; tenant_id?: string } | null
if (profileData?.role === 'photographer' && profileData?.tenant_id) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (adminClient as any)
    .from('tenants')
    .select('status')
    .eq('id', profileData.tenant_id)
    .single() as { data: { status: string } | null }

  if (tenant?.status === 'pending') redirect('/conta-em-analise')
  if (tenant?.status === 'rejected') redirect('/conta-rejeitada')
}
```

**Posicionamento:** O `adminClient` já é declarado na linha ~26 do layout atual, ANTES do return. Adicione o novo bloco de verificação de status APÓS a declaração de `adminClient` e do `pendingCount`, mas ANTES do `return`. Assim `adminClient` já está disponível sem necessidade de mover nada.

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: sem novos erros

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/dashboard/layout.tsx
git commit -m "feat: block pending/rejected photographers in dashboard layout"
```

---

## Task 9: Página admin de cadastros

**Files:**
- Create: `src/app/(admin)/admin/cadastros/page.tsx`
- Create: `src/app/(admin)/admin/cadastros/_components/registrations-table.tsx`

- [ ] **Step 1: Criar `src/app/(admin)/admin/cadastros/page.tsx`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { RegistrationsTable } from './_components/registrations-table'

type Registration = {
  tenant_id: string
  studio_name: string
  slug: string
  created_at: string
  photographer: { name: string; email: string } | null
  registration: { phone: string; cpf_cnpj: string; city: string } | null
}

async function getPendingRegistrations(): Promise<Registration[]> {
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenants } = await (admin as any)
    .from('tenants')
    .select('id, name, slug, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) as
    { data: { id: string; name: string; slug: string; created_at: string }[] | null }

  if (!tenants?.length) return []

  const ids = tenants.map((t) => t.id)

  const [{ data: photographers }, { data: regDetails }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('users').select('tenant_id, name, email').in('tenant_id', ids).eq('role', 'photographer') as
      Promise<{ data: { tenant_id: string; name: string; email: string }[] | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('tenant_registrations').select('tenant_id, phone, cpf_cnpj, city').in('tenant_id', ids) as
      Promise<{ data: { tenant_id: string; phone: string; cpf_cnpj: string; city: string }[] | null }>,
  ])

  return tenants.map((t) => ({
    tenant_id: t.id,
    studio_name: t.name,
    slug: t.slug,
    created_at: t.created_at,
    photographer: (photographers ?? []).find((p) => p.tenant_id === t.id) ?? null,
    registration: (regDetails ?? []).find((r) => r.tenant_id === t.id) ?? null,
  }))
}

export default async function CadastrosPage() {
  const registrations = await getPendingRegistrations()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-ink,#111827)]">
          Pedidos de Cadastro
        </h1>
        <p className="text-[var(--color-ink-muted,#6b7280)] text-sm mt-1">
          {registrations.length} pedido{registrations.length !== 1 ? 's' : ''} pendente{registrations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {registrations.length === 0 ? (
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-10 text-center">
          <p className="text-sm text-[#6b7280]">Nenhum pedido pendente.</p>
        </div>
      ) : (
        <RegistrationsTable registrations={registrations} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/app/(admin)/admin/cadastros/_components/registrations-table.tsx`**

```typescript
'use client'

import { useState } from 'react'

type Registration = {
  tenant_id: string
  studio_name: string
  slug: string
  created_at: string
  photographer: { name: string; email: string } | null
  registration: { phone: string; cpf_cnpj: string; city: string } | null
}

type Props = { registrations: Registration[] }

export function RegistrationsTable({ registrations: initial }: Props) {
  const [items, setItems] = useState(initial)
  const [rejectModal, setRejectModal] = useState<{ tenantId: string; studioName: string } | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [working, setWorking] = useState<string | null>(null)

  async function handleApprove(tenantId: string) {
    setWorking(tenantId)
    try {
      const res = await fetch(`/api/admin/registrations/${tenantId}/approve`, { method: 'PATCH' })
      if (res.ok) setItems((prev) => prev.filter((r) => r.tenant_id !== tenantId))
    } finally {
      setWorking(null)
    }
  }

  async function handleReject() {
    if (!rejectModal) return
    setWorking(rejectModal.tenantId)
    try {
      const res = await fetch(`/api/admin/registrations/${rejectModal.tenantId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: rejectNotes }),
      })
      if (res.ok) {
        setItems((prev) => prev.filter((r) => r.tenant_id !== rejectModal.tenantId))
        setRejectModal(null)
        setRejectNotes('')
      }
    } finally {
      setWorking(null)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
        {/* Header */}
        <div className="bg-[#f9fafb] px-6 py-3 border-b border-[#e5e7eb] grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4">
          {['Estúdio', 'Fotógrafo', 'Cidade', 'Data', 'Ações'].map((h) => (
            <span key={h} className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{h}</span>
          ))}
        </div>

        <div className="divide-y divide-[#f3f4f6]">
          {items.map((r) => (
            <div key={r.tenant_id} className="px-6 py-4 grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4 items-center">
              <div>
                <p className="text-sm font-semibold text-[#111827]">{r.studio_name}</p>
                <p className="text-xs text-[#9ca3af] font-mono">{r.slug}</p>
                {r.registration && (
                  <p className="text-xs text-[#9ca3af]">CPF/CNPJ: {r.registration.cpf_cnpj}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-[#111827]">{r.photographer?.name ?? '—'}</p>
                <p className="text-xs text-[#6b7280]">{r.photographer?.email ?? '—'}</p>
                {r.registration && (
                  <p className="text-xs text-[#9ca3af]">{r.registration.phone}</p>
                )}
              </div>
              <p className="text-sm text-[#6b7280]">{r.registration?.city ?? '—'}</p>
              <p className="text-sm text-[#6b7280]">
                {new Date(r.created_at).toLocaleDateString('pt-BR')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApprove(r.tenant_id)}
                  disabled={working === r.tenant_id}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {working === r.tenant_id ? '…' : 'Aprovar'}
                </button>
                <button
                  onClick={() => setRejectModal({ tenantId: r.tenant_id, studioName: r.studio_name })}
                  disabled={working === r.tenant_id}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-1">Rejeitar cadastro</h2>
            <p className="text-sm text-[#6b7280] mb-4">{rejectModal.studioName}</p>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              Motivo (opcional)
            </label>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              placeholder="Ex: documentação insuficiente, área não atendida…"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setRejectModal(null); setRejectNotes('') }}
                className="flex-1 py-2.5 border border-[#e5e7eb] rounded-xl text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={working === rejectModal.tenantId}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {working === rejectModal.tenantId ? 'Rejeitando…' : 'Confirmar rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/admin/cadastros/"
git commit -m "feat: add /admin/cadastros page with approve/reject UI"
```

---

## Task 10: Admin layout — adicionar "Cadastros" no nav

**Files:**
- Modify: `src/app/(admin)/admin/layout.tsx`

- [ ] **Step 1: Ler o arquivo atual**

Ler `src/app/(admin)/admin/layout.tsx` para ver a estrutura do nav.

- [ ] **Step 2: Adicionar link + badge de pendentes**

No layout, a declaração `navLinks` atual é:
```typescript
const navLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/tenants', label: 'Fotógrafos' },
  { href: '/admin/repasses', label: 'Repasses' },
  { href: '/admin/configuracoes', label: 'Configurações' },
]
```

Antes desta declaração, adicionar a query de cadastros pendentes e atualizar navLinks para incluir o badge:

```typescript
// Count pending registrations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { count: pendingRegistrations } = await (adminClient as any)
  .from('tenants')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'pending') as { count: number | null }

const navLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/tenants', label: 'Fotógrafos' },
  { href: '/admin/cadastros', label: 'Cadastros', badge: pendingRegistrations ?? 0 },
  { href: '/admin/repasses', label: 'Repasses' },
  { href: '/admin/configuracoes', label: 'Configurações' },
]
```

Then update the nav rendering to show the badge. Find the `navLinks.map` block:

```typescript
{navLinks.map((link) => (
  <Link
    key={link.href}
    href={link.href}
    className="px-3 py-1.5 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
  >
    {link.label}
  </Link>
))}
```

Replace with:
```typescript
{navLinks.map((link) => (
  <Link
    key={link.href}
    href={link.href}
    className="px-3 py-1.5 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5"
  >
    {link.label}
    {'badge' in link && link.badge > 0 && (
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
        {link.badge}
      </span>
    )}
  </Link>
))}
```

Also update the `navLinks` type to accept optional badge: add `badge?: number` to the type, OR simply use the `'badge' in link` check as shown.

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/layout.tsx"
git commit -m "feat: add Cadastros nav link with pending badge in admin layout"
```

---

## Task 11: Verificação final

- [ ] **Step 1: Rodar todos os testes novos**

```bash
cd C:/Users/dougl/workspace5/fotosaas
npx jest __tests__/api/auth/register.test.ts __tests__/api/admin/registrations.test.ts __tests__/lib/notifications/registration-emails.test.ts --no-coverage
```

Expected: PASS (11 testes no total)

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 erros novos

- [ ] **Step 3: Verificar todos os novos arquivos existem**

```bash
ls src/app/cadastro/
ls src/app/conta-em-analise/
ls src/app/conta-rejeitada/
ls "src/app/(admin)/admin/cadastros/"
ls src/app/api/auth/register/
ls src/app/api/admin/registrations/
```

- [ ] **Step 4: Aplicar migration na VPS**

```bash
scp supabase/migrations/0014_tenant_registrations.sql root@2.25.150.248:/tmp/
ssh root@2.25.150.248 "docker exec fotosaas-db-1 psql -U postgres -d postgres -f /tmp/0014_tenant_registrations.sql"
```

- [ ] **Step 5: Adicionar SUPER_ADMIN_EMAIL no .env da VPS**

```bash
ssh root@2.25.150.248 "echo 'SUPER_ADMIN_EMAIL=douglaslundy@gmail.com' >> /opt/fotosaas/.env"
```

- [ ] **Step 6: Rebuild e restart**

```bash
ssh root@2.25.150.248 "cd /opt/fotosaas && docker compose -f docker-compose.prod.yml build app && docker compose -f docker-compose.prod.yml up -d app"
```

- [ ] **Step 7: Commit final**

```bash
git add .
git commit -m "feat: F1 complete — photographer self-registration with admin approval"
```

---

## Checklist de spec coverage

| Requisito | Task |
|---|---|
| Botão "Cadastre seu estúdio" na homepage | Task 5 |
| Formulário /cadastro (nome, email, senha, telefone, CPF/CNPJ, estúdio, cidade) | Task 6 |
| POST /api/auth/register — cria tenant(pending) + user + tenant_registrations | Task 3 |
| Slug único gerado do nome do estúdio | Task 3 |
| Redirecionamento para /conta-em-analise após cadastro | Task 6 |
| Página /conta-em-analise com botão Sair | Task 7 |
| Página /conta-rejeitada com motivo | Task 7 |
| Dashboard layout bloqueia tenants pending/rejected | Task 8 |
| Tabela tenant_registrations (phone, cpf_cnpj, city, notes) | Task 1 |
| Email de notificação para super admin | Tasks 2+3 |
| Email de aprovação para fotógrafo | Tasks 2+4 |
| Email de rejeição com motivo para fotógrafo | Tasks 2+4 |
| /admin/cadastros — lista pedidos pendentes | Task 9 |
| Botão Aprovar → tenant active + email | Task 4+9 |
| Botão Rejeitar + modal com motivo → tenant rejected + email | Task 4+9 |
| Badge de pendentes no nav admin | Task 10 |
| /api/auth/signout | Task 7 |
