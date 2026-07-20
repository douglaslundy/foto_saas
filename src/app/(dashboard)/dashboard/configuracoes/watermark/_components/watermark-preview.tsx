'use client'

import { useId, useMemo } from 'react'

type Position =
  | 'tiled'
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

interface WatermarkPreviewProps {
  type: 'text' | 'image'
  textContent: string
  font: string
  fontSize: number
  fontWeight: number
  color: string
  opacity: number
  position: Position
  spacingX: number
  spacingY: number
  imageUrl: string | null
  imageSizePercent: number
}

const TEXT_POSITIONS: Record<Exclude<Position, 'tiled'>, { x: string; y: string; anchor: 'start' | 'middle' | 'end' }> = {
  'top-left': { x: '3%', y: '10%', anchor: 'start' },
  'top-center': { x: '50%', y: '10%', anchor: 'middle' },
  'top-right': { x: '97%', y: '10%', anchor: 'end' },
  'middle-left': { x: '3%', y: '50%', anchor: 'start' },
  'center': { x: '50%', y: '50%', anchor: 'middle' },
  'middle-right': { x: '97%', y: '50%', anchor: 'end' },
  'bottom-left': { x: '3%', y: '92%', anchor: 'start' },
  'bottom-center': { x: '50%', y: '92%', anchor: 'middle' },
  'bottom-right': { x: '97%', y: '92%', anchor: 'end' },
}

const IMAGE_POSITIONS: Record<Exclude<Position, 'tiled'>, { x: string; y: string }> = {
  'top-left': { x: '4%', y: '4%' },
  'top-center': { x: '50%', y: '4%' },
  'top-right': { x: '96%', y: '4%' },
  'middle-left': { x: '4%', y: '50%' },
  'center': { x: '50%', y: '50%' },
  'middle-right': { x: '96%', y: '50%' },
  'bottom-left': { x: '4%', y: '96%' },
  'bottom-center': { x: '50%', y: '96%' },
  'bottom-right': { x: '96%', y: '96%' },
}

// viewBox usa a MESMA largura de referência da geração em produção
// (WATERMARK_REFERENCE_WIDTH em src/lib/image/watermark.ts) — assim o
// tamanho de fonte/espaçamento aparece com a proporção real, sem precisar
// de nenhuma conta de escala aqui: o navegador já escala o viewBox pro
// tamanho do frame automaticamente.
const PREVIEW_W = 1000
const PREVIEW_H = 667

export function WatermarkPreview({
  type,
  textContent,
  font,
  fontSize,
  fontWeight,
  color,
  opacity,
  position,
  spacingX,
  spacingY,
  imageUrl,
  imageSizePercent,
}: WatermarkPreviewProps) {
  const patternId = useId()
  const text = textContent.trim() || 'Sua Marca Aqui'

  const tilePattern = useMemo(() => {
    // Espelha a mesma fórmula usada na geração de produção (src/lib/image/watermark.ts):
    // uma única linha por bloco do padrão, repetindo a cada (fontSize + spacingY) —
    // assim toda linha fica igualmente espaçada, sem pares colados.
    const lineY = fontSize
    const patternW = Math.max(text.length * fontSize * 0.78, 104) + spacingX
    const patternH = fontSize + spacingY
    return { patternW, patternH, lineY }
  }, [text, fontSize, spacingX, spacingY])

  const imgSize = Math.round(Math.min(PREVIEW_W, PREVIEW_H) * (imageSizePercent / 100))

  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-strong)]"
        style={{ aspectRatio: `${PREVIEW_W} / ${PREVIEW_H}` }}
      >
        {/* Foto de amostra (placeholder neutro, sem depender de asset externo) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #3a3f4a 0%, #232730 45%, #14161b 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.15), transparent 55%)',
          }}
        />

        {/* Marca d'água — SVG fiel ao gerado em produção */}
        <svg
          viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {type === 'text' ? (
            position === 'tiled' ? (
              <>
                <defs>
                  <pattern
                    id={patternId}
                    width={tilePattern.patternW}
                    height={tilePattern.patternH}
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(-35)"
                  >
                    <text
                      x={10}
                      y={tilePattern.lineY}
                      fontFamily={font}
                      fontSize={fontSize}
                      fontWeight={fontWeight}
                      fill={color}
                      opacity={opacity}
                    >
                      {text}
                    </text>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#${patternId})`} />
              </>
            ) : (
              <text
                x={TEXT_POSITIONS[position].x}
                y={TEXT_POSITIONS[position].y}
                fontFamily={font}
                fontSize={fontSize}
                fontWeight={fontWeight}
                fill={color}
                opacity={opacity}
                textAnchor={TEXT_POSITIONS[position].anchor}
              >
                {text}
              </text>
            )
          ) : imageUrl ? (
            position === 'tiled' ? (
              <image
                href={imageUrl}
                x="50%"
                y="50%"
                width={imgSize}
                height={imgSize}
                opacity={opacity}
                style={{ transform: `translate(-${imgSize / 2}px, -${imgSize / 2}px)` }}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <image
                href={imageUrl}
                x={IMAGE_POSITIONS[position].x}
                y={IMAGE_POSITIONS[position].y}
                width={imgSize}
                height={imgSize}
                opacity={opacity}
                style={{
                  transform: `translate(${
                    IMAGE_POSITIONS[position].x === '50%' ? -imgSize / 2 : IMAGE_POSITIONS[position].x === '96%' ? -imgSize : 0
                  }px, ${
                    IMAGE_POSITIONS[position].y === '50%' ? -imgSize / 2 : IMAGE_POSITIONS[position].y === '96%' ? -imgSize : 0
                  }px)`,
                }}
                preserveAspectRatio="xMidYMid meet"
              />
            )
          ) : null}
        </svg>
      </div>
      <p className="text-xs text-[var(--color-ink-muted)] mt-2 text-center">
        Pré-visualização — reflete exatamente como a marca d&apos;água é aplicada às fotos.
      </p>
    </div>
  )
}
