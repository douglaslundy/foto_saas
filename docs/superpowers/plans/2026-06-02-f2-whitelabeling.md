# F2 — Whitelabeling: Nome e Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o super admin configure o nome global da plataforma e favicon; cada tenant pode ter seu próprio favicon; nome e ícone aparecem dinamicamente em todos os headers.

**Architecture:** `system_settings` existente recebe duas novas chaves (`platform_name`, `platform_favicon_url`). Coluna `favicon_url` adicionada à tabela `tenants`. Helper `getPlatformConfig()` com cache de 60s via `unstable_cache` fornece config para todos os layouts server-side. Favicon e title servidos via Next.js `generateMetadata` no root layout. Uploads vão para bucket Supabase Storage `platform-assets`.

**Tech Stack:** Next.js 14 App Router, Supabase Storage, `next/cache` (`unstable_cache`, `revalidatePath`), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-02-f2-whitelabeling-design.md`

---

## File Map

**Novos arquivos:**
- `supabase/migrations/0015_favicon_url_and_settings.sql`
- `src/lib/platform-config.ts`
- `src/app/api/admin/platform/favicon/route.ts`
- `src/app/api/tenant/favicon/route.ts`
- `__tests__/api/admin/platform-favicon.test.ts`

**Arquivos modificados:**
- `src/app/api/admin/settings/route.ts` — adicionar `platform_name` + `platform_favicon_url` às chaves aceitas; mudar `update` para `upsert`; chamar `revalidatePath` após salvar
- `src/app/api/tenant/profile/route.ts` — aceitar `favicon_url` no PATCH
- `src/app/layout.tsx` — mudar metadata estática para `generateMetadata` dinâmica
- `src/app/page.tsx` — usar `platformName` de `getPlatformConfig()`
- `src/app/(auth)/login/page.tsx` — usar `platformName`
- `src/app/(admin)/admin/layout.tsx` — usar `platformName` + generateMetadata para favicon
- `src/app/cadastro/page.tsx` — usar `platformName`
- `src/app/[tenant]/layout.tsx` — generateMetadata com tenant favicon
- `src/app/(admin)/admin/configuracoes/_components/admin-settings-form.tsx` — adicionar seção "Identidade da Plataforma"
- `src/app/(dashboard)/dashboard/configuracoes/perfil-studio/_components/perfil-studio-form.tsx` — adicionar campo favicon
- `src/app/(dashboard)/dashboard/configuracoes/perfil-studio/page.tsx` — passar favicon_url para o form

---

## Task 1: Migration — favicon_url e storage bucket

**Files:**
- Create: `supabase/migrations/0015_favicon_url_and_settings.sql`

- [ ] **Step 1: Criar o arquivo**

```sql
-- supabase/migrations/0015_favicon_url_and_settings.sql

-- Adicionar favicon_url aos tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS favicon_url text;

-- Criar bucket platform-assets (público)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-assets',
  'platform-assets',
  true,
  524288, -- 512 KB
  ARRAY['image/png', 'image/x-icon', 'image/svg+xml', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage: leitura pública, escrita apenas service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'platform_assets_public_read'
  ) THEN
    CREATE POLICY "platform_assets_public_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'platform-assets');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'platform_assets_service_insert'
  ) THEN
    CREATE POLICY "platform_assets_service_insert" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'platform-assets' AND auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'platform_assets_service_update'
  ) THEN
    CREATE POLICY "platform_assets_service_update" ON storage.objects
      FOR UPDATE USING (bucket_id = 'platform-assets' AND auth.role() = 'service_role');
  END IF;
END $$;

-- Pré-inserir as novas chaves em system_settings (com valor vazio)
INSERT INTO system_settings (key, value)
VALUES
  ('platform_name', ''),
  ('platform_favicon_url', '')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Aplicar na VPS**

```bash
scp supabase/migrations/0015_favicon_url_and_settings.sql root@2.25.150.248:/tmp/
ssh root@2.25.150.248 "docker exec fotosaas-db-1 psql -U postgres -d postgres -f /tmp/0015_favicon_url_and_settings.sql"
```

