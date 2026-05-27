# E-commerce (Cart, Checkout, Payments, Delivery) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full e-commerce flow — cart (cookie-based), checkout (Stripe card + MercadoPago PIX), webhook fulfillment, and signed-URL photo delivery — so clients can browse public event/ensaio pages and buy photos.

**Architecture:** Cart state lives in a server-side httpOnly cookie (UUID session); orders and order_items are already in the database schema. Payments are processed via Stripe (card) and MercadoPago (PIX); webhooks mark orders paid and enqueue delivery. Delivery signs private-bucket URLs per order item and streams a ZIP or individual downloads to the client.

**Tech Stack:** Next.js 14 App Router, Supabase (postgres + storage), Stripe Node SDK + @stripe/react-stripe-js, mercadopago Node SDK, Sharp (already installed), BullMQ/Redis (already installed), bcryptjs (already installed), shadcn/ui

---

## File Map

**New files:**
- `supabase/migrations/0005_orders_nullable_client.sql` — make `orders.client_user_id` nullable
- `src/lib/cart-session.ts` — cart UUID cookie helpers (read/write/delete)
- `src/lib/payments/stripe.ts` — Stripe PaymentIntent creation + webhook verification
- `src/lib/payments/mercadopago.ts` — MercadoPago PIX payment creation + webhook verification
- `src/lib/delivery.ts` — generate signed URLs for purchased photos; future ZIP queue
- `src/app/api/cart/route.ts` — GET (list cart items) + POST (add photo to cart)
- `src/app/api/cart/[photoId]/route.ts` — DELETE (remove photo from cart)
- `src/app/api/checkout/route.ts` — POST (create order + payment intent or PIX)
- `src/app/api/webhooks/stripe/route.ts` — Stripe webhook handler
- `src/app/api/webhooks/mercadopago/route.ts` — MercadoPago webhook handler
- `src/app/api/orders/[id]/route.ts` — GET (order detail + payment status)
- `src/app/api/orders/[id]/download/route.ts` — GET (signed download URLs)
- `src/components/cart/cart-button.tsx` — nav cart icon with item count badge
- `src/components/cart/cart-drawer.tsx` — slide-out drawer listing cart items
- `src/components/checkout/checkout-form.tsx` — payment method selector + form shell
- `src/components/checkout/pix-display.tsx` — QR code + copy PIX key
- `src/components/checkout/stripe-card-form.tsx` — Stripe Elements card input
- `src/app/[tenant]/carrinho/page.tsx` — cart page (SSR shell + CartDrawer)
- `src/app/[tenant]/checkout/page.tsx` — checkout page
- `src/app/[tenant]/pedido/[id]/page.tsx` — order confirmation + download page
- `__tests__/api/cart/cart.test.ts`
- `__tests__/api/checkout/checkout.test.ts`
- `__tests__/api/webhooks/stripe.test.ts`
- `__tests__/api/webhooks/mercadopago.test.ts`
- `__tests__/api/orders/download.test.ts`

**Modified files:**
- `src/lib/env.ts` — add Stripe + MercadoPago env vars
- `src/app/[tenant]/layout.tsx` — add CartButton to nav
- `src/app/[tenant]/evento/[slug]/_components/photo-grid.tsx` — add "Add to cart" button per photo

---

## Task 1: Install Dependencies + Database Migration

**Files:**
- Modify: `package.json` (via npm install)
- Create: `supabase/migrations/0005_orders_nullable_client.sql`

- [ ] **Step 1.1: Install Stripe and MercadoPago SDKs**

```powershell
cd C:\Users\dougl\workspace5\fotosaas
npm install stripe @stripe/stripe-js @stripe/react-stripe-js mercadopago
```

Expected: packages added to package.json, no peer dep errors.

- [ ] **Step 1.2: Create migration to make client_user_id nullable**

Create `supabase/migrations/0005_orders_nullable_client.sql`:

```sql
-- Allow guest checkout: orders don't require a logged-in user
ALTER TABLE orders ALTER COLUMN client_user_id DROP NOT NULL;
```

- [ ] **Step 1.3: Apply migration locally**

```powershell
npx supabase migration up
```

Or if using direct SQL:
```powershell
npx supabase db push
```

Expected: migration applied without error.

- [ ] **Step 1.4: Commit**

```powershell
git add supabase/migrations/0005_orders_nullable_client.sql package.json package-lock.json
git commit -m "feat(ecommerce): install stripe+mercadopago, nullable client_user_id"
```

---

## Task 2: Environment Variables

**Files:**
- Modify: `src/lib/env.ts`

- [ ] **Step 2.1: Add Stripe + MercadoPago env vars to env.ts**

Read current `src/lib/env.ts`. Replace the export with:

```typescript
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  NEXT_PUBLIC_APP_URL: requireEnv('NEXT_PUBLIC_APP_URL'),
  NEXT_PUBLIC_ROOT_DOMAIN: requireEnv('NEXT_PUBLIC_ROOT_DOMAIN'),
  FACE_RECOGNITION_SERVICE_URL: process.env.FACE_RECOGNITION_SERVICE_URL ?? 'http://localhost:8000',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  // MercadoPago
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
  MERCADOPAGO_WEBHOOK_SECRET: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '',
} as const
```

- [ ] **Step 2.2: Add env vars to .env.local.example (if it exists) or .env.local**

Add to `.env.local` (do not commit):
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
MERCADOPAGO_ACCESS_TOKEN=TEST-...
MERCADOPAGO_WEBHOOK_SECRET=your-mp-secret
```

- [ ] **Step 2.3: Commit env.ts change**

```powershell
git add src/lib/env.ts
git commit -m "feat(ecommerce): add Stripe and MercadoPago env vars"
```

---

## Task 3: Cart Session Library (TDD)

**Files:**
- Create: `src/lib/cart-session.ts`
- Create: `__tests__/lib/cart-session.test.ts`

The cart is a UUID stored in an httpOnly cookie named `cart_session`. The cart items are stored in the `cart_items` database table (or we use the `carts` + `cart_items` pattern). Since the schema already has these tables, we'll use them.

Cart session cookie: `cart_session` = UUID (httpOnly, sameSite: lax, 30-day maxAge, path: /).

- [ ] **Step 3.1: Write failing tests**

Create `__tests__/lib/cart-session.test.ts`:

```typescript
import { getOrCreateCartSession, CART_COOKIE_NAME, CART_COOKIE_MAX_AGE } from '@/lib/cart-session'

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

import { cookies } from 'next/headers'

