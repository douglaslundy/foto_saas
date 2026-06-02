# Portal Visual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar carrossel de banner configurável, rodapé customizável e imagem de capa por evento no portal público do fotógrafo.

**Architecture:** Três features independentes que estendem `tenants` (banner carrossel + rodapé) e `events` (capa). Cada uma tem: migration SQL → API route → dashboard UI → componente público. Não há dependência entre elas — podem ser feitas em qualquer ordem.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase PostgREST, Tailwind CSS com variáveis CSS customizadas do FotoSaaS.

---

## Contexto do codebase

- **Design system:** todas as classes usam `var(--color-ink)`, `var(--color-card)`, `var(--color-cta)`, etc. — NUNCA usar `text-gray-*` ou `bg-white` direto.
- **Botões primários:** `bg-[var(--color-cta)] text-[var(--color-cta-fg)]`
- **Admin client:** sempre usar `createAdminClient()` de `@/lib/supabase/admin` para queries server-side; `createClient()` de `@/lib/supabase/server` para verificar sessão.
- **Padrão de API:** retornar `NextResponse.json({ error })` com status apropriado; nunca lançar exceção não capturada.
- **Migration:** próximo número é `0007`. Arquivos vão em `supabase/migrations/` E em `docker/db/` (o docker usa os de `docker/db/`).
- **Storage:** bucket `photos-public` em Supabase Storage. Path padrão: `banners/{tenant_id}/arquivo.jpg`.

---

## Arquivos criados / modificados

### Task 1 — Banner Carrossel
| Ação | Arquivo |
|---|---|
| Criar | `supabase/migrations/0007_banner_carousel.sql` |
| Criar | `docker/db/04-banner-carousel.sql` |
| Criar | `src/app/api/tenant/banners/route.ts` |
| Criar | `src/app/api/tenant/banners/[id]/route.ts` |
| Modificar | `src/app/(dashboard)/dashboard/configuracoes/site/page.tsx` |
| Modificar | `src/app/(dashboard)/dashboard/configuracoes/site/_components/site-form.tsx` |
| Criar | `src/app/(dashboard)/dashboard/configuracoes/site/_components/banner-manager.tsx` |
| Criar | `src/components/portal/carousel-banner.tsx` |
| Modificar | `src/app/[tenant]/page.tsx` |

### Task 2 — Rodapé Configurável
| Ação | Arquivo |
|---|---|
| Criar | `supabase/migrations/0008_tenant_footer.sql` |
| Criar | `docker/db/05-tenant-footer.sql` |
| Modificar | `src/app/api/tenant/site/route.ts` |
| Modificar | `src/app/(dashboard)/dashboard/configuracoes/site/_components/site-form.tsx` |
| Criar | `src/components/portal/tenant-footer.tsx` |
| Modificar | `src/app/[tenant]/layout.tsx` |

### Task 3 — Imagem de Capa por Evento
| Ação | Arquivo |
|---|---|
| Criar | `supabase/migrations/0009_event_cover.sql` |
| Criar | `docker/db/06-event-cover.sql` |
| Modificar | `src/app/api/events/route.ts` (POST) |
| Modificar | `src/app/api/events/[id]/route.ts` (PATCH) |
| Modificar | `src/components/events/event-form.tsx` |
| Modificar | `src/components/events/event-card.tsx` |
| Modificar | `src/app/[tenant]/_components/events-search-grid.tsx` |

---

## Task 1: Banner Carrossel

**Files:**
- Create: `supabase/migrations/0007_banner_carousel.sql`
- Create: `docker/db/04-banner-carousel.sql`
- Create: `src/app/api/tenant/banners/route.ts`
- Create: `src/app/api/tenant/banners/[id]/route.ts`
- Create: `src/app/(dashboard)/dashboard/configuracoes/site/_components/banner-manager.tsx`
- Modify: `src/app/(dashboard)/dashboard/configuracoes/site/page.tsx`
- Create: `src/components/portal/carousel-banner.tsx`
- Modify: `src/app/[tenant]/page.tsx`

