# Additional Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add QR Code sharing for events, a fullscreen slideshow page for events, and a basic LGPD/GDPR cookie consent banner.

**Architecture:** QR codes are generated server-side using the `qrcode` library and rendered as base64 data URIs. Slideshow is a client component auto-advancing through event photos. Cookie consent is a simple client component that sets a cookie and hides itself.

**Tech Stack:** qrcode (npm), Next.js Client Components, existing shadcn/ui.

---

## File Map

**New files:**
- `src/lib/qrcode.ts` — QR code generation helper
- `src/app/[tenant]/evento/[slug]/qr/page.tsx` — QR code page for an event
- `src/app/[tenant]/evento/[slug]/slideshow/page.tsx` — slideshow page
- `src/app/[tenant]/evento/[slug]/slideshow/_components/slideshow-player.tsx` — client slideshow component
- `src/components/ui/cookie-consent.tsx` — LGPD cookie banner
- `src/app/[tenant]/layout.tsx` — add CookieConsent to layout

---

## Task 1: Install qrcode

- [ ] **Step 1.1: Install qrcode and types**

```powershell
npm install qrcode @types/qrcode
```

- [ ] **Step 1.2: Commit**

```powershell
git add package.json package-lock.json
git commit -m "feat(additional): install qrcode"
```

---

## Task 2: QR Code Helper + Event QR Page

**Files:**
- Create: `src/lib/qrcode.ts`
- Create: `src/app/[tenant]/evento/[slug]/qr/page.tsx`

- [ ] **Step 2.1: Create qrcode helper**

Create `src/lib/qrcode.ts`:

```typescript
import QRCode from 'qrcode'

export async function generateQRCodeDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
  })
}
```

- [ ] **Step 2.2: Create QR page for event**

Create `src/app/[tenant]/evento/[slug]/qr/page.tsx`:

```tsx
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { generateQRCodeDataURL } from '@/lib/qrcode'

type Props = { params: Promise<{ tenant: string; slug: string }> }

export default async function EventoQRPage({ params }: Props) {
  const { tenant, slug } = await params
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow } = await (adminClient as any)
    .from('tenants')
    .select('id, name')
    .eq('slug', tenant)
    .single()

  if (!tenantRow) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (adminClient as any)
    .from('events')
    .select('id, title, status')
    .eq('slug', slug)
    .eq('tenant_id', tenantRow.id)
    .eq('type', 'event')
    .single()

  if (!event || event.status !== 'published') notFound()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const eventUrl = `${appUrl}/${tenant}/evento/${slug}`
  const qrDataUrl = await generateQRCodeDataURL(eventUrl)

  return (
    <div className="p-6 max-w-sm mx-auto text-center space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">QR Code para compartilhar</p>
      </div>

      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt={`QR Code — ${event.title}`} className="border rounded" />
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground break-all">{eventUrl}</p>
        <a
          href={qrDataUrl}
          download={`qrcode-${slug}.png`}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium"
        >
          Baixar QR Code
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2.3: Commit**

```powershell
git add src/lib/qrcode.ts "src/app/[tenant]/evento/[slug]/qr/"
git commit -m "feat(additional): QR code page for events"
```

---

## Task 3: Slideshow Page

**Files:**
- Create: `src/app/[tenant]/evento/[slug]/slideshow/_components/slideshow-player.tsx`
- Create: `src/app/[tenant]/evento/[slug]/slideshow/page.tsx`

- [ ] **Step 3.1: Create SlideshowPlayer client component**

Create `src/app/[tenant]/evento/[slug]/slideshow/_components/slideshow-player.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Photo = { id: string; public_storage_path: string }

interface SlideshowPlayerProps {
  photos: Photo[]
  intervalMs?: number
}