describe('cart-session', () => {
  const mockGet = jest.fn()
  const mockSet = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(cookies as jest.Mock).mockResolvedValue({
      get: mockGet,
      set: mockSet,
    })
  })

  describe('getOrCreateCartSession', () => {
    it('returns existing session id from cookie', async () => {
      const existingId = 'existing-uuid-1234'
      mockGet.mockReturnValue({ value: existingId })

      const result = await getOrCreateCartSession()

      expect(result.sessionId).toBe(existingId)
      expect(mockSet).not.toHaveBeenCalled()
    })

    it('creates a new UUID session when no cookie exists', async () => {
      mockGet.mockReturnValue(undefined)

      const result = await getOrCreateCartSession()

      expect(result.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
      expect(mockSet).toHaveBeenCalledWith(
        CART_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          maxAge: CART_COOKIE_MAX_AGE,
          path: '/',
        })
      )
    })

    it('exports correct constants', () => {
      expect(CART_COOKIE_NAME).toBe('cart_session')
      expect(CART_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 30)
    })
  })
})
```

- [ ] **Step 3.2: Run test to verify it fails**

```powershell
npx jest __tests__/lib/cart-session.test.ts --no-coverage
```

Expected: FAIL — cannot find module `@/lib/cart-session`.

- [ ] **Step 3.3: Implement cart-session.ts**

Create `src/lib/cart-session.ts`:

```typescript
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'

export const CART_COOKIE_NAME = 'cart_session'
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function getOrCreateCartSession(): Promise<{ sessionId: string }> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(CART_COOKIE_NAME)

  if (existing?.value) {
    return { sessionId: existing.value }
  }

  const sessionId = randomUUID()
  cookieStore.set(CART_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: CART_COOKIE_MAX_AGE,
    path: '/',
  })

  return { sessionId }
}
```

- [ ] **Step 3.4: Run test to verify it passes**

```powershell
npx jest __tests__/lib/cart-session.test.ts --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 3.5: Commit**

```powershell
git add src/lib/cart-session.ts __tests__/lib/cart-session.test.ts
git commit -m "feat(cart): cart session cookie helper"
```

---

## Task 4: Cart API Routes (TDD)

**Files:**
- Create: `src/app/api/cart/route.ts`
- Create: `src/app/api/cart/[photoId]/route.ts`
- Create: `__tests__/api/cart/cart.test.ts`

The cart API does NOT require authentication (guests can have carts). It reads/writes `cart_items` using the `cart_session` UUID as a foreign key. The `cart_items` table has: `id`, `session_id`, `photo_id`, `event_id`, `price_cents`, `created_at`.

- [ ] **Step 4.1: Write failing tests**

Create `__tests__/api/cart/cart.test.ts`:

```typescript
import { NextRequest } from 'next/server'

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

// Mock cart-session
jest.mock('@/lib/cart-session', () => ({
  getOrCreateCartSession: jest.fn(),
  CART_COOKIE_NAME: 'cart_session',
  CART_COOKIE_MAX_AGE: 2592000,
}))

// Mock supabase admin
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

import { cookies } from 'next/headers'
import { getOrCreateCartSession } from '@/lib/cart-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET, POST } from '@/app/api/cart/route'
import { DELETE } from '@/app/api/cart/[photoId]/route'

function createMockChain(returnValue: unknown) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['from', 'select', 'insert', 'delete', 'eq', 'single', 'maybeSingle', 'order']
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain)
  })
  // Terminal: returns the value
  chain['select'] = jest.fn().mockResolvedValue(returnValue)
  chain['insert'] = jest.fn().mockReturnValue(chain)
  chain['delete'] = jest.fn().mockReturnValue(chain)
  chain['eq'] = jest.fn().mockReturnValue(chain)
  chain['order'] = jest.fn().mockResolvedValue(returnValue)
  chain['single'] = jest.fn().mockResolvedValue(returnValue)
  chain['maybeSingle'] = jest.fn().mockResolvedValue(returnValue)
  return chain
}

describe('GET /api/cart', () => {
  it('returns cart items for session', async () => {
    const sessionId = 'test-session-uuid'
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId })

    const mockItems = [
      { id: 'item1', photo_id: 'photo1', event_id: 'evt1', price_cents: 2000, photos: { public_storage_path: 'path/to/photo.jpg' } },
    ]
    const chain = createMockChain({ data: mockItems, error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({ from: jest.fn().mockReturnValue(chain) })

    const req = new NextRequest('http://localhost/api/cart')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('items')
  })

  it('returns empty array when no cart items', async () => {
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'empty-session' })
    const chain = createMockChain({ data: [], error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({ from: jest.fn().mockReturnValue(chain) })

    const req = new NextRequest('http://localhost/api/cart')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items).toEqual([])
  })
})

describe('POST /api/cart', () => {
  it('adds a photo to the cart', async () => {
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'test-session' })

    const mockPhoto = { id: 'photo1', event_id: 'evt1', status: 'ready' }
    const mockEvent = { id: 'evt1', price_cents: 2000, status: 'published' }

    const adminClient = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'photos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockPhoto, error: null }),
          }
        }
        if (table === 'events') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockEvent, error: null }),
          }
        }
        if (table === 'cart_items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            insert: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: 'item1', photo_id: 'photo1', price_cents: 2000 }, error: null }),
          }
        }
        return {}
      }),
    }
    ;(createAdminClient as jest.Mock).mockReturnValue(adminClient)

    const req = new NextRequest('http://localhost/api/cart', {
      method: 'POST',
      body: JSON.stringify({ photoId: 'photo1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toHaveProperty('id')
  })

  it('returns 400 when photoId missing', async () => {
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'test-session' })
    ;(createAdminClient as jest.Mock).mockReturnValue({})

    const req = new NextRequest('http://localhost/api/cart', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when photo not found', async () => {
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'test-session' })

    const adminClient = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'photos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }
        }
        return {}
      }),
    }
    ;(createAdminClient as jest.Mock).mockReturnValue(adminClient)

    const req = new NextRequest('http://localhost/api/cart', {
      method: 'POST',
      body: JSON.stringify({ photoId: 'nonexistent' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/cart/[photoId]', () => {
  it('removes a photo from the cart', async () => {
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'test-session' })

    const adminClient = {
      from: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }
    ;(createAdminClient as jest.Mock).mockReturnValue(adminClient)

    const req = new NextRequest('http://localhost/api/cart/photo1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ photoId: 'photo1' }) })
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 4.2: Run tests to verify they fail**

```powershell
npx jest __tests__/api/cart/cart.test.ts --no-coverage
```

Expected: FAIL — cannot find module `@/app/api/cart/route`.

- [ ] **Step 4.3: Implement GET + POST /api/cart**

Create `src/app/api/cart/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCartSession } from '@/lib/cart-session'

export async function GET(_request: NextRequest) {
  const { sessionId } = await getOrCreateCartSession()
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items, error } = await (adminClient as any)
    .from('cart_items')
    .select('id, photo_id, event_id, price_cents, photos(public_storage_path)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[GET /api/cart]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return NextResponse.json({ items: items ?? [] })
}

