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