- [ ] **Step 1.1: Migration SQL**

Conteúdo idêntico para `supabase/migrations/0007_banner_carousel.sql` e `docker/db/04-banner-carousel.sql`:

```sql
-- Tabela de imagens do carrossel por tenant
CREATE TABLE IF NOT EXISTS public.banner_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  title        TEXT,
  subtitle     TEXT,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS banner_images_tenant_id_idx ON public.banner_images (tenant_id);

-- Adicionar coluna para modo banner nos tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS banner_mode TEXT NOT NULL DEFAULT 'static';
-- 'static' = usa banner_image_path existente, 'carousel' = usa tabela banner_images

GRANT ALL ON public.banner_images TO anon, authenticated, service_role;
```

- [ ] **Step 1.2: API GET/POST de banners**

Criar `src/app/api/tenant/banners/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile?.tenant_id) return null
  return profile as { tenant_id: string; role: string }
}

const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

export async function GET() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: banners } = await (admin as any)
    .from('banner_images')
    .select('id, storage_path, title, subtitle, sort_order, active')
    .eq('tenant_id', profile.tenant_id)
    .order('sort_order', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants')
    .select('banner_mode')
    .eq('id', profile.tenant_id)
    .single()

  const items = (banners ?? []).map((b: { id: string; storage_path: string; title: string | null; subtitle: string | null; sort_order: number; active: boolean }) => ({
    ...b,
    url: `${STORAGE_URL}/${b.storage_path}`,
  }))

  return NextResponse.json({ banners: items, banner_mode: tenant?.banner_mode ?? 'static' })
}

export async function POST(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('image')
  const title = formData.get('title') as string | null
  const subtitle = formData.get('subtitle') as string | null

  if (!file || !(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Imagem obrigatória.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (admin as any)
    .from('banner_images')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)

  const sortOrder = (count ?? 0) as number
  const ext = file.type.includes('png') ? 'png' : 'jpg'
  const storagePath = `banners/${profile.tenant_id}/carousel_${Date.now()}.${ext}`

  const buffer = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage
    .from('photos-public')
    .upload(storagePath, buffer, { contentType: file.type || 'image/jpeg', upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: banner, error } = await (admin as any)
    .from('banner_images')
    .insert({ tenant_id: profile.tenant_id, storage_path: storagePath, title, subtitle, sort_order: sortOrder })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ banner }, { status: 201 })
}
```

- [ ] **Step 1.3: API PATCH/DELETE de banner individual**