export async function POST(request: NextRequest) {
  const { sessionId } = await getOrCreateCartSession()

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { photoId } = body as { photoId?: string }
  if (!photoId) {
    return NextResponse.json({ error: 'photoId é obrigatório.' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Verify photo exists and is ready
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photo, error: photoError } = await (adminClient as any)
    .from('photos')
    .select('id, event_id, status')
    .eq('id', photoId)
    .single()

  if (photoError || !photo) {
    return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
  }
  if (photo.status !== 'ready') {
    return NextResponse.json({ error: 'Foto não disponível.' }, { status: 422 })
  }

  // Get event price
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event, error: eventError } = await (adminClient as any)
    .from('events')
    .select('id, price_cents, status')
    .eq('id', photo.event_id)
    .single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  }
  if (event.status !== 'published') {
    return NextResponse.json({ error: 'Evento não publicado.' }, { status: 422 })
  }

  // Check if already in cart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (adminClient as any)
    .from('cart_items')
    .select('id')
    .eq('session_id', sessionId)
    .eq('photo_id', photoId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Foto já no carrinho.' }, { status: 409 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error: insertError } = await (adminClient as any)
    .from('cart_items')
    .insert({
      session_id: sessionId,
      photo_id: photoId,
      event_id: photo.event_id,
      price_cents: event.price_cents,
    })
    .select()
    .single()

  if (insertError) {
    console.error('[POST /api/cart]', insertError)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return NextResponse.json(item, { status: 201 })
}
```

- [ ] **Step 4.4: Implement DELETE /api/cart/[photoId]**

Create `src/app/api/cart/[photoId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCartSession } from '@/lib/cart-session'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params
  const { sessionId } = await getOrCreateCartSession()
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (adminClient as any)
    .from('cart_items')
    .delete()
    .eq('session_id', sessionId)
    .eq('photo_id', photoId)

  if (error) {
    console.error('[DELETE /api/cart/[photoId]]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4.5: Run tests to verify they pass**

```powershell
npx jest __tests__/api/cart/cart.test.ts --no-coverage
```

Expected: PASS (6 tests).

- [ ] **Step 4.6: Commit**

```powershell
git add src/app/api/cart/ __tests__/api/cart/
git commit -m "feat(cart): cart API routes (GET, POST, DELETE)"
```

---

## Task 5: Payment Libraries (TDD)

**Files:**
- Create: `src/lib/payments/stripe.ts`
- Create: `src/lib/payments/mercadopago.ts`
- Create: `__tests__/lib/payments/stripe.test.ts`
- Create: `__tests__/lib/payments/mercadopago.test.ts`

- [ ] **Step 5.1: Write failing Stripe test**

Create `__tests__/lib/payments/stripe.test.ts`:

```typescript
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }))
})

import { createStripePaymentIntent, verifyStripeWebhook } from '@/lib/payments/stripe'

describe('stripe payment library', () => {
  it('createStripePaymentIntent returns clientSecret and paymentIntentId', async () => {
    const Stripe = require('stripe')
    const mockStripe = new Stripe()
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_test123',
      client_secret: 'pi_test123_secret_abc',
    })
    Stripe.mockImplementation(() => mockStripe)

    const result = await createStripePaymentIntent({
      amountCents: 5000,
      currency: 'brl',
      metadata: { orderId: 'order123' },
    })

    expect(result.paymentIntentId).toBe('pi_test123')
    expect(result.clientSecret).toBe('pi_test123_secret_abc')
  })

  it('verifyStripeWebhook calls constructEvent with raw body', () => {
    const Stripe = require('stripe')
    const mockEvent = { type: 'payment_intent.succeeded', data: { object: {} } }
    const mockStripe = new Stripe()
    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
    Stripe.mockImplementation(() => mockStripe)

    const result = verifyStripeWebhook('raw-body', 'stripe-sig', 'whsec_test')

    expect(result).toEqual(mockEvent)
    expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith('raw-body', 'stripe-sig', 'whsec_test')
  })
})
```

- [ ] **Step 5.2: Write failing MercadoPago test**

Create `__tests__/lib/payments/mercadopago.test.ts`:

```typescript
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Payment: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
  })),
}))

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  createHmac: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('valid-signature'),
  }),
}))

import { createMercadoPagoPix, verifyMercadoPagoWebhook } from '@/lib/payments/mercadopago'

describe('mercadopago payment library', () => {
  it('createMercadoPagoPix returns pixQrCode and pixQrCodeBase64', async () => {
    const { Payment } = require('mercadopago')
    const mockPayment = new Payment()
    mockPayment.create.mockResolvedValue({
      id: 123456,
      point_of_interaction: {
        transaction_data: {
          qr_code: '00020126...',
          qr_code_base64: 'base64string==',
        },
      },
      status: 'pending',
    })
    Payment.mockImplementation(() => mockPayment)

    const result = await createMercadoPagoPix({
      amountCents: 5000,
      description: 'Fotos do evento',
      payerEmail: 'cliente@email.com',
      orderId: 'order123',
    })

    expect(result.pixQrCode).toBe('00020126...')
    expect(result.pixQrCodeBase64).toBe('base64string==')
    expect(result.paymentId).toBe('123456')
  })

  it('verifyMercadoPagoWebhook returns true for valid signature', () => {
    const result = verifyMercadoPagoWebhook('payload', 'valid-signature', 'secret')
    expect(result).toBe(true)
  })

  it('verifyMercadoPagoWebhook returns false for invalid signature', () => {
    const result = verifyMercadoPagoWebhook('payload', 'invalid-sig', 'secret')
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 5.3: Run tests to verify they fail**

```powershell
npx jest __tests__/lib/payments/ --no-coverage
```

Expected: FAIL — cannot find module `@/lib/payments/stripe`.

- [ ] **Step 5.4: Implement stripe.ts**

Create `src/lib/payments/stripe.ts`:

```typescript
import Stripe from 'stripe'

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2024-12-18.acacia',
  })
}

export async function createStripePaymentIntent({
  amountCents,
  currency,
  metadata,
}: {
  amountCents: number
  currency: string
  metadata: Record<string, string>
}): Promise<{ paymentIntentId: string; clientSecret: string }> {
  const stripe = getStripe()
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    metadata,
    automatic_payment_methods: { enabled: true },
  })

  return {
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret!,
  }
}

export function verifyStripeWebhook(
  rawBody: string,
  signature: string,
  secret: string
): Stripe.Event {
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(rawBody, signature, secret)
}
```

- [ ] **Step 5.5: Implement mercadopago.ts**

Create `src/lib/payments/mercadopago.ts`:

```typescript
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createHmac } from 'crypto'

function getMPConfig(): MercadoPagoConfig {
  return new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
  })
}

export async function createMercadoPagoPix({
  amountCents,
  description,
  payerEmail,
  orderId,
}: {
  amountCents: number
  description: string
  payerEmail: string
  orderId: string
}): Promise<{ pixQrCode: string; pixQrCodeBase64: string; paymentId: string }> {
  const config = getMPConfig()
  const payment = new Payment(config)

  const result = await payment.create({
    body: {
      transaction_amount: amountCents / 100,
      description,
      payment_method_id: 'pix',
      payer: { email: payerEmail },
      external_reference: orderId,
    },
  })

  const txData = result.point_of_interaction?.transaction_data
  return {
    pixQrCode: txData?.qr_code ?? '',
    pixQrCodeBase64: txData?.qr_code_base64 ?? '',
    paymentId: String(result.id),
  }
}

