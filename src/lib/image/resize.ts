import sharp from 'sharp'

export async function generateThumbnail(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(400, undefined, { withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: 80, progressive: true })
    .toBuffer()
}

export async function generatePreview(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(1200, undefined, { withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer()
}
