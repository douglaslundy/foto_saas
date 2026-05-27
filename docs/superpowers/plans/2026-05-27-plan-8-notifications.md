# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Send email notifications for key events — order confirmation to clients, new sale to photographers — using a lightweight nodemailer SMTP helper. WhatsApp is out of scope for MVP (requires approved Business API account).

**Architecture:** A thin `src/lib/notifications/email.ts` module wraps nodemailer. Called directly from webhook handlers after marking orders as paid. No queue needed — email sending is fast enough to be inline. Env vars configure SMTP (supports any provider: Resend, SendGrid, Mailgun, or self-hosted).

**Tech Stack:** nodemailer, Next.js API routes (webhooks already exist), existing Supabase admin client.

---

## File Map

**New files:**
- `src/lib/notifications/email.ts` — nodemailer SMTP wrapper with `sendOrderConfirmation` and `sendSaleNotification`

**Modified files:**
- `src/app/api/webhooks/stripe/route.ts` — call `sendOrderConfirmation` + `sendSaleNotification` after marking paid
- `src/app/api/webhooks/mercadopago/route.ts` — same
- `src/lib/env.ts` — add SMTP env vars

---

## Task 1: Install nodemailer

- [ ] **Step 1.1: Install nodemailer and types**

```powershell
npm install nodemailer @types/nodemailer
```

- [ ] **Step 1.2: Add SMTP env vars to env.ts**

Add to `src/lib/env.ts`:
```typescript
SMTP_HOST: process.env.SMTP_HOST ?? '',
SMTP_PORT: parseInt(process.env.SMTP_PORT ?? '587', 10),
SMTP_USER: process.env.SMTP_USER ?? '',
SMTP_PASS: process.env.SMTP_PASS ?? '',
SMTP_FROM: process.env.SMTP_FROM ?? 'noreply@fotosaas.com',
```

- [ ] **Step 1.3: Commit**

```powershell
git add package.json package-lock.json src/lib/env.ts
git commit -m "feat(notifications): install nodemailer, add SMTP env vars"
```

---

## Task 2: Email Library (TDD)

**Files:**
- Create: `src/lib/notifications/email.ts`
- Create: `__tests__/lib/notifications/email.test.ts`

- [ ] **Step 2.1: Write failing test**

Create `__tests__/lib/notifications/email.test.ts`:

```typescript
/**
 * @jest-environment node
 */

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' })
const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail })

jest.mock('nodemailer', () => ({
  createTransport: mockCreateTransport,
}))

import { sendOrderConfirmation, sendSaleNotification } from '@/lib/notifications/email'

describe('email notifications', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sendOrderConfirmation calls sendMail with client email', async () => {
    await sendOrderConfirmation({
      to: 'cliente@email.com',
      orderId: 'order-123',
      totalCents: 4000,
      downloadUrl: 'https://app.com/pedido/order-123',
    })

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'cliente@email.com',
        subject: expect.stringContaining('Pedido'),
        html: expect.stringContaining('order-123'),
      })
    )
  })

  it('sendSaleNotification calls sendMail with photographer email', async () => {
    await sendSaleNotification({
      to: 'fotografo@email.com',
      orderId: 'order-123',
      totalCents: 4000,
      clientEmail: 'cliente@email.com',
    })

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'fotografo@email.com',
        subject: expect.stringContaining('venda'),
        html: expect.stringContaining('cliente@email.com'),
      })
    )
  })

  it('does not throw when SMTP is not configured', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('Connection refused'))

    await expect(
      sendOrderConfirmation({
        to: 'cliente@email.com',
        orderId: 'order-123',
        totalCents: 2000,
        downloadUrl: 'https://app.com/pedido/order-123',
      })
    ).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2.2: Run test to verify it fails**

```powershell
npx jest __tests__/lib/notifications/email.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement email.ts**

Create `src/lib/notifications/email.ts`:

```typescript
import nodemailer from 'nodemailer'

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

const FROM = process.env.SMTP_FROM ?? 'noreply@fotosaas.com'

export async function sendOrderConfirmation({
  to,
  orderId,
  totalCents,
  downloadUrl,
}: {
  to: string
  orderId: string
  totalCents: number
  downloadUrl: string
}): Promise<void> {
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
      to,
      subject: `Pedido confirmado — #${orderId.slice(0, 8)}`,
      html: `
        <h2>Seu pedido foi confirmado! 🎉</h2>
        <p>Pedido: <strong>#${orderId}</strong></p>
        <p>Total: <strong>${(totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
        <p>Acesse seus downloads: <a href="${downloadUrl}">${downloadUrl}</a></p>
        <p>O link expira em 24 horas.</p>
      `,
    })
  } catch (err) {
    console.error('[email] sendOrderConfirmation failed:', err)
    // Do not re-throw — email failure should not break payment flow
  }
}