export function verifyMercadoPagoWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  return expected === signature
}
```

- [ ] **Step 5.6: Run tests to verify they pass**

```powershell
npx jest __tests__/lib/payments/ --no-coverage
```

Expected: PASS (5 tests).

- [ ] **Step 5.7: Commit**

```powershell
git add src/lib/payments/ __tests__/lib/payments/
git commit -m "feat(payments): Stripe and MercadoPago payment libraries"
```

---

## Task 6: Checkout API Route (TDD)

**Files:**
- Create: `src/app/api/checkout/route.ts`
- Create: `__tests__/api/checkout/checkout.test.ts`

Checkout flow:
1. Read cart items for session
2. Validate items still valid (photos ready, events published)
3. Create `orders` row (status: `pending`) + `order_items` rows
4. Based on `paymentMethod` param: create Stripe PaymentIntent or MP PIX payment
5. Return `{ orderId, paymentMethod, clientSecret? (Stripe), pixQrCode? (MP), pixQrCodeBase64? (MP) }`

- [ ] **Step 6.1: Write failing tests**

Create `__tests__/api/checkout/checkout.test.ts`:

```typescript
import { NextRequest } from 'next/server'

jest.mock('next/headers', () => ({ cookies: jest.fn() }))
jest.mock('@/lib/cart-session', () => ({
  getOrCreateCartSession: jest.fn(),
  CART_COOKIE_NAME: 'cart_session',
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/payments/stripe', () => ({ createStripePaymentIntent: jest.fn() }))
jest.mock('@/lib/payments/mercadopago', () => ({ createMercadoPagoPix: jest.fn() }))

import { getOrCreateCartSession } from '@/lib/cart-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { createStripePaymentIntent } from '@/lib/payments/stripe'
import { createMercadoPagoPix } from '@/lib/payments/mercadopago'
import { POST } from '@/app/api/checkout/route'

const mockCartItems = [
  { id: 'ci1', photo_id: 'p1', event_id: 'e1', price_cents: 2000 },
  { id: 'ci2', photo_id: 'p2', event_id: 'e1', price_cents: 2000 },
]

function buildAdminClient(cartItems = mockCartItems) {
  const orderInsertChain = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'order123', total_cents: 4000 }, error: null }),
  }
  const orderItemsInsertChain = {
    insert: jest.fn().mockResolvedValue({ error: null }),
  }
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'cart_items') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: cartItems, error: null }),
        }
      }
      if (table === 'orders') return orderInsertChain
      if (table === 'order_items') return orderItemsInsertChain
      return {}
    }),
  }
}

describe('POST /api/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getOrCreateCartSession as jest.Mock).mockResolvedValue({ sessionId: 'sess1' })
  })

  it('returns 400 when paymentMethod is missing', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())
    const req = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when cart is empty', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient([]))
    const req = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'stripe', email: 'test@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates Stripe checkout and returns clientSecret', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())
    ;(createStripePaymentIntent as jest.Mock).mockResolvedValue({
      paymentIntentId: 'pi_123',
      clientSecret: 'pi_123_secret',
    })

    const req = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'stripe', email: 'test@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.orderId).toBe('order123')
    expect(body.clientSecret).toBe('pi_123_secret')
    expect(body.paymentMethod).toBe('stripe')
  })

  it('creates MercadoPago PIX checkout and returns pixQrCode', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())
    ;(createMercadoPagoPix as jest.Mock).mockResolvedValue({
      pixQrCode: '00020126...',
      pixQrCodeBase64: 'base64==',
      paymentId: 'mp_456',
    })

    const req = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'pix', email: 'test@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.orderId).toBe('order123')
    expect(body.pixQrCode).toBe('00020126...')
    expect(body.paymentMethod).toBe('pix')
  })
})
```

- [ ] **Step 6.2: Run tests to verify they fail**

```powershell
npx jest __tests__/api/checkout/checkout.test.ts --no-coverage
```

Expected: FAIL — cannot find module `@/app/api/checkout/route`.

- [ ] **Step 6.3: Implement checkout route**

Create `src/app/api/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCartSession } from '@/lib/cart-session'
import { createStripePaymentIntent } from '@/lib/payments/stripe'
import { createMercadoPagoPix } from '@/lib/payments/mercadopago'

type CartItem = {
  id: string
  photo_id: string
  event_id: string
  price_cents: number
}