export function SlideshowPlayer({ photos, intervalMs = 4000 }: SlideshowPlayerProps) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % photos.length)
  }, [photos.length])

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + photos.length) % photos.length)
  }, [photos.length])

  useEffect(() => {
    if (!playing || photos.length === 0) return
    const timer = setInterval(next, intervalMs)
    return () => clearInterval(timer)
  }, [playing, next, intervalMs, photos.length])

  if (photos.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-20">
        Nenhuma foto disponível para o slideshow.
      </p>
    )
  }

  const current = photos[index]

  return (
    <div className="relative bg-black min-h-screen flex items-center justify-center">
      {/* Photo */}
      <div className="w-full h-screen flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={current.public_storage_path}
          alt=""
          className="max-w-full max-h-screen object-contain"
          draggable="false"
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={prev}
          className="bg-black/60 border-white/20 text-white hover:bg-black/80"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPlaying((p) => !p)}
          className="bg-black/60 border-white/20 text-white hover:bg-black/80"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={next}
          className="bg-black/60 border-white/20 text-white hover:bg-black/80"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-white/60 text-sm">
          {index + 1} / {photos.length}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2: Create slideshow page**

Create `src/app/[tenant]/evento/[slug]/slideshow/page.tsx`:

```tsx
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { SlideshowPlayer } from './_components/slideshow-player'

type Props = { params: Promise<{ tenant: string; slug: string }> }

type Photo = { id: string; public_storage_path: string }

export default async function SlideshowPage({ params }: Props) {
  const { tenant, slug } = await params
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow } = await (adminClient as any)
    .from('tenants')
    .select('id')
    .eq('slug', tenant)
    .single()

  if (!tenantRow) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (adminClient as any)
    .from('events')
    .select('id, title, status')
    .eq('slug', slug)
    .eq('tenant_id', tenantRow.id)
    .single()

  if (!event || event.status !== 'published') notFound()

  // Fetch photos (up to 200 for slideshow)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos } = (await (adminClient as any)
    .from('photos')
    .select('id, public_storage_path')
    .eq('event_id', event.id)
    .eq('status', 'ready')
    .not('public_storage_path', 'is', null)
    .order('created_at', { ascending: true })
    .limit(200)) as { data: Photo[] | null }

  return <SlideshowPlayer photos={photos ?? []} />
}
```

- [ ] **Step 3.3: Commit**

```powershell
git add "src/app/[tenant]/evento/[slug]/slideshow/"
git commit -m "feat(additional): fullscreen slideshow page for events"
```

---

## Task 4: Cookie Consent Banner (LGPD)

**Files:**
- Create: `src/components/ui/cookie-consent.tsx`
- Modify: `src/app/[tenant]/layout.tsx`

- [ ] **Step 4.1: Create CookieConsent component**

Create `src/components/ui/cookie-consent.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

const CONSENT_KEY = 'fotosaas_cookie_consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY)
    if (!consent) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          Usamos cookies essenciais para o funcionamento do site e cookies de sessão para o carrinho
          de compras. Ao continuar, você concorda com nossa{' '}
          <a href="/privacidade" className="underline">
            Política de Privacidade
          </a>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={decline}>
            Recusar
          </Button>
          <Button size="sm" onClick={accept}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4.2: Add CookieConsent to tenant layout**

In `src/app/[tenant]/layout.tsx`, import and add `<CookieConsent />` before closing `</div>`:

```tsx
import { CookieConsent } from '@/components/ui/cookie-consent'

// Inside return, before closing </div>:
<CookieConsent />
```

- [ ] **Step 4.3: Commit**

```powershell
git add src/components/ui/cookie-consent.tsx "src/app/[tenant]/layout.tsx"
git commit -m "feat(additional): LGPD cookie consent banner"
```

---

## Task 5: Add QR Code link to dashboard event pages

- [ ] **Step 5.1: Add QR Code link to event detail**

In `src/app/(dashboard)/dashboard/eventos/page.tsx`, check if there's an events list and add a QR code link. The link format is `/{tenant_slug}/evento/{event_slug}/qr`.

Since the dashboard events page may already list events, add a small "QR" link next to each published event. Read the existing page first and add accordingly.

- [ ] **Step 5.2: Commit**

```powershell
git add "src/app/(dashboard)/"
git commit -m "feat(additional): QR code links in dashboard events list"
```

---

## Task 6: Build Verification

- [ ] **Step 6.1: Run all tests**

```powershell
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 6.2: TypeScript check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 6.3: Production build**

```powershell
npx next build
```

Expected new routes:
- `/[tenant]/evento/[slug]/qr`
- `/[tenant]/evento/[slug]/slideshow`

- [ ] **Step 6.4: Final commit**

```powershell
git add -A
git commit -m "feat(plan-9): additional features complete — QR codes, slideshow, LGPD"
```