Expected: `ALTER TABLE`, `INSERT 0 1` (ou `INSERT 0 0` se bucket já existir), `DO`, `INSERT 0 2` (ou menos se chaves já existirem).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0015_favicon_url_and_settings.sql
git commit -m "feat: add favicon_url to tenants, platform-assets bucket, pre-insert settings keys"
```

---

## Task 2: Helper getPlatformConfig + getTenantFavicon

**Files:**
- Create: `src/lib/platform-config.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// src/lib/platform-config.ts
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const getPlatformConfig = unstable_cache(
  async (): Promise<{ platformName: string; faviconUrl: string | null }> => {
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (admin as any)
      .from('system_settings')
      .select('key, value')
      .in('key', ['platform_name', 'platform_favicon_url']) as
      { data: { key: string; value: string | null }[] | null }

    const map: Record<string, string> = {}
    for (const row of rows ?? []) {
      if (row.value) map[row.key] = row.value
    }

    return {
      platformName: map['platform_name']?.trim() || 'FotoSaaS',
      faviconUrl: map['platform_favicon_url'] || null,
    }
  },
  ['platform-config'],
  { revalidate: 60, tags: ['platform-config'] }
)

export async function getTenantFavicon(tenantSlug: string): Promise<string | null> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('tenants')
    .select('favicon_url')
    .eq('slug', tenantSlug)
    .single() as { data: { favicon_url: string | null } | null }
  return data?.favicon_url ?? null
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd C:/Users/dougl/workspace5/fotosaas && npx tsc --noEmit 2>&1 | head -10
```

Expected: sem erros no novo arquivo

- [ ] **Step 3: Commit**

```bash
git add src/lib/platform-config.ts
git commit -m "feat: add getPlatformConfig and getTenantFavicon helpers with cache"
```

---

## Task 3: Atualizar admin settings API

**Files:**
- Modify: `src/app/api/admin/settings/route.ts`

- [ ] **Step 1: Ler o arquivo atual**

Ler `src/app/api/admin/settings/route.ts` para confirmar a estrutura antes de editar.

- [ ] **Step 2: Atualizar a lista de chaves aceitas e mudar update → upsert**

No PUT handler, localizar:

```typescript
  const keys = [
    'global_commission_percent',
    'stripe_secret_key',
    'stripe_publishable_key',
    'mercadopago_access_token',
    'auto_approve_sub_events',
  ] as const
```

Substituir por:

```typescript
  const keys = [
    'global_commission_percent',
    'stripe_secret_key',
    'stripe_publishable_key',
    'mercadopago_access_token',
    'auto_approve_sub_events',
    'platform_name',
    'platform_favicon_url',
  ] as const
```

Localizar o loop que faz `.update()`:

```typescript
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminClient as any)
      .from('system_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
```

Substituir por:

```typescript
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminClient as any)
      .from('system_settings')
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
```

Adicionar ao topo do arquivo (após os imports existentes):

```typescript
import { revalidateTag } from 'next/cache'
```

Adicionar ANTES de `return NextResponse.json({ ok: true })` no PUT handler:

```typescript
  // Invalidate platform config cache if branding settings were saved
  if ('platform_name' in body || 'platform_favicon_url' in body) {
    revalidateTag('platform-config')
  }
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/settings/route.ts
git commit -m "feat: add platform_name and platform_favicon_url to admin settings API with upsert"
```

---

## Task 4: API de upload de favicon global

**Files:**
- Create: `src/app/api/admin/platform/favicon/route.ts`
- Create: `__tests__/api/admin/platform-favicon.test.ts`

- [ ] **Step 1: Criar o teste**

```typescript
// __tests__/api/admin/platform-favicon.test.ts
/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidateTag: jest.fn() }))

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/admin/platform/favicon/route'

function buildMockAdmin() {
  return {
    from: jest.fn().mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: { path: 'favicon/global.png' }, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'http://storage/favicon/global.png' } }),
      }),
    },
  }
}