export async function POST(request: NextRequest) {
  const { sessionId } = await getOrCreateCartSession()

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { paymentMethod, email } = body as { paymentMethod?: string; email?: string }

  if (!paymentMethod || !['stripe', 'pix'].includes(paymentMethod)) {
    return NextResponse.json({ error: 'paymentMethod deve ser stripe ou pix.' }, { status: 400 })
  }
  if (!email) {
    return NextResponse.json({ error: 'email é obrigatório.' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Fetch cart items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cartItems, error: cartError } = await (adminClient as any)
    .from('cart_items')
    .select('id, photo_id, event_id, price_cents')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (cartError) {
    console.error('[POST /api/checkout] cart fetch', cartError)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  if (!cartItems || cartItems.length === 0) {
    return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 })
  }

  const items = cartItems as CartItem[]
  const totalCents = items.reduce((sum: number, i: CartItem) => sum + i.price_cents, 0)

  // Create order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: orderError } = await (adminClient as any)
    .from('orders')
    .insert({
      client_user_id: null,
      client_email: email,
      total_cents: totalCents,
      status: 'pending',
      payment_method: paymentMethod,
    })
    .select()
    .single()

  if (orderError) {
    console.error('[POST /api/checkout] order insert', orderError)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  // Create order items
  const orderItems = items.map((item: CartItem) => ({
    order_id: order.id,
    photo_id: item.photo_id,
    event_id: item.event_id,
    price_cents: item.price_cents,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: itemsError } = await (adminClient as any)
    .from('order_items')
    .insert(orderItems)

  if (itemsError) {
    console.error('[POST /api/checkout] order_items insert', itemsError)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  // Process payment
  if (paymentMethod === 'stripe') {
    const { paymentIntentId, clientSecret } = await createStripePaymentIntent({
      amountCents: totalCents,
      currency: 'brl',
      metadata: { orderId: order.id },
    })

    // Update order with payment intent id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient as any)
      .from('orders')
      .update({ payment_provider_id: paymentIntentId })
      .eq('id', order.id)

    return NextResponse.json(
      { orderId: order.id, paymentMethod: 'stripe', clientSecret },
      { status: 201 }
    )
  } else {
    // PIX via MercadoPago
    const { pixQrCode, pixQrCodeBase64, paymentId } = await createMercadoPagoPix({
      amountCents: totalCents,
      description: `Fotos - Pedido ${order.id}`,
      payerEmail: email,
      orderId: order.id,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient as any)
      .from('orders')
      .update({ payment_provider_id: paymentId })
      .eq('id', order.id)

    return NextResponse.json(
      { orderId: order.id, paymentMethod: 'pix', pixQrCode, pixQrCodeBase64 },
      { status: 201 }
    )
  }
}
```

- [ ] **Step 6.4: Run tests to verify they pass**

```powershell
npx jest __tests__/api/checkout/checkout.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 6.5: Commit**

```powershell
git add src/app/api/checkout/ __tests__/api/checkout/
git commit -m "feat(checkout): POST /api/checkout with Stripe and PIX"
```

---

## Task 7: Stripe Webhook Handler (TDD)

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`
- Create: `__tests__/api/webhooks/stripe.test.ts`

On `payment_intent.succeeded`: mark order as `paid`, delete cart items for that session.

- [ ] **Step 7.1: Write failing tests**

Create `__tests__/api/webhooks/stripe.test.ts`:

```typescript
import { NextRequest } from 'next/server'

jest.mock('@/lib/payments/stripe', () => ({ verifyStripeWebhook: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { verifyStripeWebhook } from '@/lib/payments/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/webhooks/stripe/route'

function buildAdminClient() {
  return {
    from: jest.fn().mockImplementation(() => ({
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    })),
  }
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when stripe-signature header is missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: 'raw-body',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when webhook verification fails', async () => {
    ;(verifyStripeWebhook as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: 'raw-body',
      headers: { 'stripe-signature': 'bad-sig' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('marks order as paid on payment_intent.succeeded', async () => {
    const mockEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          metadata: { orderId: 'order123' },
        },
      },
    }
    ;(verifyStripeWebhook as jest.Mock).mockReturnValue(mockEvent)
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())

    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify(mockEvent),
      headers: { 'stripe-signature': 'valid-sig' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
  })

  it('ignores unknown event types', async () => {
    const mockEvent = { type: 'customer.created', data: { object: {} } }
    ;(verifyStripeWebhook as jest.Mock).mockReturnValue(mockEvent)
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())

    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify(mockEvent),
      headers: { 'stripe-signature': 'valid-sig' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 7.2: Run tests to verify they fail**

```powershell
npx jest __tests__/api/webhooks/stripe.test.ts --no-coverage
```

Expected: FAIL — cannot find module `@/app/api/webhooks/stripe/route`.

- [ ] **Step 7.3: Implement Stripe webhook route**

Create `src/app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyStripeWebhook } from '@/lib/payments/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const config = { api: { bodyParser: false } }

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
  }

  const rawBody = await request.text()
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  let event
  try {
    event = verifyStripeWebhook(rawBody, signature, secret)
  } catch (err) {
    console.error('[Stripe webhook] verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymentIntent = event.data.object as any
    const orderId = paymentIntent.metadata?.orderId

    if (orderId) {
      const adminClient = createAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any)
        .from('orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', orderId)
    }
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

```powershell
npx jest __tests__/api/webhooks/stripe.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 7.5: Commit**

```powershell
git add src/app/api/webhooks/stripe/ __tests__/api/webhooks/stripe.test.ts
git commit -m "feat(webhooks): Stripe webhook handler"
```

---

## Task 8: MercadoPago Webhook Handler (TDD)

**Files:**
- Create: `src/app/api/webhooks/mercadopago/route.ts`
- Create: `__tests__/api/webhooks/mercadopago.test.ts`

On MercadoPago `payment` notification with status `approved`: mark order as `paid`.

- [ ] **Step 8.1: Write failing tests**

Create `__tests__/api/webhooks/mercadopago.test.ts`:

```typescript
import { NextRequest } from 'next/server'

jest.mock('@/lib/payments/mercadopago', () => ({ verifyMercadoPagoWebhook: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { verifyMercadoPagoWebhook } from '@/lib/payments/mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/webhooks/mercadopago/route'

function buildAdminClient() {
  return {
    from: jest.fn().mockImplementation(() => ({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'order123', status: 'pending' }, error: null }),
    })),
  }
}

describe('POST /api/webhooks/mercadopago', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 200 when signature verification fails (MP may retry)', async () => {
    ;(verifyMercadoPagoWebhook as jest.Mock).mockReturnValue(false)

    const req = new NextRequest('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ type: 'payment', data: { id: '123' } }),
      headers: { 'Content-Type': 'application/json', 'x-signature': 'bad-sig' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('marks order as paid when payment is approved', async () => {
    ;(verifyMercadoPagoWebhook as jest.Mock).mockReturnValue(true)
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())

    const payload = JSON.stringify({
      type: 'payment',
      data: { id: 'mp_456' },
      action: 'payment.updated',
    })

    const req = new NextRequest('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        'x-signature': 'valid-sig',
        'x-request-id': 'req-1',
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 8.2: Run tests to verify they fail**

```powershell
npx jest __tests__/api/webhooks/mercadopago.test.ts --no-coverage
```

Expected: FAIL — cannot find module `@/app/api/webhooks/mercadopago/route`.

- [ ] **Step 8.3: Implement MercadoPago webhook route**

Create `src/app/api/webhooks/mercadopago/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyMercadoPagoWebhook } from '@/lib/payments/mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { MercadoPagoConfig, Payment } from 'mercadopago'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-signature') ?? ''
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? ''

  const isValid = verifyMercadoPagoWebhook(rawBody, signature, secret)
  if (!isValid) {
    // Return 200 to prevent MP retries on signature mismatch in test mode
    console.warn('[MP webhook] Invalid signature — returning 200 to avoid retries')
    return NextResponse.json({ received: true })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ received: true })
  }

  if (body.type === 'payment') {
    const paymentId = (body.data as { id?: string })?.id
    if (paymentId) {
      try {
        const config = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '' })
        const paymentClient = new Payment(config)
        const payment = await paymentClient.get({ id: paymentId })

        if (payment.status === 'approved') {
          const orderId = payment.external_reference
          if (orderId) {
            const adminClient = createAdminClient()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminClient as any)
              .from('orders')
              .update({ status: 'paid', paid_at: new Date().toISOString() })
              .eq('id', orderId)
          }
        }
      } catch (err) {
        console.error('[MP webhook] error fetching payment:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 8.4: Run tests to verify they pass**

```powershell
npx jest __tests__/api/webhooks/mercadopago.test.ts --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 8.5: Commit**

```powershell
git add src/app/api/webhooks/mercadopago/ __tests__/api/webhooks/mercadopago.test.ts
git commit -m "feat(webhooks): MercadoPago webhook handler"
```

---

## Task 9: Delivery Library + Download Route (TDD)

**Files:**
- Create: `src/lib/delivery.ts`
- Create: `src/app/api/orders/[id]/route.ts`
- Create: `src/app/api/orders/[id]/download/route.ts`
- Create: `__tests__/api/orders/download.test.ts`

- [ ] **Step 9.1: Write failing tests**

Create `__tests__/api/orders/download.test.ts`:

```typescript
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/delivery', () => ({ generateDownloadUrls: jest.fn() }))

import { createAdminClient } from '@/lib/supabase/admin'
import { generateDownloadUrls } from '@/lib/delivery'
import { GET as getOrder } from '@/app/api/orders/[id]/route'
import { GET as getDownload } from '@/app/api/orders/[id]/download/route'

const mockOrder = {
  id: 'order123',
  status: 'paid',
  client_email: 'test@test.com',
  total_cents: 4000,
  payment_method: 'stripe',
  created_at: '2026-01-01T00:00:00Z',
}

function buildAdminClient(order = mockOrder, orderItems = [{ id: 'oi1', photo_id: 'p1', event_id: 'e1', price_cents: 2000 }]) {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: order, error: null }),
        }
      }
      if (table === 'order_items') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: orderItems, error: null }),
        }
      }
      return {}
    }),
  }
}

