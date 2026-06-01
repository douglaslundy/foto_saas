import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCartSession } from '@/lib/cart-session'

type PackageRow = {
  name: string
  min_quantity: number
  discount_percent: number
}

type CartItemRow = {
  id: string
  photo_id: string
  event_id: string
  price_cents: number
  photos?: { public_storage_path: string | null }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const { sessionId } = await getOrCreateCartSession()
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items, error } = await (adminClient as any)
    .from('cart_items')
    .select('id, photo_id, event_id, price_cents, photos(public_storage_path)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true }) as { data: CartItemRow[] | null; error: unknown }

  if (error) {
    console.error('[GET /api/cart]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  const cartItems = items ?? []
  const subtotal_cents = cartItems.reduce((sum, i) => sum + i.price_cents, 0)

  // Determine applicable package discount
  let appliedPackage: { name: string; discount_percent: number; min_quantity: number } | null = null
  let discount_cents = 0

  if (cartItems.length > 0) {
    // Get tenant_id from the first item's event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: event } = await (adminClient as any)
      .from('events')
      .select('tenant_id')
      .eq('id', cartItems[0].event_id)
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
        const matched = packages.find((pkg) => cartItems.length >= pkg.min_quantity)
        if (matched) {
          appliedPackage = {
            name: matched.name,
            discount_percent: matched.discount_percent,
            min_quantity: matched.min_quantity,
          }
          discount_cents = Math.round(subtotal_cents * matched.discount_percent / 100)
        }
      }
    }
  }

  const total_cents = subtotal_cents - discount_cents

  return NextResponse.json({
    items: cartItems,
    package: appliedPackage,
    subtotal_cents,
    discount_cents,
    total_cents,
  })
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
