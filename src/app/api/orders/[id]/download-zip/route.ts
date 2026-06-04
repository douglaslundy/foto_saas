import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deflateRawSync } from 'zlib'

function crc32(buf: Buffer): number {
  const table = makeCrc32Table()
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

let _crc32Table: Uint32Array | null = null
function makeCrc32Table(): Uint32Array {
  if (_crc32Table) return _crc32Table
  _crc32Table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    _crc32Table[i] = c
  }
  return _crc32Table
}

function writeUint16LE(n: number): Buffer {
  const b = Buffer.allocUnsafe(2)
  b.writeUInt16LE(n, 0)
  return b
}

function writeUint32LE(n: number): Buffer {
  const b = Buffer.allocUnsafe(4)
  b.writeUInt32LE(n >>> 0, 0)
  return b
}

interface ZipEntry {
  filename: string
  data: Buffer
  compressed: Buffer
  crc: number
  offset: number
}

function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const entries: ZipEntry[] = []
  const localHeaders: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, 'utf8')
    const crc = crc32(file.data)
    const compressed = deflateRawSync(file.data, { level: 6 })

    const localHeader = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      writeUint16LE(20),
      writeUint16LE(0x800),
      writeUint16LE(8),
      writeUint16LE(0),
      writeUint16LE(0),
      writeUint32LE(crc),
      writeUint32LE(compressed.length),
      writeUint32LE(file.data.length),
      writeUint16LE(nameBytes.length),
      writeUint16LE(0),
      nameBytes,
    ])

    entries.push({
      filename: file.name,
      data: file.data,
      compressed,
      crc,
      offset,
    })

    localHeaders.push(localHeader)
    offset += localHeader.length + compressed.length
  }

  const centralDirStart = offset
  const centralHeaders: Buffer[] = []

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.filename, 'utf8')
    const centralHeader = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
      writeUint16LE(20),
      writeUint16LE(20),
      writeUint16LE(0x800),
      writeUint16LE(8),
      writeUint16LE(0),
      writeUint16LE(0),
      writeUint32LE(entry.crc),
      writeUint32LE(entry.compressed.length),
      writeUint32LE(entry.data.length),
      writeUint16LE(nameBytes.length),
      writeUint16LE(0),
      writeUint16LE(0),
      writeUint16LE(0),
      writeUint16LE(0),
      writeUint32LE(0),
      writeUint32LE(entry.offset),
      nameBytes,
    ])
    centralHeaders.push(centralHeader)
  }

  const centralDirSize = centralHeaders.reduce((s, b) => s + b.length, 0)

  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    writeUint16LE(0),
    writeUint16LE(0),
    writeUint16LE(entries.length),
    writeUint16LE(entries.length),
    writeUint32LE(centralDirSize),
    writeUint32LE(centralDirStart),
    writeUint16LE(0),
  ])

  return Buffer.concat([...localHeaders.flatMap((header, index) => [header, entries[index].compressed]), ...centralHeaders, eocd])
}

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
    const bucket = photo.public_storage_path ? 'photos-public' : 'photos-original'
    const storagePath = photo.public_storage_path ?? photo.original_storage_path

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
