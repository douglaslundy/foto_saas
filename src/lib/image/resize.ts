import sharp from 'sharp'

// Aplica a orientação EXIF (fotos tiradas na vertical) e, opcionalmente,
// uma rotação manual adicional escolhida pelo fotógrafo (photos.rotation_degrees).
export async function normalizeOrientation(input: Buffer, extraRotationDegrees = 0): Promise<Buffer> {
  const autoOriented = await sharp(input).rotate().toBuffer()
  if (extraRotationDegrees % 360 === 0) return autoOriented
  return sharp(autoOriented).rotate(extraRotationDegrees).toBuffer()
}

export async function generateThumbnail(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(400, undefined, { withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toBuffer()
}

// compress=true (padrão da plataforma): redimensiona para exibição/venda e usa mozjpeg
// para reduzir o tamanho do arquivo sem perda visível de qualidade.
// compress=false: mantém a resolução e qualidade máxima do original (câmeras profissionais),
// sem redimensionar — arquivos maiores, sem perda alguma além da já aplicada pela marca d'água.
export async function generatePreview(input: Buffer, compress: boolean): Promise<Buffer> {
  if (!compress) {
    return sharp(input)
      .rotate()
      .jpeg({ quality: 100, mozjpeg: true })
      .toBuffer()
  }
  return sharp(input)
    .rotate()
    .resize(1200, undefined, { withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: 85, progressive: true, mozjpeg: true })
    .toBuffer()
}
