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

// Construtor de ZIP sem dependências externas (STORE/DEFLATE via zlib nativo do Node).
// Usado para downloads sob demanda (pedidos pagos, seleção de ensaio, entrega final).
export function buildZip(files: { name: string; data: Buffer }[]): Buffer {
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
