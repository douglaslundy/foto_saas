import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildZip } from '@/lib/zip'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminClient = createAdminClient()

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderItems, error: itemsError } = await (adminClient as any)
    .from('order_items')
    .select('id, photo_id, price_cents')
    .eq('order_id', id)

  if (itemsError) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  const photoIds = (orderItems ?? []).map((item: { photo_id: string }) => item.photo_id)
  if (photoIds.length === 0) {
    return NextResponse.json({ error: 'Nenhuma foto disponível.' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, error: photosError } = await (adminClient as any)
    .from('photos')
    .select('id, original_storage_path, public_storage_path')
    .in('id', photoIds)

  if (photosError || !photos) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  const files: { name: string; data: Buffer }[] = []

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i] as { id: string; original_storage_path: string | null; public_storage_path: string | null }
    const bucket = 'photos-original'
    const storagePath = photo.original_storage_path

    if (!storagePath) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: downloadError } = await (adminClient as any).storage
      .from(bucket)
      .download(storagePath)

    if (downloadError || !data) {
      console.error('[download-zip] storage download error:', photo.id, downloadError)
      continue
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    files.push({ name: `foto_${String(i + 1).padStart(3, '0')}.jpg`, data: buffer })
  }

  if (files.length === 0) {
    return NextResponse.json({ error: 'Não foi possível gerar o ZIP.' }, { status: 500 })
  }

  const zipBuffer = buildZip(files)
  const orderSlug = id.slice(0, 8)

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="fotos-pedido-${orderSlug}.zip"`,
      'Content-Length': String(zipBuffer.length),
    },
  })
}