describe('GET /api/orders/[id]', () => {
  it('returns order details for a paid order', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())
    const req = new NextRequest('http://localhost/api/orders/order123')
    const res = await getOrder(req, { params: Promise.resolve({ id: 'order123' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe('order123')
    expect(body.status).toBe('paid')
  })

  it('returns 404 when order not found', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      }),
    })
    const req = new NextRequest('http://localhost/api/orders/nonexistent')
    const res = await getOrder(req, { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/orders/[id]/download', () => {
  it('returns 403 when order is not paid', async () => {
    const unpaidOrder = { ...mockOrder, status: 'pending' }
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient(unpaidOrder))

    const req = new NextRequest('http://localhost/api/orders/order123/download')
    const res = await getDownload(req, { params: Promise.resolve({ id: 'order123' }) })
    expect(res.status).toBe(403)
  })

  it('returns signed download URLs for paid order', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue(buildAdminClient())
    ;(generateDownloadUrls as jest.Mock).mockResolvedValue([
      { photoId: 'p1', url: 'https://storage.example.com/signed-url', expiresAt: '2026-01-02T00:00:00Z' },
    ])

    const req = new NextRequest('http://localhost/api/orders/order123/download')
    const res = await getDownload(req, { params: Promise.resolve({ id: 'order123' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.downloads).toHaveLength(1)
    expect(body.downloads[0].url).toContain('signed-url')
  })
})
```

- [ ] **Step 9.2: Run tests to verify they fail**

```powershell
npx jest __tests__/api/orders/download.test.ts --no-coverage
```

Expected: FAIL — cannot find module `@/app/api/orders/[id]/route`.

- [ ] **Step 9.3: Implement delivery.ts**

Create `src/lib/delivery.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

const DOWNLOAD_URL_EXPIRY_SECONDS = 60 * 60 * 24 // 24 hours

type DownloadUrl = {
  photoId: string
  url: string
  expiresAt: string
}

export async function generateDownloadUrls(photoIds: string[]): Promise<DownloadUrl[]> {
  const adminClient = createAdminClient()

  // Fetch original storage paths
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, error } = await (adminClient as any)
    .from('photos')
    .select('id, original_storage_path')
    .in('id', photoIds)

  if (error || !photos) {
    console.error('[delivery] fetch photos error:', error)
    return []
  }

  const results: DownloadUrl[] = []

  for (const photo of photos) {
    if (!photo.original_storage_path) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: signError } = await (adminClient as any).storage
      .from('photos-original')
      .createSignedUrl(photo.original_storage_path, DOWNLOAD_URL_EXPIRY_SECONDS)

    if (signError || !data?.signedUrl) {
      console.error('[delivery] sign url error for', photo.id, signError)
      continue
    }

    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_EXPIRY_SECONDS * 1000).toISOString()
    results.push({ photoId: photo.id, url: data.signedUrl, expiresAt })
  }

  return results
}
```

- [ ] **Step 9.4: Implement /api/orders/[id]/route.ts**

Create `src/app/api/orders/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error } = await (adminClient as any)
    .from('orders')
    .select('id, status, client_email, total_cents, payment_method, created_at')
    .eq('id', id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  }

  return NextResponse.json(order)
}
```

- [ ] **Step 9.5: Implement /api/orders/[id]/download/route.ts**

Create `src/app/api/orders/[id]/download/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDownloadUrls } from '@/lib/delivery'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminClient = createAdminClient()

  // Verify order is paid
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: orderError } = await (adminClient as any)
    .from('orders')
    .select('id, status')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  }

  if (order.status !== 'paid') {
    return NextResponse.json({ error: 'Pedido não pago.' }, { status: 403 })
  }

  // Fetch order items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderItems, error: itemsError } = await (adminClient as any)
    .from('order_items')
    .select('id, photo_id, event_id, price_cents')
    .eq('order_id', id)

  if (itemsError) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  const photoIds = (orderItems ?? []).map((item: { photo_id: string }) => item.photo_id)
  const downloads = await generateDownloadUrls(photoIds)

  return NextResponse.json({ downloads })
}
```

- [ ] **Step 9.6: Run tests to verify they pass**

```powershell
npx jest __tests__/api/orders/download.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 9.7: Commit**

```powershell
git add src/lib/delivery.ts src/app/api/orders/ __tests__/api/orders/
git commit -m "feat(delivery): delivery lib and download API routes"
```

---

## Task 10: Cart UI Components

**Files:**
- Create: `src/components/cart/cart-button.tsx`
- Create: `src/components/cart/cart-drawer.tsx`

These are Client Components. CartButton shows the shopping cart icon with item count badge. CartDrawer slides in from the right showing cart items + subtotal + checkout button.

- [ ] **Step 10.1: Create CartButton component**

Create `src/components/cart/cart-button.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CartDrawer } from './cart-drawer'

interface CartButtonProps {
  initialCount?: number
}

export function CartButton({ initialCount = 0 }: CartButtonProps) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(initialCount)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative"
        aria-label={`Carrinho com ${count} itens`}
      >
        <ShoppingCart className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>
      <CartDrawer open={open} onOpenChange={setOpen} onCountChange={setCount} />
    </>
  )
}
```

- [ ] **Step 10.2: Create CartDrawer component**

Create `src/components/cart/cart-drawer.tsx`:

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

type CartItem = {
  id: string
  photo_id: string
  event_id: string
  price_cents: number
  photos?: { public_storage_path: string }
}

interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCountChange: (count: number) => void
}