describe('POST /api/admin/platform/favicon', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
    })
  })

  it('returns 401 when not authenticated', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    })
    ;(createAdminClient as jest.Mock).mockReturnValue(buildMockAdmin())
    const req = new NextRequest('http://localhost/api/admin/platform/favicon', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when no file or url provided', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      ...buildMockAdmin(),
      from: jest.fn().mockImplementation((t: string) => {
        if (t === 'users') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }) }
        return { upsert: jest.fn().mockResolvedValue({ error: null }) }
      }),
    })
    const req = new NextRequest('http://localhost/api/admin/platform/favicon', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('saves URL directly when url provided in JSON body', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      ...buildMockAdmin(),
      from: jest.fn().mockImplementation((t: string) => {
        if (t === 'users') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }) }
        return { upsert: jest.fn().mockResolvedValue({ error: null }) }
      }),
    })
    const req = new NextRequest('http://localhost/api/admin/platform/favicon', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/icon.png' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.url).toBe('https://example.com/icon.png')
  })
})
```

- [ ] **Step 2: Rodar — confirmar FAIL**

```bash
npx jest __tests__/api/admin/platform-favicon.test.ts --no-coverage
```

Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Criar a rota**

```typescript
// src/app/api/admin/platform/favicon/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidateTag } from 'next/cache'

