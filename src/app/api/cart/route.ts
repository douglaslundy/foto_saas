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
