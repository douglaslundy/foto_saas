/**
 * @jest-environment node
 */
import sharp from 'sharp'

// Creates a test image buffer 800x600 red before tests
let testImageBuffer: Buffer

beforeAll(async () => {
  testImageBuffer = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer()
})

describe('generateThumbnail', () => {
  it('redimensiona para no máximo 400px de largura', async () => {
    const { generateThumbnail } = await import('@/lib/image/resize')
    const result = await generateThumbnail(testImageBuffer)
    const { width } = await sharp(result).metadata()
    expect(width).toBeLessThanOrEqual(400)
  })

  it('mantém proporção (altura proporcional a 400px)', async () => {
    const { generateThumbnail } = await import('@/lib/image/resize')
    const result = await generateThumbnail(testImageBuffer)
    const { width, height } = await sharp(result).metadata()
    // 800x600 → 400x300 (razão 4:3)
    expect(width).toBe(400)
    expect(height).toBe(300)
  })

  it('retorna buffer JPEG válido', async () => {
    const { generateThumbnail } = await import('@/lib/image/resize')
    const result = await generateThumbnail(testImageBuffer)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
    const { format } = await sharp(result).metadata()
    expect(format).toBe('jpeg')
  })
})

describe('generatePreview', () => {
  it('redimensiona para no máximo 1200px de largura', async () => {
    const { generatePreview } = await import('@/lib/image/resize')
    const result = await generatePreview(testImageBuffer)
    const { width } = await sharp(result).metadata()
    expect(width).toBeLessThanOrEqual(1200)
  })

  it('não aumenta imagens menores que 1200px', async () => {
    const { generatePreview } = await import('@/lib/image/resize')
    // testImageBuffer is 800px — should not be enlarged
    const result = await generatePreview(testImageBuffer)
    const { width } = await sharp(result).metadata()
    expect(width).toBe(800)
  })

  it('retorna buffer JPEG válido', async () => {
    const { generatePreview } = await import('@/lib/image/resize')
    const result = await generatePreview(testImageBuffer)
    const { format } = await sharp(result).metadata()
    expect(format).toBe('jpeg')
  })
})