Criar `src/app/api/tenant/banners/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Props = { params: Promise<{ id: string }> }

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: p } = await (admin as any)
    .from('users').select('tenant_id').eq('id', user.id).single()
  return p as { tenant_id: string } | null
}

// PATCH: toggle active or update sort_order or banner_mode
export async function PATCH(request: NextRequest, { params }: Props) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json() as { active?: boolean; sort_order?: number; banner_mode?: string }
  const admin = createAdminClient()

  // banner_mode update targets tenants table, not banner_images
  if (typeof body.banner_mode === 'string') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('tenants').update({ banner_mode: body.banner_mode }).eq('id', profile.tenant_id)
    return NextResponse.json({ ok: true })
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.active === 'boolean') updates.active = body.active
  if (typeof body.sort_order === 'number') updates.sort_order = body.sort_order

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('banner_images')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()

  // Get storage path before delete to clean up storage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: banner } = await (admin as any)
    .from('banner_images')
    .select('storage_path')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (banner?.storage_path) {
    await admin.storage.from('photos-public').remove([banner.storage_path])
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('banner_images')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 1.4: Componente BannerManager no dashboard**

Criar `src/app/(dashboard)/dashboard/configuracoes/site/_components/banner-manager.tsx`:

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type BannerItem = {
  id: string
  url: string
  title: string | null
  subtitle: string | null
  sort_order: number
  active: boolean
}

interface BannerManagerProps {
  tenantId: string
  initialMode: 'static' | 'carousel'
}

export function BannerManager({ initialMode }: BannerManagerProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'static' | 'carousel'>(initialMode)
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const inputClass = 'h-10 px-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent'

  useEffect(() => {
    fetch('/api/tenant/banners')
      .then((r) => r.json())
      .then(({ banners: b, banner_mode }) => {
        setBanners(b ?? [])
        setMode(banner_mode ?? 'static')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleModeChange(newMode: 'static' | 'carousel') {
    setMode(newMode)
    await fetch('/api/tenant/banners/mode', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banner_mode: newMode }),
    })
    router.refresh()
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('image', file)
    if (title) formData.append('title', title)
    if (subtitle) formData.append('subtitle', subtitle)
    const res = await fetch('/api/tenant/banners', { method: 'POST', body: formData })
    if (res.ok) {
      const { banner } = await res.json() as { banner: BannerItem & { storage_path: string } }
      // Reconstruct URL from NEXT_PUBLIC_SUPABASE_URL
      const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`
      setBanners((prev) => [...prev, { ...banner, url: `${storageBase}/${(banner as { storage_path: string }).storage_path}` }])
      setTitle('')
      setSubtitle('')
      if (fileRef.current) fileRef.current.value = ''
    }
    setUploading(false)
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/tenant/banners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    setBanners((prev) => prev.map((b) => b.id === id ? { ...b, active } : b))
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta imagem do carrossel?')) return
    await fetch(`/api/tenant/banners/${id}`, { method: 'DELETE' })
    setBanners((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>Modo do Banner</h2>
        </div>
        <div className="px-6 py-5 flex gap-4">
          {(['static', 'carousel'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`flex-1 py-3 rounded-[var(--radius-sm)] border text-sm font-semibold transition-all ${
                mode === m
                  ? 'bg-[var(--color-cta)] text-[var(--color-cta-fg)] border-transparent'
                  : 'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-border-strong)] hover:border-[var(--color-gold)]'
              }`}
            >
              {m === 'static' ? '🖼 Estático (1 imagem)' : '🎠 Carrossel (múltiplas imagens)'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'carousel' && (
        <>
          {/* Upload form */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
              <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>Adicionar Imagem</h2>
            </div>
            <form onSubmit={handleUpload} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Imagem</label>
                <input ref={fileRef} type="file" accept="image/*" required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Título (opcional)</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Ex: Casamento Silva & Costa" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Subtítulo (opcional)</label>
                <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputClass} placeholder="Ex: 15 de março de 2025" />
              </div>
              <button type="submit" disabled={uploading} className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold disabled:opacity-50">
                {uploading ? 'Enviando...' : '+ Adicionar ao carrossel'}
              </button>
            </form>
          </div>

          {/* List */}
          {!loading && banners.length > 0 && (
            <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
                <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>Imagens do Carrossel</h2>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {banners.map((b) => (
                  <div key={b.id} className="px-6 py-4 flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-20 h-14 rounded-[var(--radius-sm)] overflow-hidden bg-[var(--color-surface-alt)] shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.url} alt={b.title ?? ''} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{b.title ?? 'Sem título'}</p>
                      {b.subtitle && <p className="text-xs text-[var(--color-ink-muted)] truncate">{b.subtitle}</p>}
                    </div>
                    {/* Toggle active */}
                    <button
                      onClick={() => toggleActive(b.id, !b.active)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                        b.active
                          ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                          : 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)]'
                      }`}
                    >
                      {b.active ? 'Ativa' : 'Inativa'}
                    </button>
                    <button onClick={() => handleDelete(b.id)} className="text-[var(--color-danger)] text-xs hover:underline ml-2">Remover</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 1.5: Adicionar BannerManager à página de configurações do site**

Modificar `src/app/(dashboard)/dashboard/configuracoes/site/page.tsx` — adicionar import e renderizar `BannerManager` acima do `SiteForm`:

Ler o arquivo atual, depois adicionar:
```typescript
// Depois dos imports existentes:
import { BannerManager } from './_components/banner-manager'

// Na query, buscar também banner_mode do tenant:
const { data: tenant } = await adminClient.from('tenants').select('id, banner_mode, banner_image_path, banner_title, banner_subtitle, banner_cta_text, banner_cta_url').eq('id', profile.tenant_id).single()

// No JSX, antes do SiteForm:
<BannerManager tenantId={tenantData.id} initialMode={(tenant?.banner_mode ?? 'static') as 'static' | 'carousel'} />
```

- [ ] **Step 1.6: Adicionar rota PATCH para banner_mode (via banners/mode endpoint)**

Adicionar ao final do `src/app/api/tenant/banners/route.ts` um handler alternativo ou criar `src/app/api/tenant/banners/mode/route.ts`:

```typescript
// src/app/api/tenant/banners/mode/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any).from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json() as { banner_mode: string }
  if (!['static', 'carousel'].includes(body.banner_mode)) {
    return NextResponse.json({ error: 'Modo inválido.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('tenants').update({ banner_mode: body.banner_mode }).eq('id', profile.tenant_id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 1.7: Componente CarouselBanner no portal público**

Criar `src/components/portal/carousel-banner.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'

export type CarouselSlide = {
  id: string
  url: string
  title: string | null
  subtitle: string | null
}

interface CarouselBannerProps {
  slides: CarouselSlide[]
  className?: string
}

export function CarouselBanner({ slides, className = '' }: CarouselBannerProps) {
  const [current, setCurrent] = useState(0)
  const active = slides.filter((s) => s)

  const next = useCallback(() => setCurrent((c) => (c + 1) % active.length), [active.length])
  const prev = () => setCurrent((c) => (c - 1 + active.length) % active.length)

  useEffect(() => {
    if (active.length <= 1) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [active.length, next])

  if (active.length === 0) return null

  const slide = active[current]

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Images */}
      {active.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0'}`}
          style={{ backgroundImage: `url(${s.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          aria-hidden={i !== current}
        />
      ))}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

      {/* Text */}
      {(slide.title || slide.subtitle) && (
        <div className="absolute bottom-8 left-8 right-8 text-white">
          {slide.title && <p className="font-display text-2xl font-bold drop-shadow">{slide.title}</p>}
          {slide.subtitle && <p className="text-sm mt-1 opacity-80 drop-shadow">{slide.subtitle}</p>}
        </div>
      )}

      {/* Navigation arrows */}
      {active.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors"
            aria-label="Anterior"
          >‹</button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors"
            aria-label="Próximo"
          >›</button>
          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {active.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white w-4' : 'bg-white/50'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 1.8: Usar CarouselBanner em `[tenant]/page.tsx`**

Ler `src/app/[tenant]/page.tsx` e substituir o bloco de hero section para suportar modo carrossel.

Na query do tenant, buscar também `banner_mode`. Se `banner_mode === 'carousel'`, buscar `banner_images` ativas e renderizar `CarouselBanner`. Caso contrário, manter o banner estático atual.

```typescript
// Adicionar nas imports:
import { CarouselBanner, type CarouselSlide } from '@/components/portal/carousel-banner'

// Na query:
const tenantData = tenant as {
  id: string; slug: string; name: string; bio: string | null;
  banner_mode: string;
  banner_image_path: string | null;
  banner_title: string | null; banner_subtitle: string | null;
}

// Se carousel mode, buscar banner_images:
let carouselSlides: CarouselSlide[] = []
if (tenantData.banner_mode === 'carousel') {
  const { data: bImgs } = await (adminClient as any)
    .from('banner_images')
    .select('id, storage_path, title, subtitle')
    .eq('tenant_id', tenantData.id)
    .eq('active', true)
    .order('sort_order', { ascending: true })
  carouselSlides = (bImgs ?? []).map((b: { id: string; storage_path: string; title: string | null; subtitle: string | null }) => ({
    id: b.id,
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public/${b.storage_path}`,
    title: b.title,
    subtitle: b.subtitle,
  }))
}

// No JSX da hero section — substituir o bloco de background:
{tenantData.banner_mode === 'carousel' && carouselSlides.length > 0 ? (
  <CarouselBanner slides={carouselSlides} className="absolute inset-0" />
) : tenantData.banner_image_path ? (
  <div className="absolute inset-0" style={{ backgroundImage: `url(${STORAGE_URL}/${tenantData.banner_image_path})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
) : (
  <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)] via-[var(--color-ink-soft)] to-[var(--color-ink)]" />
)}
```

- [ ] **Step 1.9: Commit**

```bash
git add supabase/migrations/0007_banner_carousel.sql docker/db/04-banner-carousel.sql \
  src/app/api/tenant/banners/ \
  src/app/(dashboard)/dashboard/configuracoes/site/_components/banner-manager.tsx \
  src/components/portal/carousel-banner.tsx \
  src/app/\[tenant\]/page.tsx
git commit -m "feat: carrossel de banner configurável no portal público"
```

---

## Task 2: Rodapé Configurável

**Files:**
- Create: `supabase/migrations/0008_tenant_footer.sql`
- Create: `docker/db/05-tenant-footer.sql`
- Modify: `src/app/api/tenant/site/route.ts`
- Modify: `src/app/(dashboard)/dashboard/configuracoes/site/_components/site-form.tsx`
- Create: `src/components/portal/tenant-footer.tsx`
- Modify: `src/app/[tenant]/layout.tsx`

- [ ] **Step 2.1: Migration**

`supabase/migrations/0008_tenant_footer.sql` e `docker/db/05-tenant-footer.sql` (idênticos):

```sql
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS footer_text        TEXT,
  ADD COLUMN IF NOT EXISTS footer_address     TEXT,
  ADD COLUMN IF NOT EXISTS footer_phone       TEXT,
  ADD COLUMN IF NOT EXISTS footer_whatsapp    TEXT,
  ADD COLUMN IF NOT EXISTS footer_instagram   TEXT,
  ADD COLUMN IF NOT EXISTS footer_facebook    TEXT,
  ADD COLUMN IF NOT EXISTS footer_email       TEXT;
```

- [ ] **Step 2.2: Atualizar API `tenant/site`**

Em `src/app/api/tenant/site/route.ts`, no GET adicionar os campos footer ao `.select()`:

```typescript
.select('banner_image_path, banner_title, banner_subtitle, banner_cta_text, banner_cta_url, footer_text, footer_address, footer_phone, footer_whatsapp, footer_instagram, footer_facebook, footer_email')
```

No PUT, adicionar leitura dos campos footer do `formData`:
```typescript
const footerFields = ['footer_text', 'footer_address', 'footer_phone', 'footer_whatsapp', 'footer_instagram', 'footer_facebook', 'footer_email'] as const
for (const field of footerFields) {
  const val = formData.get(field)
  if (typeof val === 'string') updates[field] = val
}
```

No select final após update, incluir os novos campos também.

- [ ] **Step 2.3: Seção de rodapé no site-form.tsx**

Ler `src/app/(dashboard)/dashboard/configuracoes/site/_components/site-form.tsx`.

Adicionar ao interface `BannerConfig`:
```typescript
footer_text: string
footer_address: string
footer_phone: string
footer_whatsapp: string
footer_instagram: string
footer_facebook: string
footer_email: string
```

Adicionar states para cada campo (similar ao bannerTitle):
```typescript
const [footerText, setFooterText] = useState(initial.footer_text ?? '')
const [footerAddress, setFooterAddress] = useState(initial.footer_address ?? '')
const [footerPhone, setFooterPhone] = useState(initial.footer_phone ?? '')
const [footerWhatsapp, setFooterWhatsapp] = useState(initial.footer_whatsapp ?? '')
const [footerInstagram, setFooterInstagram] = useState(initial.footer_instagram ?? '')
const [footerFacebook, setFooterFacebook] = useState(initial.footer_facebook ?? '')
const [footerEmail, setFooterEmail] = useState(initial.footer_email ?? '')
```

No `handleSubmit`, adicionar ao `formData.append`:
```typescript
formData.append('footer_text', footerText)
formData.append('footer_address', footerAddress)
formData.append('footer_phone', footerPhone)
formData.append('footer_whatsapp', footerWhatsapp)
formData.append('footer_instagram', footerInstagram)
formData.append('footer_facebook', footerFacebook)
formData.append('footer_email', footerEmail)
```

Adicionar no JSX uma seção "Rodapé" com os inputs (usar o mesmo `inputClass` já definido no arquivo):
```tsx
{/* Seção Rodapé */}
<div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
  <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
    <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>Rodapé do Site</h2>
  </div>
  <div className="px-6 py-5 space-y-4">
    <div>
      <label className={labelClass}>Texto do rodapé</label>
      <textarea value={footerText} onChange={(e) => setFooterText(e.target.value)} rows={3}
        className={inputClass + ' h-auto py-2 resize-none'} placeholder="Breve texto sobre seu trabalho..." />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div><label className={labelClass}>Endereço</label><input type="text" value={footerAddress} onChange={(e) => setFooterAddress(e.target.value)} className={inputClass} placeholder="Cidade, Estado" /></div>
      <div><label className={labelClass}>Telefone</label><input type="tel" value={footerPhone} onChange={(e) => setFooterPhone(e.target.value)} className={inputClass} placeholder="(11) 99999-9999" /></div>
      <div><label className={labelClass}>WhatsApp</label><input type="tel" value={footerWhatsapp} onChange={(e) => setFooterWhatsapp(e.target.value)} className={inputClass} placeholder="(11) 99999-9999" /></div>
      <div><label className={labelClass}>E-mail de contato</label><input type="email" value={footerEmail} onChange={(e) => setFooterEmail(e.target.value)} className={inputClass} placeholder="contato@seusite.com" /></div>
      <div><label className={labelClass}>Instagram</label><input type="text" value={footerInstagram} onChange={(e) => setFooterInstagram(e.target.value)} className={inputClass} placeholder="@seuusuario" /></div>
      <div><label className={labelClass}>Facebook</label><input type="text" value={footerFacebook} onChange={(e) => setFooterFacebook(e.target.value)} className={inputClass} placeholder="facebook.com/suapagina" /></div>
    </div>
  </div>
</div>
```

- [ ] **Step 2.4: Componente TenantFooter**

Criar `src/components/portal/tenant-footer.tsx`:

```typescript
interface FooterData {
  footer_text?: string | null
  footer_address?: string | null
  footer_phone?: string | null
  footer_whatsapp?: string | null
  footer_instagram?: string | null
  footer_facebook?: string | null
  footer_email?: string | null
  name: string
}

export function TenantFooter({ data }: { data: FooterData }) {
  const hasContent = data.footer_text || data.footer_address || data.footer_phone ||
    data.footer_whatsapp || data.footer_instagram || data.footer_facebook || data.footer_email

  if (!hasContent) return null

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-card)] mt-16">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <p className="font-display text-lg font-bold text-[var(--color-ink)] mb-3">{data.name}</p>
            {data.footer_text && (
              <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">{data.footer_text}</p>
            )}
          </div>

          {/* Contato */}
          {(data.footer_address || data.footer_phone || data.footer_whatsapp || data.footer_email) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-3">Contato</p>
              <ul className="space-y-2 text-sm text-[var(--color-ink-muted)]">
                {data.footer_address && <li>📍 {data.footer_address}</li>}
                {data.footer_phone && <li>📞 {data.footer_phone}</li>}
                {data.footer_whatsapp && (
                  <li>
                    <a href={`https://wa.me/${data.footer_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-gold)] transition-colors">
                      💬 WhatsApp
                    </a>
                  </li>
                )}
                {data.footer_email && (
                  <li><a href={`mailto:${data.footer_email}`} className="hover:text-[var(--color-gold)] transition-colors">{data.footer_email}</a></li>
                )}
              </ul>
            </div>
          )}

          {/* Redes sociais */}
          {(data.footer_instagram || data.footer_facebook) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-3">Redes Sociais</p>
              <ul className="space-y-2 text-sm">
                {data.footer_instagram && (
                  <li>
                    <a href={data.footer_instagram.startsWith('http') ? data.footer_instagram : `https://instagram.com/${data.footer_instagram.replace('@','')}`}
                      target="_blank" rel="noopener noreferrer" className="text-[var(--color-ink-muted)] hover:text-[var(--color-gold)] transition-colors">
                      Instagram {data.footer_instagram}
                    </a>
                  </li>
                )}
                {data.footer_facebook && (
                  <li>
                    <a href={data.footer_facebook.startsWith('http') ? data.footer_facebook : `https://facebook.com/${data.footer_facebook}`}
                      target="_blank" rel="noopener noreferrer" className="text-[var(--color-ink-muted)] hover:text-[var(--color-gold)] transition-colors">
                      Facebook
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--color-border)] text-center text-xs text-[var(--color-ink-muted)]">
          © {new Date().getFullYear()} {data.name}. Desenvolvido com FotoSaaS.
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2.5: Incluir TenantFooter no layout do tenant**

Em `src/app/[tenant]/layout.tsx`, buscar os campos de rodapé e renderizar o footer:

```typescript
// Adicionar ao select:
.select('id, name, slug, status, logo_storage_path, footer_text, footer_address, footer_phone, footer_whatsapp, footer_instagram, footer_facebook, footer_email')

// Import:
import { TenantFooter } from '@/components/portal/tenant-footer'

// No JSX, após </main>:
<TenantFooter data={{ ...tenantRecord }} />
```

- [ ] **Step 2.6: Commit**

```bash
git add supabase/migrations/0008_tenant_footer.sql docker/db/05-tenant-footer.sql \
  src/app/api/tenant/site/route.ts \
  src/app/(dashboard)/dashboard/configuracoes/site/_components/site-form.tsx \
  src/components/portal/tenant-footer.tsx \
  src/app/\[tenant\]/layout.tsx
git commit -m "feat: rodapé configurável no portal público do fotógrafo"
```

---

## Task 3: Imagem de Capa por Evento/Ensaio

**Files:**
- Create: `supabase/migrations/0009_event_cover.sql`
- Create: `docker/db/06-event-cover.sql`
- Modify: `src/app/api/events/route.ts`
- Modify: `src/app/api/events/[id]/route.ts`
- Modify: `src/components/events/event-form.tsx`
- Modify: `src/components/events/event-card.tsx`

- [ ] **Step 3.1: Migration**

`supabase/migrations/0009_event_cover.sql` e `docker/db/06-event-cover.sql`:

```sql
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_image_path TEXT;
```

- [ ] **Step 3.2: Upload de capa na API de criação de evento**

Em `src/app/api/events/route.ts` (POST handler), após criar o evento no banco, verificar se há `cover_image` no formData e fazer upload:

O handler atual recebe `request.json()`. Deve ser alterado para `request.formData()` OU manter JSON e adicionar um endpoint separado `/api/events/[id]/cover`.

**Opção mais simples:** criar `src/app/api/events/[id]/cover/route.ts` com um PUT para upload da capa separadamente (evita mudar a interface JSON existente):

```typescript
// src/app/api/events/[id]/cover/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Props = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any).from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('cover_image')
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Imagem obrigatória.' }, { status: 400 })
  }

  const ext = file.type.includes('png') ? 'png' : 'jpg'
  const storagePath = `covers/${profile.tenant_id}/${id}.${ext}`
  const buffer = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('photos-public')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('events')
    .update({ cover_image_path: storagePath })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public/${storagePath}`
  return NextResponse.json({ cover_image_path: storagePath, url })
}
```

- [ ] **Step 3.3: Campo de capa no event-form.tsx**

Ler `src/components/events/event-form.tsx` e adicionar:

1. Estado: `const [coverFile, setCoverFile] = useState<File | null>(null)` e `const [coverPreview, setCoverPreview] = useState<string | null>(initialCoverUrl ?? null)`
2. Input de arquivo para a capa (antes do botão de submit)
3. Após criar/editar o evento com sucesso, se `coverFile` existir, fazer um segundo `fetch` para `PUT /api/events/${eventId}/cover` com `FormData`

```tsx
{/* Campo de capa no form */}
<div>
  <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">
    Imagem de Capa
  </label>
  {coverPreview && (
    <div className="mb-2 rounded-[var(--radius-sm)] overflow-hidden h-32 bg-[var(--color-surface-alt)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
    </div>
  )}
  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const f = e.target.files?.[0]
      if (f) {
        setCoverFile(f)
        setCoverPreview(URL.createObjectURL(f))
      }
    }}
    className="w-full text-sm text-[var(--color-ink-muted)] file:mr-3 file:py-2 file:px-4 file:rounded-[var(--radius-sm)] file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-surface-alt)] file:text-[var(--color-ink)] hover:file:bg-[var(--color-surface)]"
  />
  <p className="text-xs text-[var(--color-ink-muted)] mt-1">Recomendado: 1200×600px (JPG ou PNG)</p>
</div>
```

No handleSubmit, após o evento ser criado/editado com sucesso:
```typescript
if (coverFile && eventId) {
  const coverFormData = new FormData()
  coverFormData.append('cover_image', coverFile)
  await fetch(`/api/events/${eventId}/cover`, { method: 'PUT', body: coverFormData })
}
```

- [ ] **Step 3.4: Exibir capa no EventCard**

Ler `src/components/events/event-card.tsx` e adicionar `cover_image_path` ao tipo e exibir como fundo do card.

O `EventCard` atual provavelmente exibe um card sem imagem. Adicionar:
```typescript
// No tipo Event:
cover_image_path?: string | null

// No JSX, usar cover_image_path como background do topo do card:
const STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`
const coverUrl = event.cover_image_path ? `${STORAGE}/${event.cover_image_path}` : null
```

Adicionar uma área de imagem no topo do card:
```tsx
{/* Topo do card com imagem ou gradiente */}
<div className="h-32 rounded-t-[var(--radius)] overflow-hidden bg-gradient-to-br from-[var(--color-surface-alt)] to-[var(--color-border)]">
  {coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={coverUrl} alt={event.title} className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">
      {event.type === 'event' ? '📅' : '📷'}
    </div>
  )}
</div>
```

- [ ] **Step 3.5: Passar `cover_image_path` nas queries que buscam eventos**

Verificar e atualizar os selects de eventos nas páginas que renderizam `EventCard`:
- `src/app/(dashboard)/dashboard/eventos/page.tsx`: adicionar `cover_image_path` ao select
- `src/app/[tenant]/page.tsx`: adicionar `cover_image_path` ao select
- `src/app/[tenant]/_components/events-search-grid.tsx`: adaptar o tipo `Event`

- [ ] **Step 3.6: Commit**

```bash
git add supabase/migrations/0009_event_cover.sql docker/db/06-event-cover.sql \
  src/app/api/events/\[id\]/cover/ \
  src/components/events/event-form.tsx \
  src/components/events/event-card.tsx \
  src/app/\[tenant\]/page.tsx \
  src/app/\[tenant\]/_components/events-search-grid.tsx \
  src/app/\(dashboard\)/dashboard/eventos/page.tsx
git commit -m "feat: imagem de capa configurável por evento/ensaio"
```

---

## Deploy das Migrações na VPS

Após implementar as 3 tasks, aplicar as migrações no banco de produção via SSH:

```bash
# Conectar à VPS
ssh root@2.25.150.248

# Aplicar migrações
docker exec -i fotosaas-db psql -U postgres -d postgres < /opt/fotosaas/docker/db/04-banner-carousel.sql
docker exec -i fotosaas-db psql -U postgres -d postgres < /opt/fotosaas/docker/db/05-tenant-footer.sql
docker exec -i fotosaas-db psql -U postgres -d postgres < /opt/fotosaas/docker/db/06-event-cover.sql

# Rebuild e restart do app
cd /opt/fotosaas
docker compose -f docker-compose.prod.yml build nextjs
docker compose -f docker-compose.prod.yml up -d nextjs
```
