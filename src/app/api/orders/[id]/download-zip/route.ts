import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDownloadUrls } from '@/lib/delivery'
import { deflateRawSync } from 'zlib'

// ---------------------------------------------------------------------------
// Minimal ZIP builder — no external dependencies, uses Node built-in zlib
// Produces a valid ZIP file (PKZIP format) containing all provided files.
// ---------------------------------------------------------------------------

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

    // Local file header signature + fields
    const localHeader = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
      writeUint16LE(20),                       // version needed
      writeUint16LE(0x800),                    // flags (UTF-8)
      writeUint16LE(8),                        // compression method: deflate
      writeUint16LE(0),                        // last mod time
      writeUint16LE(0),                        // last mod date
      writeUint32LE(crc),                      // crc-32
      writeUint32LE(compressed.length),        // compressed size
      writeUint32LE(file.data.length),         // uncompressed size
      writeUint16LE(nameBytes.length),         // filename length
      writeUint16LE(0),                        // extra field length
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

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const nameBytes = Buffer.from(entry.filename, 'utf8')
    const centralHeader = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
      writeUint16LE(20),                       // version made by
      writeUint16LE(20),                       // version needed
      writeUint16LE(0x800),                    // flags (UTF-8)
      writeUint16LE(8),                        // compression method
      writeUint16LE(0),                        // last mod time
      writeUint16LE(0),                        // last mod date
      writeUint32LE(entry.crc),
      writeUint32LE(entry.compressed.length),
      writeUint32LE(entry.data.length),
      writeUint16LE(nameBytes.length),
      writeUint16LE(0),                        // extra field length
      writeUint16LE(0),                        // file comment length
      writeUint16LE(0),                        // disk number start
      writeUint16LE(0),                        // internal attributes
      writeUint32LE(0),                        // external attributes
      writeUint32LE(entry.offset),
      nameBytes,
    ])
    centralHeaders.push(centralHeader)
  }

  const centralDirSize = centralHeaders.reduce((s, b) => s + b.length, 0)

  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]), // end of central dir signature
    writeUint16LE(0),                        // disk number
    writeUint16LE(0),                        // disk with central dir
    writeUint16LE(entries.length),
    writeUint16LE(entries.length),
    writeUint32LE(centralDirSize),
    writeUint32LE(centralDirStart),
    writeUint16LE(0),                        // comment length
  ])

  const parts: Buffer[] = []
  for (let i = 0; i < entries.length; i++) {
    parts.push(localHeaders[i])
    parts.push(entries[i].compressed)
  }
  for (const ch of centralHeaders) {
    parts.push(ch)
  }
  parts.push(eocd)

  return Buffer.concat(parts)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminClient = createAdminClient()

  // Verify order exists and is paid
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
    .select('id, photo_id, price_cents')
    .eq('order_id', id)

  if (itemsError) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  const photoIds = (orderItems ?? []).map((item: { photo_id: string }) => item.photo_id)
  const downloadUrls = await generateDownloadUrls(photoIds)

  if (downloadUrls.length === 0) {
    return NextResponse.json({ error: 'Nenhuma foto disponível.' }, { status: 404 })
  }

  // Fetch all photos concurrently
  const fetchResults = await Promise.allSettled(
    downloadUrls.map(async ({ photoId, url }) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Falha ao buscar foto ${photoId}: ${res.status}`)
      const arrayBuffer = await res.arrayBuffer()
      return { photoId, data: Buffer.from(arrayBuffer) }
    })
  )

  const files: { name: string; data: Buffer }[] = []
  let index = 1
  for (const result of fetchResults) {
    if (result.status === 'fulfilled') {
      const ext = 'jpg' // photos are JPEGs
      files.push({ name: `foto_${String(index).padStart(3, '0')}.${ext}`, data: result.value.data })
      index++
    } else {
      console.error('[download-zip] fetch error:', result.reason)
    }
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