export function CartDrawer({ open, onOpenChange, onCountChange }: CartDrawerProps) {
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCart = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cart')
      const data = await res.json()
      setItems(data.items ?? [])
      onCountChange(data.items?.length ?? 0)
    } catch (err) {
      console.error('Failed to fetch cart:', err)
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => {
    if (open) fetchCart()
  }, [open, fetchCart])

  async function removeItem(photoId: string) {
    await fetch(`/api/cart/${photoId}`, { method: 'DELETE' })
    await fetchCart()
  }

  const subtotal = items.reduce((sum, item) => sum + item.price_cents, 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Carrinho</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full pt-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Seu carrinho está vazio.</p>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 border rounded">
                    {item.photos?.public_storage_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.photos.public_storage_path}
                        alt="Foto"
                        className="h-16 w-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {(item.price_cents / 100).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.photo_id)}
                      aria-label="Remover do carrinho"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="pt-4 space-y-3">
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Subtotal</span>
                  <span>
                    {(subtotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false)
                    window.location.href = '/checkout'
                  }}
                >
                  Finalizar Compra
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 10.3: Add shadcn Sheet and Separator if not installed**

```powershell
npx shadcn@latest add sheet separator --yes
```

Expected: Sheet and Separator components added to `src/components/ui/`.

- [ ] **Step 10.4: Commit**

```powershell
git add src/components/cart/
git commit -m "feat(cart-ui): CartButton and CartDrawer components"
```

---

## Task 11: Checkout UI Components

**Files:**
- Create: `src/components/checkout/checkout-form.tsx`
- Create: `src/components/checkout/pix-display.tsx`
- Create: `src/components/checkout/stripe-card-form.tsx`

- [ ] **Step 11.1: Create PixDisplay component**

Create `src/components/checkout/pix-display.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, Copy } from 'lucide-react'

interface PixDisplayProps {
  pixQrCode: string
  pixQrCodeBase64: string
  orderId: string
}

export function PixDisplay({ pixQrCode, pixQrCodeBase64, orderId }: PixDisplayProps) {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    await navigator.clipboard.writeText(pixQrCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">
        Escaneie o QR Code ou copie o código PIX abaixo. O pedido <strong>#{orderId.slice(0, 8)}</strong> será confirmado automaticamente após o pagamento.
      </p>

      {pixQrCodeBase64 && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${pixQrCodeBase64}`}
            alt="QR Code PIX"
            className="h-48 w-48 border rounded"
          />
        </div>
      )}

      <div className="flex gap-2 items-center">
        <code className="flex-1 bg-muted rounded px-3 py-2 text-xs text-left break-all">
          {pixQrCode}
        </code>
        <Button variant="outline" size="sm" onClick={copyCode}>
          {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Após o pagamento, acesse seus downloads em <a href={`/pedido/${orderId}`} className="underline">/pedido/{orderId.slice(0, 8)}...</a>
      </p>
    </div>
  )
}
```

- [ ] **Step 11.2: Create StripeCardForm component**

Create `src/components/checkout/stripe-card-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

interface StripeCardFormInnerProps {
  orderId: string
  onSuccess: () => void
}

function StripeCardFormInner({ orderId, onSuccess }: StripeCardFormInnerProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pedido/${orderId}`,
      },
    })

    if (submitError) {
      setError(submitError.message ?? 'Erro ao processar pagamento.')
      setLoading(false)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading || !stripe}>
        {loading ? 'Processando...' : 'Pagar'}
      </Button>
    </form>
  )
}

interface StripeCardFormProps {
  clientSecret: string
  orderId: string
  onSuccess: () => void
}

export function StripeCardForm({ clientSecret, orderId, onSuccess }: StripeCardFormProps) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripeCardFormInner orderId={orderId} onSuccess={onSuccess} />
    </Elements>
  )
}
```

- [ ] **Step 11.3: Create CheckoutForm component**

Create `src/components/checkout/checkout-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { StripeCardForm } from './stripe-card-form'
import { PixDisplay } from './pix-display'

type CheckoutState =
  | { step: 'form' }
  | { step: 'stripe'; clientSecret: string; orderId: string }
  | { step: 'pix'; pixQrCode: string; pixQrCodeBase64: string; orderId: string }
  | { step: 'done'; orderId: string }

export function CheckoutForm() {
  const [email, setEmail] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'pix'>('stripe')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<CheckoutState>({ step: 'form' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, paymentMethod }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao processar checkout.')
        return
      }

      if (paymentMethod === 'stripe') {
        setState({ step: 'stripe', clientSecret: data.clientSecret, orderId: data.orderId })
      } else {
        setState({ step: 'pix', pixQrCode: data.pixQrCode, pixQrCodeBase64: data.pixQrCodeBase64, orderId: data.orderId })
      }
    } catch (err) {
      setError('Erro de rede. Tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (state.step === 'stripe') {
    return (
      <StripeCardForm
        clientSecret={state.clientSecret}
        orderId={state.orderId}
        onSuccess={() => setState({ step: 'done', orderId: state.orderId })}
      />
    )
  }

  if (state.step === 'pix') {
    return (
      <PixDisplay
        pixQrCode={state.pixQrCode}
        pixQrCodeBase64={state.pixQrCodeBase64}
        orderId={state.orderId}
      />
    )
  }

  if (state.step === 'done') {
    return (
      <div className="text-center space-y-4">
        <p className="text-green-600 font-semibold">Pagamento confirmado!</p>
        <Button onClick={() => (window.location.href = `/pedido/${state.orderId}`)}>
          Ver meus downloads
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail para receber os downloads</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Forma de pagamento</Label>
        <RadioGroup
          value={paymentMethod}
          onValueChange={(v) => setPaymentMethod(v as 'stripe' | 'pix')}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="stripe" id="stripe" />
            <Label htmlFor="stripe">Cartão de crédito / débito</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="pix" id="pix" />
            <Label htmlFor="pix">PIX</Label>
          </div>
        </RadioGroup>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Processando...' : 'Continuar'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 11.4: Add RadioGroup shadcn component if needed**

```powershell
npx shadcn@latest add radio-group --yes
```

Expected: RadioGroup added to `src/components/ui/`.

- [ ] **Step 11.5: Commit**

```powershell
git add src/components/checkout/
git commit -m "feat(checkout-ui): checkout form, PIX display, Stripe card form"
```

---

## Task 12: Update Layout + PhotoGrid

**Files:**
- Modify: `src/app/[tenant]/layout.tsx` — add CartButton
- Modify: `src/app/[tenant]/evento/[slug]/_components/photo-grid.tsx` — add "Adicionar ao carrinho" button

- [ ] **Step 12.1: Add CartButton to tenant layout**

Read `src/app/[tenant]/layout.tsx`. Add CartButton import and add it to the nav. Replace the nav section:

```tsx
import { CartButton } from '@/components/cart/cart-button'

// Inside the nav, replace:
// <Button variant="outline" size="sm">Entrar</Button>
// With:
<div className="flex items-center gap-2">
  <ThemeToggle />
  <CartButton />
  <Button variant="outline" size="sm">
    Entrar
  </Button>
</div>
```

Full modified nav block:
```tsx
<nav className="border-b px-6 py-3 flex items-center justify-between">
  <span className="font-bold text-xl">{tenantData.name}</span>
  <div className="flex items-center gap-2">
    <ThemeToggle />
    <CartButton />
    <Button variant="outline" size="sm">
      Entrar
    </Button>
  </div>
</nav>
```

- [ ] **Step 12.2: Add "Adicionar ao carrinho" button to PhotoGrid**

Read `src/app/[tenant]/evento/[slug]/_components/photo-grid.tsx`. Add a cart button overlay on each photo card.

In the photo card rendering section, add a button that POSTs to `/api/cart`:

```tsx
// Inside photo card div, add after the img:
<button
  onClick={async (e) => {
    e.stopPropagation()
    await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: photo.id }),
    })
  }}
  className="absolute bottom-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
  aria-label="Adicionar ao carrinho"