const ALLOWED_TYPES = ['image/png', 'image/x-icon', 'image/svg+xml', 'image/jpeg']
const MAX_SIZE = 512 * 1024 // 512 KB

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('role').eq('id', user.id).single() as
    { data: { role: string } | null }

  if (profile?.role !== 'admin') return null
  return admin
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const contentType = request.headers.get('content-type') ?? ''

  // Handle URL submission (JSON body)
  if (contentType.includes('application/json')) {
    let body: { url?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
    }

    if (!body.url?.trim()) {
      return NextResponse.json({ error: 'URL ou arquivo é obrigatório.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('system_settings').upsert(
      { key: 'platform_favicon_url', value: body.url.trim(), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    revalidateTag('platform-config')
    return NextResponse.json({ url: body.url.trim() })
  }

  // Handle file upload (multipart/form-data)
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Erro ao processar arquivo.' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo não permitido. Use PNG, ICO, SVG ou JPG.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    if (bytes.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 512 KB.' }, { status: 400 })
    }

    const ext = file.type === 'image/svg+xml' ? 'svg'
      : file.type === 'image/png' ? 'png'
      : file.type === 'image/jpeg' ? 'jpg'
      : 'ico'

    const path = `favicon/global.${ext}`
    const { error: uploadError } = await admin.storage
      .from('platform-assets')
      .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('[favicon upload]', uploadError)
      return NextResponse.json({ error: 'Erro ao fazer upload.' }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage.from('platform-assets').getPublicUrl(path)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('system_settings').upsert(
      { key: 'platform_favicon_url', value: publicUrl, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    revalidateTag('platform-config')
    return NextResponse.json({ url: publicUrl })
  }

  return NextResponse.json({ error: 'URL ou arquivo é obrigatório.' }, { status: 400 })
}
```

- [ ] **Step 4: Rodar os testes**

```bash
npx jest __tests__/api/admin/platform-favicon.test.ts --no-coverage
```

Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/platform/favicon/route.ts __tests__/api/admin/platform-favicon.test.ts
git commit -m "feat: add POST /api/admin/platform/favicon — global favicon upload or URL"
```

---

## Task 5: API de favicon do tenant

**Files:**
- Create: `src/app/api/tenant/favicon/route.ts`
- Modify: `src/app/api/tenant/profile/route.ts`

- [ ] **Step 1: Criar `src/app/api/tenant/favicon/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_TYPES = ['image/png', 'image/x-icon', 'image/svg+xml', 'image/jpeg']
const MAX_SIZE = 512 * 1024

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single() as
    { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const contentType = request.headers.get('content-type') ?? ''

  // URL submission
  if (contentType.includes('application/json')) {
    let body: { url?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
    }

    if (!body.url?.trim()) {
      return NextResponse.json({ error: 'URL ou arquivo é obrigatório.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('tenants')
      .update({ favicon_url: body.url.trim() })
      .eq('id', profile.tenant_id)

    return NextResponse.json({ url: body.url.trim() })
  }

  // File upload
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Erro ao processar arquivo.' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo não permitido. Use PNG, ICO, SVG ou JPG.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    if (bytes.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 512 KB.' }, { status: 400 })
    }

    const ext = file.type === 'image/svg+xml' ? 'svg'
      : file.type === 'image/png' ? 'png'
      : file.type === 'image/jpeg' ? 'jpg'
      : 'ico'

    const path = `favicon/${profile.tenant_id}.${ext}`
    const { error: uploadError } = await admin.storage
      .from('platform-assets')
      .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('[tenant favicon upload]', uploadError)
      return NextResponse.json({ error: 'Erro ao fazer upload.' }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage.from('platform-assets').getPublicUrl(path)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('tenants')
      .update({ favicon_url: publicUrl })
      .eq('id', profile.tenant_id)

    return NextResponse.json({ url: publicUrl })
  }

  return NextResponse.json({ error: 'URL ou arquivo é obrigatório.' }, { status: 400 })
}
```

- [ ] **Step 2: Modificar `src/app/api/tenant/profile/route.ts` para aceitar favicon_url**

No PATCH handler, localizar:

```typescript
  const { name, custom_domain, primary_color, bio } = body as {
    name?: string
    custom_domain?: string | null
    primary_color?: string | null
    bio?: string | null
  }
```

Substituir por:

```typescript
  const { name, custom_domain, primary_color, bio, favicon_url } = body as {
    name?: string
    custom_domain?: string | null
    primary_color?: string | null
    bio?: string | null
    favicon_url?: string | null
  }
```

E no bloco de `updates`, adicionar após `if (bio !== undefined) updates.bio = bio || null`:

```typescript
  if (favicon_url !== undefined) updates.favicon_url = favicon_url || null
```

E no `.select()` do retorno, adicionar `favicon_url`:

```typescript
      .select('name, slug, custom_domain, primary_color, bio, favicon_url')
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/app/api/tenant/favicon/route.ts src/app/api/tenant/profile/route.ts
git commit -m "feat: add POST /api/tenant/favicon and favicon_url support in tenant profile API"
```

---

## Task 6: Aplicar platformName e favicon nos layouts

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(admin)/admin/layout.tsx`
- Modify: `src/app/cadastro/page.tsx`
- Modify: `src/app/[tenant]/layout.tsx`

- [ ] **Step 1: Atualizar `src/app/layout.tsx`**

Substituir o conteúdo completo:

```typescript
import type { Metadata } from 'next'
import './globals.css'
import { getPlatformConfig } from '@/lib/platform-config'

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPlatformConfig()
  return {
    title: config.platformName,
    description: 'Plataforma de venda de fotos para fotógrafos',
    icons: config.faviconUrl ? { icon: config.faviconUrl } : undefined,
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Atualizar `src/app/page.tsx`**

Ler o arquivo atual (que foi criado no F1 com "FotoSaaS" hardcoded). Adicionar no topo a importação e chamar `getPlatformConfig()`:

```typescript
import Link from 'next/link'
import { getPlatformConfig } from '@/lib/platform-config'

export default async function Home() {
  const { platformName } = await getPlatformConfig()

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
          <span className="font-semibold text-white">{platformName}</span>
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
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
                <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold text-[#111827]">{platformName}</span>
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

- [ ] **Step 3: Atualizar `src/app/(auth)/login/page.tsx`**

Ler o arquivo atual. Converter para `async` e substituir as ocorrências de "FotoSaaS":

```typescript
import { Suspense } from 'react'
import { LoginForm } from './_components/login-form'
import { getPlatformConfig } from '@/lib/platform-config'

export default async function LoginPage() {
  const { platformName } = await getPlatformConfig()

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left — imagem/branding */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-[#111827]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2563eb] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
              <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-semibold text-white">{platformName}</span>
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

      {/* Right — formulário */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6 md:hidden">
              <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
                  <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="font-semibold text-[#111827]">{platformName}</span>
            </div>
            <h2 className="text-2xl font-bold text-[#111827] mb-1">Bem-vindo de volta</h2>
            <p className="text-sm text-[#6b7280]">Entre com suas credenciais para continuar</p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Atualizar `src/app/(admin)/admin/layout.tsx`**

Ler o arquivo atual. Adicionar import de `getPlatformConfig`. Chamar `getPlatformConfig()` após o profile check. Substituir "FotoSaaS" pelo `platformName`:

Localizar no arquivo:
```typescript
  if (profile?.role !== 'admin') redirect('/dashboard')
```

Após essa linha, adicionar:
```typescript
  const { platformName } = await getPlatformConfig()
```

E no import no topo, adicionar:
```typescript
import { getPlatformConfig } from '@/lib/platform-config'
```

Substituir todas as ocorrências de `'FotoSaaS'` no JSX pelo valor de `{platformName}`. No arquivo atual há duas — no `<span>` do header desktop e no `<span>` mobile. Exemplo da substituição no span desktop:

```tsx
<span className="font-semibold text-sm text-white">{platformName}</span>
```

- [ ] **Step 5: Atualizar `src/app/cadastro/page.tsx`**

Ler o arquivo atual. Converter para `async` e substituir "FotoSaaS":

```typescript
import { Suspense } from 'react'
import Link from 'next/link'
import { RegistrationForm } from './_components/registration-form'
import { getPlatformConfig } from '@/lib/platform-config'

export default async function CadastroPage() {
  const { platformName } = await getPlatformConfig()

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
            <span className="font-semibold text-[#111827]">{platformName}</span>
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

- [ ] **Step 6: Adicionar generateMetadata ao `src/app/[tenant]/layout.tsx`**

Ler o arquivo atual. Adicionar no topo:

```typescript
import type { Metadata } from 'next'
import { getPlatformConfig, getTenantFavicon } from '@/lib/platform-config'
```

Adicionar antes do export default:

```typescript
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>
}): Promise<Metadata> {
  const { tenant: slug } = await params
  const [tenantFavicon, globalConfig] = await Promise.all([
    getTenantFavicon(slug),
    getPlatformConfig(),
  ])
  const faviconUrl = tenantFavicon ?? globalConfig.faviconUrl
  return {
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
  }
}
```

- [ ] **Step 7: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: sem erros novos

- [ ] **Step 8: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx "src/app/(auth)/login/page.tsx" \
        "src/app/(admin)/admin/layout.tsx" src/app/cadastro/page.tsx \
        "src/app/[tenant]/layout.tsx"
git commit -m "feat: apply dynamic platformName and favicon to all layouts and pages"
```

---

## Task 7: Admin settings form — seção Identidade da Plataforma

**Files:**
- Modify: `src/app/(admin)/admin/configuracoes/_components/admin-settings-form.tsx`
- Modify: `src/app/(admin)/admin/configuracoes/page.tsx`

- [ ] **Step 1: Atualizar `admin-settings-form.tsx`**

Ler o arquivo atual. O `Settings` type e o estado `values` precisam incluir os novos campos. Fazer as seguintes alterações:

**1. Atualizar o type `Settings`:**
```typescript
type Settings = {
  global_commission_percent: string
  stripe_secret_key: string
  stripe_publishable_key: string
  mercadopago_access_token: string
  auto_approve_sub_events: string
  platform_name: string
  platform_favicon_url: string
}
```

**2. Atualizar a prop `initialSettings`:** já usa o type `Settings`, então só precisamos passar os novos campos ao chamar o componente.

**3. Adicionar estado para upload de favicon:**
```typescript
  const [faviconUploading, setFaviconUploading] = useState(false)
  const [faviconError, setFaviconError] = useState<string | null>(null)
```

**4. Adicionar função de upload:**
```typescript
  async function handleFaviconFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFaviconUploading(true)
    setFaviconError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/platform/favicon', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setFaviconError(data.error ?? 'Erro ao fazer upload.'); return }
      setValues((prev) => ({ ...prev, platform_favicon_url: data.url }))
    } catch {
      setFaviconError('Erro de conexão.')
    } finally {
      setFaviconUploading(false)
    }
  }
```

**5. Adicionar seção "Identidade da Plataforma" ANTES da seção de Comissão:**

```tsx
      {/* Section 0 — Identidade */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2
            className="text-lg font-semibold text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Identidade da Plataforma
          </h2>
        </div>
        <div className="px-6 py-5 space-y-5">
          {/* Nome */}
          <div>
            <label htmlFor="platform_name" className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
              Nome da plataforma
            </label>
            <input
              id="platform_name"
              type="text"
              value={values.platform_name}
              onChange={(e) => handleChange('platform_name', e.target.value)}
              placeholder="FotoSaaS"
              className="w-full max-w-xs rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
              Aparece no cabeçalho do admin, login e homepage.
            </p>
          </div>

          {/* Favicon */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
              Favicon global
            </label>
            {values.platform_favicon_url && (
              <div className="mb-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={values.platform_favicon_url} alt="Favicon atual" className="w-8 h-8 object-contain border border-[var(--color-border)] rounded" />
                <span className="text-xs text-[var(--color-ink-muted)]">Favicon atual</span>
              </div>
            )}
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-[var(--color-ink-muted)] mb-1 block">Upload de arquivo (PNG, ICO, SVG, JPG — máx. 512 KB)</label>
                <input
                  type="file"
                  accept=".png,.ico,.svg,.jpg,.jpeg"
                  onChange={handleFaviconFileUpload}
                  disabled={faviconUploading}
                  className="text-sm text-[var(--color-ink)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[var(--color-surface-alt)] file:text-[var(--color-ink)] hover:file:opacity-80 disabled:opacity-50"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-ink-muted)]">ou</span>
              </div>
              <div>
                <label htmlFor="platform_favicon_url" className="text-xs font-medium text-[var(--color-ink-muted)] mb-1 block">URL externa</label>
                <input
                  id="platform_favicon_url"
                  type="url"
                  value={values.platform_favicon_url}
                  onChange={(e) => handleChange('platform_favicon_url', e.target.value)}
                  placeholder="https://exemplo.com/favicon.ico"
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent font-mono"
                />
              </div>
              {faviconUploading && <p className="text-xs text-[var(--color-ink-muted)]">Fazendo upload…</p>}
              {faviconError && <p className="text-xs text-[var(--color-danger)]">{faviconError}</p>}
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Atualizar `src/app/(admin)/admin/configuracoes/page.tsx`**

Ler o arquivo atual. Adicionar `platform_name` e `platform_favicon_url` ao `initialSettings` que é passado ao form:

```typescript
  const initialSettings = {
    global_commission_percent: settingsMap['global_commission_percent'] ?? '10',
    stripe_secret_key: settingsMap['stripe_secret_key'] ?? '',
    stripe_publishable_key: settingsMap['stripe_publishable_key'] ?? '',
    mercadopago_access_token: settingsMap['mercadopago_access_token'] ?? '',
    auto_approve_sub_events: settingsMap['auto_approve_sub_events'] ?? 'false',
    platform_name: settingsMap['platform_name'] ?? '',
    platform_favicon_url: settingsMap['platform_favicon_url'] ?? '',
  }
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/configuracoes/"
git commit -m "feat: add Identidade da Plataforma section to admin settings form"
```

---

## Task 8: Perfil do tenant — campo de favicon

**Files:**
- Modify: `src/app/(dashboard)/dashboard/configuracoes/perfil-studio/_components/perfil-studio-form.tsx`
- Modify: `src/app/(dashboard)/dashboard/configuracoes/perfil-studio/page.tsx`

- [ ] **Step 1: Atualizar `perfil-studio-form.tsx`**

Ler o arquivo atual. Adicionar `favicon_url` ao `initial` prop e ao state.

**Atualizar interface:**
```typescript
interface PerfilStudioFormProps {
  initial: {
    name: string
    slug: string
    custom_domain: string | null
    primary_color: string | null
    bio: string | null
    favicon_url: string | null
  }
}
```

**Adicionar estado:**
```typescript
  const [faviconUrl, setFaviconUrl] = useState(initial.favicon_url ?? '')
  const [faviconUploading, setFaviconUploading] = useState(false)
```

**Adicionar `favicon_url` ao body do PATCH:**
```typescript
        body: JSON.stringify({
          name,
          bio: bio || null,
          primary_color: primaryColor || null,
          custom_domain: customDomain || null,
          favicon_url: faviconUrl || null,
        }),
```

**Adicionar função de upload:**
```typescript
  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFaviconUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/tenant/favicon', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) setFaviconUrl(data.url)
      else alert('Erro: ' + (data.error ?? 'Falha no upload'))
    } catch {
      alert('Erro de conexão.')
    } finally {
      setFaviconUploading(false)
    }
  }
```

**Adicionar campo de favicon no formulário** (após o campo de Domínio personalizado, antes do botão submit):

```tsx
          {/* Favicon */}
          <div>
            <label className={labelClass}>Favicon do portal</label>
            {faviconUrl && (
              <div className="mb-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faviconUrl} alt="Favicon" className="w-8 h-8 object-contain border border-[var(--color-border)] rounded" />
                <span className="text-xs text-[var(--color-ink-muted)]">Favicon atual</span>
              </div>
            )}
            <div className="space-y-2">
              <div>
                <label className="text-xs text-[var(--color-ink-muted)] mb-1 block">Upload (PNG, ICO, SVG, JPG — máx. 512 KB)</label>
                <input
                  type="file"
                  accept=".png,.ico,.svg,.jpg,.jpeg"
                  onChange={handleFaviconUpload}
                  disabled={faviconUploading}
                  className="text-sm text-[var(--color-ink-soft)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[var(--color-surface-alt)] file:text-[var(--color-ink)] hover:file:opacity-80 disabled:opacity-50"
                />
                {faviconUploading && <p className="text-xs text-[var(--color-ink-muted)] mt-1">Fazendo upload…</p>}
              </div>
              <div>
                <label className="text-xs text-[var(--color-ink-muted)] mb-1 block">ou URL externa</label>
                <input
                  type="url"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="https://exemplo.com/favicon.ico"
                  className={inputClass}
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
              Ícone exibido na aba do navegador para visitantes do seu portal.
            </p>
          </div>
```

- [ ] **Step 2: Atualizar `perfil-studio/page.tsx`**

Ler o arquivo atual. Adicionar `favicon_url` ao select da query de tenant e ao `initial` passado para o form:

No `getTenantProfile()`, alterar o select para incluir `favicon_url`:
```typescript
    .select('name, slug, custom_domain, primary_color, bio, favicon_url')
```

E atualizar o tipo de retorno:
```typescript
  return tenant as {
    name: string
    slug: string
    custom_domain: string | null
    primary_color: string | null
    bio: string | null
    favicon_url: string | null
  }
```

E passar `favicon_url` ao `<PerfilStudioForm initial={tenant} />` (já é passado automaticamente se o tipo estiver correto).

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/dashboard/configuracoes/perfil-studio/"
git commit -m "feat: add favicon field to tenant perfil-studio form"
```

---

## Task 9: Verificação final

- [ ] **Step 1: Rodar todos os testes novos**

```bash
cd C:/Users/dougl/workspace5/fotosaas
npx jest __tests__/api/admin/platform-favicon.test.ts --no-coverage
```

Expected: 3/3 PASS

- [ ] **Step 2: Rodar suite completa de F2**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: todos os testes pré-existentes continuam passando

- [ ] **Step 3: TypeScript final**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 erros

- [ ] **Step 4: Verificar todos os novos/modificados**

```bash
ls src/lib/platform-config.ts
ls src/app/api/admin/platform/favicon/route.ts
ls src/app/api/tenant/favicon/route.ts
```

- [ ] **Step 5: Git log**

```bash
git log --oneline -12
```

- [ ] **Step 6: Aplicar migration na VPS**

```bash
scp supabase/migrations/0015_favicon_url_and_settings.sql root@2.25.150.248:/tmp/
ssh root@2.25.150.248 "docker exec fotosaas-db-1 psql -U postgres -d postgres -f /tmp/0015_favicon_url_and_settings.sql"
```

- [ ] **Step 7: Rebuild VPS**

```bash
ssh root@2.25.150.248 "cd /opt/fotosaas && docker compose -f docker-compose.prod.yml build app && docker compose -f docker-compose.prod.yml up -d app"
```

- [ ] **Step 8: Commit final**

```bash
git add .
git commit -m "feat: F2 complete — whitelabeling platform name and favicon"
```

---

## Checklist de spec coverage

| Requisito | Task |
|---|---|
| platform_name em system_settings | Tasks 1 + 3 |
| platform_favicon_url em system_settings | Tasks 1 + 3 |
| favicon_url em tenants | Task 1 |
| Bucket platform-assets (público) | Task 1 |
| getPlatformConfig() com cache | Task 2 |
| getTenantFavicon() | Task 2 |
| Admin settings API: novos campos + upsert | Task 3 |
| POST /api/admin/platform/favicon (upload + URL) | Task 4 |
| POST /api/tenant/favicon (upload + URL) | Task 5 |
| PATCH /api/tenant/profile aceita favicon_url | Task 5 |
| Root layout: generateMetadata com favicon dinâmico | Task 6 |
| Homepage: platformName dinâmico | Task 6 |
| Login page: platformName dinâmico | Task 6 |
| Admin layout: platformName dinâmico | Task 6 |
| /cadastro: platformName dinâmico | Task 6 |
| Tenant layout: generateMetadata com tenant favicon | Task 6 |
| Admin configuracoes form: seção Identidade da Plataforma | Task 7 |
| Tenant perfil-studio form: campo favicon | Task 8 |
