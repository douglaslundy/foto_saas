import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCartSession } from '@/lib/cart-session'
import { createStripePaymentIntent } from '@/lib/payments/stripe'
import { createMercadoPagoPix } from '@/lib/payments/mercadopago'
import { getMercadoPagoAccessToken } from '@/lib/payments/mercadopago-settings'

type CartItem = {
  id: string
  photo_id: string
  event_id: string
  price_cents: number
}

type PackageRow = {
  name: string
  min_quantity: number
  discount_percent: number
}

export async function POST(request: NextRequest) {
  const { sessionId } = await getOrCreateCartSession()

  // Resolve logged-in user (if any) to attach to the order
  const serverSupabase = await createClient()
  const { data: { user: loggedInUser } } = await serverSupabase.auth.getUser()
  const clientUserId = loggedInUser?.id ?? null

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
  const subtotalCents = items.reduce((sum: number, i: CartItem) => sum + i.price_cents, 0)

  // Determine applicable package discount
  let discountCents = 0
  let packageName: string | null = null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (adminClient as any)
    .from('events')
    .select('tenant_id')
    .eq('id', items[0].event_id)
    .single() as { data: { tenant_id: string } | null }

  if (event?.tenant_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: packages } = await (adminClient as any)
      .from('photo_packages')
      .select('name, min_quantity, discount_percent')
      .eq('tenant_id', event.tenant_id)
      .eq('active', true)
      .order('min_quantity', { ascending: false }) as { data: PackageRow[] | null }

    if (packages) {
      const matched = packages.find((pkg) => items.length >= pkg.min_quantity)
      if (matched) {
        discountCents = Math.round(subtotalCents * matched.discount_percent / 100)
        packageName = matched.name
      }
    }
  }

  const totalCents = subtotalCents - discountCents

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: orderError } = await (adminClient as any)
    .from('orders')
    .insert({
      client_user_id: clientUserId,
      client_email: email,
      total_cents: totalCents,
      discount_cents: discountCents,
      package_applied: packageName,
      status: 'pending',
      payment_method: paymentMethod,
    })
    .select()
    .single()

  if (orderError) {
    console.error('[POST /api/checkout] order insert', orderError)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

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

  if (paymentMethod === 'stripe') {
    const stripeKey = process.env.STRIPE_SECRET_KEY ?? ''
    if (!stripeKey || stripeKey.includes('placeholder') || (!stripeKey.startsWith('sk_') && !stripeKey.startsWith('rk_'))) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any).from('orders').delete().eq('id', order.id)
      return NextResponse.json(
        { error: 'Pagamento com cartão não está configurado. Use PIX ou contate o suporte.' },
        { status: 503 }
      )
    }

    try {
      const { paymentIntentId, clientSecret } = await createStripePaymentIntent({
        amountCents: totalCents,
        currency: 'brl',
        metadata: { orderId: order.id },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any)
        .from('orders')
        .update({ payment_provider_id: paymentIntentId })
        .eq('id', order.id)

      return NextResponse.json({ orderId: order.id, paymentMethod: 'stripe', clientSecret }, { status: 201 })
    } catch (err) {
      console.error('[POST /api/checkout] stripe error', err)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any).from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: 'Erro ao processar pagamento com cartão. Tente PIX.' }, { status: 500 })
    }
  } else {
    const mpToken = await getMercadoPagoAccessToken()
    if (!mpToken) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any).from('orders').delete().eq('id', order.id)
      return NextResponse.json(
        { error: 'PIX não está configurado. Use cartão ou contate o suporte.' },
        { status: 503 }
      )
    }

    try {
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

      return NextResponse.json({ orderId: order.id, paymentMethod: 'pix', pixQrCode, pixQrCodeBase64 }, { status: 201 })
    } catch (err) {
      console.error('[POST /api/checkout] mercadopago error', err)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any).from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: 'Erro ao gerar PIX. Tente novamente.' }, { status: 500 })
    }
  }
}