export async function sendSaleNotification({
  to,
  orderId,
  totalCents,
  clientEmail,
}: {
  to: string
  orderId: string
  totalCents: number
  clientEmail: string
}): Promise<void> {
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
      to,
      subject: `Nova venda — ${(totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      html: `
        <h2>Você teve uma nova venda! 💰</h2>
        <p>Pedido: <strong>#${orderId}</strong></p>
        <p>Cliente: <strong>${clientEmail}</strong></p>
        <p>Valor: <strong>${(totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
      `,
    })
  } catch (err) {
    console.error('[email] sendSaleNotification failed:', err)
  }
}
```

- [ ] **Step 2.4: Run test to verify it passes**

```powershell
npx jest __tests__/lib/notifications/email.test.ts --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 2.5: Commit**

```powershell
git add src/lib/notifications/ __tests__/lib/notifications/
git commit -m "feat(notifications): email notification library"
```

---

## Task 3: Integrate Notifications into Webhooks

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`
- Modify: `src/app/api/webhooks/mercadopago/route.ts`

After marking order as paid, fetch order + photographer email, send both emails.

- [ ] **Step 3.1: Update Stripe webhook to send emails**

In `src/app/api/webhooks/stripe/route.ts`, after updating order status, add:

```typescript
import { sendOrderConfirmation, sendSaleNotification } from '@/lib/notifications/email'

// ... after updating order status:

// Fetch order details for notifications
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data: order } = await (adminClient as any)
  .from('orders')
  .select('client_email, total_cents, order_items(event_id, events(tenant_id, tenants(users(email, role))))')
  .eq('id', orderId)
  .single()

if (order) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const downloadUrl = `${appUrl}/pedido/${orderId}`

  // Notify client
  await sendOrderConfirmation({
    to: order.client_email,
    orderId,
    totalCents: order.total_cents,
    downloadUrl,
  })

  // Notify photographer — find the main photographer email via tenant
  // (This join is complex; use a simpler query in the actual implementation)
}
```

- [ ] **Step 3.2: Implement simplified webhook notification helper**

Rather than a complex join, fetch emails separately. Update `src/app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyStripeWebhook } from '@/lib/payments/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrderConfirmation, sendSaleNotification } from '@/lib/notifications/email'

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

      // Mark order as paid
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any)
        .from('orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', orderId)

      // Send notifications
      await sendNotificationsForOrder(adminClient, orderId)
    }
  }

  return NextResponse.json({ received: true })
}

async function sendNotificationsForOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  orderId: string
) {
  // Fetch order
  const { data: order } = await adminClient
    .from('orders')
    .select('client_email, total_cents, order_items(event_id)')
    .eq('id', orderId)
    .single()

  if (!order) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // Notify client
  await sendOrderConfirmation({
    to: order.client_email,
    orderId,
    totalCents: order.total_cents,
    downloadUrl: `${appUrl}/pedido/${orderId}`,
  })

  // Find event and tenant to notify photographer
  const eventId = order.order_items?.[0]?.event_id
  if (!eventId) return

  const { data: event } = await adminClient
    .from('events')
    .select('tenant_id')
    .eq('id', eventId)
    .single()

  if (!event?.tenant_id) return

  const { data: photographer } = await adminClient
    .from('users')
    .select('email')
    .eq('tenant_id', event.tenant_id)
    .eq('role', 'photographer')
    .single()

  if (photographer?.email) {
    await sendSaleNotification({
      to: photographer.email,
      orderId,
      totalCents: order.total_cents,
      clientEmail: order.client_email,
    })
  }
}
```

- [ ] **Step 3.3: Apply same notification pattern to MercadoPago webhook**

In `src/app/api/webhooks/mercadopago/route.ts`, import and call `sendNotificationsForOrder` after marking order as paid. Add the same helper function or import from a shared location.

Since `sendNotificationsForOrder` is specific to webhooks, duplicate it in the MP webhook file (YAGNI — extracting to shared lib is premature).

- [ ] **Step 3.4: Run all tests**

```powershell
npx jest --no-coverage
```

Expected: All tests pass (webhook tests mock the email module, so no SMTP calls are made).

- [ ] **Step 3.5: Build verification**

```powershell
npx next build
```

- [ ] **Step 3.6: Commit**

```powershell
git add -A
git commit -m "feat(plan-8): email notifications for orders"
```