>
  + Carrinho
</button>
```

Also add `group` class to the photo card's outer div to enable hover.

- [ ] **Step 12.3: Commit layout and photo-grid changes**

```powershell
git add src/app/[tenant]/layout.tsx src/app/[tenant]/evento/[slug]/_components/photo-grid.tsx
git commit -m "feat(ecommerce): cart button in nav, add-to-cart in photo grid"
```

---

## Task 13: Pages (Cart, Checkout, Order Confirmation)

**Files:**
- Create: `src/app/[tenant]/carrinho/page.tsx`
- Create: `src/app/[tenant]/checkout/page.tsx`
- Create: `src/app/[tenant]/pedido/[id]/page.tsx`

- [ ] **Step 13.1: Create cart page**

Create `src/app/[tenant]/carrinho/page.tsx`:

```tsx
import { CartDrawer } from '@/components/cart/cart-drawer'

// This page is just a redirect + auto-open cart drawer
// Cart is primarily accessed via the CartButton in the nav
export default function CarrinhoPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Carrinho</h1>
      <p className="text-muted-foreground">
        Abra o carrinho no canto superior direito para ver seus itens.
      </p>
    </div>
  )
}
```

- [ ] **Step 13.2: Create checkout page**

Create `src/app/[tenant]/checkout/page.tsx`:

```tsx
import { CheckoutForm } from '@/components/checkout/checkout-form'

export default function CheckoutPage() {
  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Finalizar Compra</h1>
      <CheckoutForm />
    </div>
  )
}
```

- [ ] **Step 13.3: Create order confirmation page**

Create `src/app/[tenant]/pedido/[id]/page.tsx`:

```tsx
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ tenant: string; id: string }> }

type OrderRow = {
  id: string
  status: string
  client_email: string
  total_cents: number
  payment_method: string
  created_at: string
}

type OrderItem = {
  id: string
  photo_id: string
  price_cents: number
}

export default async function PedidoPage({ params }: Props) {
  const { id } = await params
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error } = (await (adminClient as any)
    .from('orders')
    .select('id, status, client_email, total_cents, payment_method, created_at')
    .eq('id', id)
    .single()) as { data: OrderRow | null; error: { message: string } | null }

  if (error || !order) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderItems } = (await (adminClient as any)
    .from('order_items')
    .select('id, photo_id, price_cents')
    .eq('order_id', id)) as { data: OrderItem[] | null }

  const isPaid = order.status === 'paid'

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          {isPaid ? '✅ Pedido Confirmado' : '⏳ Aguardando Pagamento'}
        </h1>
        <p className="text-muted-foreground">Pedido #{order.id.slice(0, 8)}</p>
      </div>

      <div className="border rounded p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">E-mail</span>
          <span>{order.client_email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span>
            {(order.total_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pagamento</span>
          <span>{order.payment_method === 'pix' ? 'PIX' : 'Cartão'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className={isPaid ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
            {isPaid ? 'Pago' : 'Pendente'}
          </span>
        </div>
      </div>

      {isPaid && (
        <div className="space-y-3">
          <h2 className="font-semibold">Downloads</h2>
          <p className="text-sm text-muted-foreground">
            {orderItems?.length ?? 0} foto(s) disponíveis para download.
          </p>
          <a
            href={`/api/orders/${order.id}/download`}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium"
          >
            Baixar Fotos
          </a>
        </div>
      )}

      {!isPaid && (
        <p className="text-sm text-muted-foreground">
          Após o pagamento confirmado, seus downloads aparecerão aqui.
          Esta página atualiza automaticamente.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 13.4: Commit pages**

```powershell
git add src/app/[tenant]/carrinho/ src/app/[tenant]/checkout/ src/app/[tenant]/pedido/
git commit -m "feat(pages): cart, checkout, and order confirmation pages"
```

---

## Task 14: Run All Tests + Build Verification

- [ ] **Step 14.1: Run full test suite**

```powershell
npx jest --no-coverage
```

Expected: All tests pass (existing 47 + new ~19 = ~66 tests).

If any test fails, fix the issue before proceeding.

- [ ] **Step 14.2: TypeScript check**

```powershell
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 14.3: Production build**

```powershell
npx next build
```

Expected: Build completes successfully. New routes appear:
- `/api/cart` (GET, POST)
- `/api/cart/[photoId]` (DELETE)
- `/api/checkout` (POST)
- `/api/webhooks/stripe` (POST)
- `/api/webhooks/mercadopago` (POST)
- `/api/orders/[id]` (GET)
- `/api/orders/[id]/download` (GET)
- `/[tenant]/carrinho` (page)
- `/[tenant]/checkout` (page)
- `/[tenant]/pedido/[id]` (page)

- [ ] **Step 14.4: Final commit**

```powershell
git add -A
git commit -m "feat(plan-5): e-commerce complete — cart, checkout, payments, delivery"
```

---

## Self-Review

**Spec coverage:**
- ✅ Cart session (cookie-based UUID)
- ✅ Cart API (GET, POST, DELETE)
- ✅ Stripe payment integration (PaymentIntent + webhook)
- ✅ MercadoPago PIX integration (payment + webhook)
- ✅ Order creation + order items
- ✅ Signed URL delivery
- ✅ Cart UI (CartButton + CartDrawer)
- ✅ Checkout form (email + payment method selector)
- ✅ PIX display (QR code + copy code)
- ✅ Stripe Elements card form
- ✅ Cart page, Checkout page, Order confirmation page
- ✅ Add-to-cart button in photo grid
- ✅ CartButton in tenant layout nav

**Potential gaps:**
- Cart page is minimal (just a message) — cart is primarily accessed via the nav drawer. This is acceptable for MVP.
- No cart item count synced server-side on layout load — CartButton starts at 0 count. The count updates when drawer opens. This is acceptable for MVP.
- No ZIP download (single-photo signed URLs only). ZIP would be a BullMQ queue job (future enhancement).
- `orders` table needs `payment_provider_id`, `paid_at`, `client_email`, `payment_method` columns — these should exist in the schema from Plan 1 migrations, but verify before applying.

**Type consistency:**
- `CartItem` type used consistently in cart route and checkout
- `OrderRow` and `OrderItem` types defined locally in each page (no cross-file sharing needed)
- Payment functions return typed objects with camelCase properties consistently

**No placeholder scan:**
- All code blocks are complete
- No "TBD" or "TODO" comments
- All imports shown
