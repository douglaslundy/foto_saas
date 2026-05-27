import sharp from 'sharp'

export type WatermarkPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'tiled'

export type WatermarkConfig = {
  type: 'text' | 'image'
  text_content?: string | null
  font?: string | null
  font_size?: number | null
  color: string
  opacity: number
  position: WatermarkPosition
  image_size_percent: number
}

export function positionToGravity(
  position: Exclude<WatermarkPosition, 'tiled'>
): string {
  const map: Record<Exclude<WatermarkPosition, 'tiled'>, string> = {
    'top-left': 'northwest',
    'top-center': 'north',
    'top-right': 'northeast',
    'middle-left': 'west',
    'center': 'center',
    'middle-right': 'east',
    'bottom-left': 'southwest',
    'bottom-center': 'south',
    'bottom-right': 'southeast',
  }
  return map[position]
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case "'": return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

async function buildTextSvg(
  width: number,
  height: number,
  config: WatermarkConfig,
  tiled = false
): Promise<Buffer> {
  const text = config.text_content ?? ''
  const fontSize = config.font_size ?? 24
  const font = config.font ?? 'Arial'
  const color = config.color
  const opacity = config.opacity

  if (tiled) {
    const patternW = Math.max(text.length * fontSize * 0.6, 80)
    const patternH = fontSize * 2.5
    return Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="wm" width="${patternW}" height="${patternH}"
            patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
            <text x="10" y="${fontSize + 4}" font-family="${font}" font-size="${fontSize}px"
              fill="${color}" opacity="${opacity}">${escapeXml(text)}</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wm)"/>
      </svg>`
    )
  }

  const positions: Record<Exclude<WatermarkPosition, 'tiled'>, { x: string; y: string; anchor: string }> = {
    'top-left':      { x: '2%',  y: `${fontSize + 8}px`, anchor: 'start' },
    'top-center':    { x: '50%', y: `${fontSize + 8}px`, anchor: 'middle' },
    'top-right':     { x: '98%', y: `${fontSize + 8}px`, anchor: 'end' },
    'middle-left':   { x: '2%',  y: '50%',               anchor: 'start' },
    'center':        { x: '50%', y: '50%',               anchor: 'middle' },
    'middle-right':  { x: '98%', y: '50%',               anchor: 'end' },
    'bottom-left':   { x: '2%',  y: `${height - 8}px`,   anchor: 'start' },
    'bottom-center': { x: '50%', y: `${height - 8}px`,   anchor: 'middle' },
    'bottom-right':  { x: '98%', y: `${height - 8}px`,   anchor: 'end' },
  }

  const pos = positions[config.position as Exclude<WatermarkPosition, 'tiled'>] ?? positions['bottom-right']

  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${pos.x}" y="${pos.y}" font-family="${font}" font-size="${fontSize}px"
        fill="${color}" opacity="${opacity}" text-anchor="${pos.anchor}">${escapeXml(text)}</text>
    </svg>`
  )
}

export async function applyWatermark(
  imageBuffer: Buffer,
  config: WatermarkConfig,
  watermarkImageBuffer?: Buffer
): Promise<Buffer> {
  const { width = 800, height = 600 } = await sharp(imageBuffer).metadata()

  if (config.type === 'text') {
    const text = config.text_content ?? ''
    if (!text.trim()) {
      return sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer()
    }
    const svg = await buildTextSvg(width, height, config, config.position === 'tiled')
    return sharp(imageBuffer)
      .composite([{ input: svg, top: 0, left: 0 }])
      .jpeg({ quality: 85 })
      .toBuffer()
  }

  // Image watermark
  if (!watermarkImageBuffer) {
    return sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer()
  }

  const wmarkSize = Math.round(Math.min(width, height) * (config.image_size_percent / 100))
  const resizedWmark = await sharp(watermarkImageBuffer)
    .resize(wmarkSize, wmarkSize, { fit: 'inside' })
    .png()
    .toBuffer()

  const { width: wW = wmarkSize, height: wH = wmarkSize } = await sharp(resizedWmark).metadata()

  // Wrap in SVG to apply opacity
  const base64 = resizedWmark.toString('base64')
  const svgWithOpacity = Buffer.from(
    `<svg width="${wW}" height="${wH}" xmlns="http://www.w3.org/2000/svg">
      <image href="data:image/png;base64,${base64}"
        width="${wW}" height="${wH}" opacity="${config.opacity}"/>
    </svg>`
  )

  const gravity = config.position === 'tiled'
    ? 'center'
    : positionToGravity(config.position as Exclude<WatermarkPosition, 'tiled'>)

  return sharp(imageBuffer)
    .composite([{ input: svgWithOpacity, gravity }])
    .jpeg({ quality: 85 })
    .toBuffer()
}
