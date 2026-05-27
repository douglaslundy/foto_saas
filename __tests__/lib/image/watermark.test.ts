/**
 * @jest-environment node
 */
import sharp from 'sharp'

let testImageBuffer: Buffer

beforeAll(async () => {
  testImageBuffer = await sharp({
    create: { width: 600, height: 400, channels: 3, background: { r: 150, g: 180, b: 200 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer()
})

describe('applyWatermark — texto', () => {
  it('retorna buffer diferente da imagem original (watermark foi aplicado)', async () => {
    const { applyWatermark } = await import('@/lib/image/watermark')
    const config = {
      type: 'text' as const,
      text_content: 'FotoSaaS',
      font: 'Arial',
      font_size: 32,
      color: '#ffffff',
      opacity: 0.7,
      position: 'bottom-right' as const,
      image_size_percent: 20,
    }
    const result = await applyWatermark(testImageBuffer, config)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
    expect(result.equals(testImageBuffer)).toBe(false)
  })

  it('aceita posição tiled e retorna buffer JPEG válido', async () => {
    const { applyWatermark } = await import('@/lib/image/watermark')
    const config = {
      type: 'text' as const,
      text_content: 'Copyright',
      font: 'sans-serif',
      font_size: 20,
      color: '#000000',
      opacity: 0.3,
      position: 'tiled' as const,
      image_size_percent: 20,
    }
    const result = await applyWatermark(testImageBuffer, config)
    const { format } = await sharp(result).metadata()
    expect(format).toBe('jpeg')
  })

  it('retorna imagem convertida para JPEG quando text_content está vazio', async () => {
    const { applyWatermark } = await import('@/lib/image/watermark')
    const config = {
      type: 'text' as const,
      text_content: '',
      font: 'Arial',
      font_size: 24,
      color: '#ffffff',
      opacity: 0.5,
      position: 'center' as const,
      image_size_percent: 20,
    }
    const result = await applyWatermark(testImageBuffer, config)
    const { format } = await sharp(result).metadata()
    expect(format).toBe('jpeg')
  })
})

describe('applyWatermark — imagem PNG', () => {
  it('aplica watermark PNG e retorna buffer JPEG válido', async () => {
    const { applyWatermark } = await import('@/lib/image/watermark')

    const watermarkBuffer = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.5 } },
    })
      .png()
      .toBuffer()

    const config = {
      type: 'image' as const,
      color: '#ffffff',
      opacity: 0.6,
      position: 'bottom-right' as const,
      image_size_percent: 15,
    }
    const result = await applyWatermark(testImageBuffer, config, watermarkBuffer)
    expect(result).toBeInstanceOf(Buffer)
    const { format } = await sharp(result).metadata()
    expect(format).toBe('jpeg')
  })
})

describe('positionToGravity', () => {
  it('mapeia todas as 9 posições para gravity do Sharp', async () => {
    const { positionToGravity } = await import('@/lib/image/watermark')
    const positions = [
      'top-left', 'top-center', 'top-right',
      'middle-left', 'center', 'middle-right',
      'bottom-left', 'bottom-center', 'bottom-right',
    ] as const
    for (const pos of positions) {
      expect(positionToGravity(pos)).toBeTruthy()
    }
  })
})
