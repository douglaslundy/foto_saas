import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEssaySubmitted } from '@/lib/notifications/email'
import { createStripePaymentIntent } from '@/lib/payments/stripe'
import { createMercadoPagoPix } from '@/lib/payments/mercadopago'

type Props = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, client_id, tenant_id, status, magic_link_expires_at')
    .eq('id', id)
    .single() as { data: {
      id: string; event_id: string; client_id: string; tenant_id: string;
      status: string; magic_link_expires_at: string;
    } | null }

  if (!review) return NextResponse.json({ error: 'Review não encontrado.' }, { status: 404 })
  if (review.client_id !== user.id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  if (review.status === 'submitted') return NextResponse.json({ error: 'Seleção já enviada.' }, { status: 409 })
  if (new Date(review.magic_link_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expirado.' }, { status: 410 })
  }

  let body: { selected_photo_ids?: string[]; notes?: string; payment_method?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { selected_photo_ids = [], notes, payment_method = 'manual' } = body

  if (!Array.isArray(selected_photo_ids) || selected_photo_ids.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos uma foto.' }, { status: 400 })
  }

  if (!['stripe', 'pix', 'manual'].includes(payment_method)) {
    return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, title, price_cents, tenant_id')
    .eq('id', review.event_id)
    .single() as { data: { id: string; title: string; price_cents: number; tenant_id: string } | null }

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })

  // Validate all photo IDs belong to this event and are ready
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: validPhotos } = await (admin as any)
    .from('photos')
    .select('id')
    .eq('event_id', review.event_id)
    .eq('status', 'ready')
    .in('id', selected_photo_ids) as { data: { id: string }[] | null }

  const validPhotoIds = (validPhotos ?? []).map((p) => p.id)
  const verifiedIds = selected_photo_ids.filter((id) => validPhotoIds.includes(id))

  if (verifiedIds.length === 0) {
    return NextResponse.json({ error: 'Nenhuma foto válida selecionada.' }, { status: 400 })
  }

  // Use verified IDs for price calculation and storage
  const verifiedPhotoIds = verifiedIds

  // Calculate total with package discount
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packages } = await (admin as any)
    .from('photo_packages')
    .select('name, min_quantity, discount_percent')
    .eq('tenant_id', review.tenant_id)
    .eq('active', true)
    .order('min_quantity', { ascending: false }) as
    { data: { name: string; min_quantity: number; discount_percent: number }[] | null }

  const subtotal = (event.price_cents ?? 0) * verifiedPhotoIds.length
  const matchedPackage = (packages ?? []).find((p) => verifiedPhotoIds.length >= p.min_quantity)
  const discountCents = matchedPackage ? Math.round(subtotal * matchedPackage.discount_percent / 100) : 0
  const totalCents = subtotal - discountCents

  // Process payment
  let paymentIntentId: string | null = null
  let stripeClientSecret: string | null = null
  let pixQrCode: string | null = null
  let pixQrCodeBase64: string | null = null
  let resolvedPaymentStatus = 'pending'

  if (payment_method === 'stripe' && totalCents > 0) {
    try {
      const intent = await createStripePaymentIntent({
        amountCents: totalCents,
        currency: 'brl',
        metadata: { review_id: review.id, event_id: review.event_id },
      })
      paymentIntentId = intent.paymentIntentId
      stripeClientSecret = intent.clientSecret
    } catch (err) {
      console.error('[submit] Stripe error:', err)
      return NextResponse.json({ error: 'Erro ao processar pagamento.' }, { status: 500 })
    }
  } else if (payment_method === 'pix' && totalCents > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientRow } = await (admin as any)
      .from('users').select('email').eq('id', user.id).single() as
      { data: { email: string } | null }
    try {
      const pix = await createMercadoPagoPix({
        amountCents: totalCents,
        description: event.title,
        payerEmail: clientRow?.email ?? '',
        orderId: review.id,
      })
      paymentIntentId = pix.paymentId
      pixQrCode = pix.pixQrCode
      pixQrCodeBase64 = pix.pixQrCodeBase64
    } catch (err) {
      console.error('[submit] PIX error:', err)
      return NextResponse.json({ error: 'Erro ao gerar PIX.' }, { status: 500 })
    }
  } else if (payment_method === 'manual') {
    resolvedPaymentStatus = 'manual'
  }

  // Update review
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (admin as any)
    .from('essay_reviews')
    .update({
      status: 'submitted',
      selected_photo_ids: verifiedPhotoIds,
      notes: notes ?? null,
      submitted_at: new Date().toISOString(),
      payment_status: resolvedPaymentStatus,
      payment_intent_id: paymentIntentId,
    })
    .eq('id', review.id)

  if (updateError) {
    console.error('[submit] DB update failed after payment:', updateError)
    return NextResponse.json({
      error: 'Seleção registrada mas erro ao salvar. Entre em contato com o fotógrafo.',
    }, { status: 500 })
  }

  // Notify photographer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photographerData } = await (admin as any)
    .from('users')
    .select('email, name')
    .eq('tenant_id', review.tenant_id)
    .in('role', ['photographer', 'admin'])
    .order('created_at', { ascending: true })
    .limit(1)
    .single() as { data: { email: string; name: string } | null }

  if (photographerData) {
    const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/dashboard/eventos/${review.event_id}/fotos`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientProfile } = await (admin as any)
      .from('users').select('name').eq('id', user.id).single() as
      { data: { name: string } | null }

    await sendEssaySubmitted({
      to: photographerData.email,
      clientName: clientProfile?.name ?? 'Cliente',
      sessionTitle: event.title,
      selectedCount: verifiedPhotoIds.length,
      dashboardUrl,
    })
  }

  return NextResponse.json({
    success: true,
    payment_method,
    total_cents: totalCents,
    stripe_client_secret: stripeClientSecret,
    pix_qr_code: pixQrCode,
    pix_qr_code_base64: pixQrCodeBase64,
  })
}
