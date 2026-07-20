'use client'

import { useState, useRef } from 'react'
import { WatermarkPreview } from './watermark-preview'

interface WatermarkConfig {
  id?: string
  tenant_id: string
  type: string
  text_content?: string | null
  font?: string
  font_size?: number
  font_weight?: number
  spacing_x?: number
  spacing_y?: number
  color?: string
  opacity: number
  position: string
  image_storage_path?: string | null
  image_size_percent?: number
}

interface WatermarkFormProps {
  tenantId?: string
  initial: WatermarkConfig | null
}

const POSITION_OPTIONS = [
  { value: 'tiled', label: 'Todas as partes (tiled)' },
  { value: 'top-left', label: 'Superior esquerdo' },
  { value: 'top-center', label: 'Superior centro' },
  { value: 'top-right', label: 'Superior direito' },
  { value: 'bottom-left', label: 'Inferior esquerdo' },
  { value: 'bottom-center', label: 'Inferior centro' },
  { value: 'bottom-right', label: 'Inferior direito' },
]

const inputClass =
  'h-11 px-4 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-blue)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] placeholder:text-[var(--color-ink-muted)]'
const labelClass =
  'block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)] mb-1.5'

export default function WatermarkForm({ initial }: WatermarkFormProps) {
  const [type, setType] = useState(initial?.type ?? 'text')
  const [textContent, setTextContent] = useState(initial?.text_content ?? '')
  const [font] = useState(initial?.font ?? 'sans-serif')
  const [fontSize, setFontSize] = useState(initial?.font_size ?? 24)
  const [fontWeight, setFontWeight] = useState(initial?.font_weight ?? 700)
  const [spacingX, setSpacingX] = useState(initial?.spacing_x ?? 40)
  const [spacingY, setSpacingY] = useState(initial?.spacing_y ?? 80)
  const [color, setColor] = useState(initial?.color ?? '#ffffff')
  const [opacity, setOpacity] = useState(initial?.opacity ?? 0.6)
  const [position, setPosition] = useState(initial?.position ?? 'tiled')
  const [imageSizePercent, setImageSizePercent] = useState(initial?.image_size_percent ?? 20)
  const [imagePath, setImagePath] = useState(initial?.image_storage_path ?? null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`
    : ''

  const currentImageUrl = imagePreviewUrl ?? (imagePath ? `${storageBase}/${imagePath}` : null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImagePreviewUrl(url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const hasImageFile = fileRef.current?.files?.[0]

      if (type === 'image' && hasImageFile) {
        // Use FormData when uploading an image file
        const formData = new FormData()
        formData.append('type', type)
        formData.append('position', position)
        formData.append('opacity', String(opacity))
        formData.append('image_size_percent', String(imageSizePercent))
        formData.append('watermark_image', hasImageFile)

        const res = await fetch('/api/watermark-config', {
          method: 'PUT',
          body: formData,
        })
        const json = await res.json()
        if (!res.ok) {
          setMessage({ type: 'error', text: json.error ?? 'Erro ao salvar.' })
        } else {
          setImagePath(json.config?.image_storage_path ?? imagePath)
          setImagePreviewUrl(null)
          if (fileRef.current) fileRef.current.value = ''
          setMessage({ type: 'success', text: 'Configuração salva com sucesso!' })
        }
      } else {
        // Use JSON for text type or image type without a new file
        const payload: Record<string, unknown> = {
          type,
          position,
          opacity,
        }
        if (type === 'text') {
          payload.text_content = textContent
          payload.font = font
          payload.font_size = fontSize
          payload.font_weight = fontWeight
          payload.spacing_x = spacingX
          payload.spacing_y = spacingY
          payload.color = color
        } else {
          // image type, no new file — preserve existing path
          payload.image_size_percent = imageSizePercent
          if (imagePath) payload.image_storage_path = imagePath
        }

        const res = await fetch('/api/watermark-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) {
          setMessage({ type: 'error', text: json.error ?? 'Erro ao salvar.' })
        } else {
          setMessage({ type: 'success', text: 'Configuração salva com sucesso!' })
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro inesperado ao salvar configuração.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="px-6 py-5 border-b border-[var(--color-border-strong)]">
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Configurações de Marca d&apos;água</h2>
        <p className="text-[var(--color-ink-muted)] text-sm mt-0.5">Aplique sua identidade visual às fotos</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-4 lg:grid lg:grid-cols-[340px_1fr] lg:gap-5 lg:items-start">
          {/* Live preview — fica fixo na tela ao rolar os controles */}
          <div className="lg:sticky lg:top-4 mb-4 lg:mb-0">
            <label className={labelClass}>Pré-visualização</label>
            <WatermarkPreview
              type={type as 'text' | 'image'}
              textContent={textContent}
              font={font}
              fontSize={fontSize}
              fontWeight={fontWeight}
              color={color}
              opacity={opacity}
              position={position as 'tiled' | 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'}
              spacingX={spacingX}
              spacingY={spacingY}
              imageUrl={currentImageUrl}
              imageSizePercent={imageSizePercent}
            />
          </div>

          <div className="space-y-3">
            {/* Type */}
            <div>
              <label className={labelClass}>Tipo de marca d&apos;água</label>
              <div className="flex gap-5 mt-1">
                {[{ value: 'text', label: 'Texto' }, { value: 'image', label: 'Imagem' }].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="radio"
                        name="type"
                        value={opt.value}
                        checked={type === opt.value}
                        onChange={() => setType(opt.value)}
                        className="sr-only"
                      />
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        type === opt.value
                          ? 'border-[var(--color-blue)] bg-[var(--color-blue)]'
                          : 'border-[var(--color-border-strong)] bg-[var(--color-surface)]'
                      }`}>
                        {type === opt.value && (
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-[var(--color-ink)]">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Text fields */}
            {type === 'text' && (
              <>
                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                  <div>
                    <label htmlFor="text_content" className={labelClass}>Texto</label>
                    <input
                      id="text_content"
                      type="text"
                      value={textContent}
                      onChange={e => setTextContent(e.target.value)}
                      placeholder="Ex: © Meu Estúdio"
                      className="h-9 px-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-blue)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] placeholder:text-[var(--color-ink-muted)]"
                    />
                  </div>
                  <div>
                    <label htmlFor="color" className={labelClass}>Cor</label>
                    <input
                      id="color"
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] p-1 bg-[var(--color-surface)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="font_size" className={labelClass}>
                      Tamanho: <span className="text-[var(--color-ink)] font-bold">{fontSize}</span>
                    </label>
                    <input
                      id="font_size"
                      type="range"
                      min={8}
                      max={200}
                      value={fontSize}
                      onChange={e => setFontSize(Number(e.target.value))}
                      className="w-full accent-[var(--color-blue)]"
                    />
                  </div>
                  <div>
                    <label htmlFor="font_weight" className={labelClass}>
                      Espessura: <span className="text-[var(--color-ink)] font-bold">{fontWeight}</span>
                    </label>
                    <input
                      id="font_weight"
                      type="range"
                      min={100}
                      max={900}
                      step={100}
                      value={fontWeight}
                      onChange={e => setFontWeight(Number(e.target.value))}
                      className="w-full accent-[var(--color-blue)]"
                    />
                  </div>
                </div>

                {position === 'tiled' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="spacing_x" className={labelClass}>
                        Dist. entre colunas: <span className="text-[var(--color-ink)] font-bold">{spacingX}</span>
                      </label>
                      <input
                        id="spacing_x"
                        type="range"
                        min={0}
                        max={300}
                        step={10}
                        value={spacingX}
                        onChange={e => setSpacingX(Number(e.target.value))}
                        className="w-full accent-[var(--color-blue)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="spacing_y" className={labelClass}>
                        Espaço entre linhas: <span className="text-[var(--color-ink)] font-bold">{spacingY}</span>
                      </label>
                      <input
                        id="spacing_y"
                        type="range"
                        min={0}
                        max={300}
                        step={10}
                        value={spacingY}
                        onChange={e => setSpacingY(Number(e.target.value))}
                        className="w-full accent-[var(--color-blue)]"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Image upload fields */}
            {type === 'image' && (
              <>
                <div>
                  <label className={labelClass}>Imagem da marca d&apos;água</label>
                  <div className="flex items-center gap-3">
                    {currentImageUrl && (
                      <div className="rounded-[var(--radius-sm)] overflow-hidden border border-[var(--color-border)] w-14 h-14 shrink-0 bg-[var(--color-surface-alt)] flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentImageUrl}
                          alt="Watermark preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="block flex-1 text-xs text-[var(--color-ink-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded-[var(--radius-sm)] file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-surface-alt)] file:text-[var(--color-ink)] hover:file:bg-[var(--color-border)] transition-all"
                    />
                  </div>
                  <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                    PNG com fundo transparente recomendado.
                  </p>
                </div>

                <div>
                  <label htmlFor="image_size_percent" className={labelClass}>
                    Tamanho: <span className="text-[var(--color-ink)] font-bold">{imageSizePercent}%</span>
                  </label>
                  <input
                    id="image_size_percent"
                    type="range"
                    min={5}
                    max={80}
                    step={5}
                    value={imageSizePercent}
                    onChange={e => setImageSizePercent(Number(e.target.value))}
                    className="w-full accent-[var(--color-blue)]"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Position */}
              <div>
                <label htmlFor="position" className={labelClass}>Posição</label>
                <select
                  id="position"
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  className="h-9 px-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-blue)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                >
                  {POSITION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Opacity */}
              <div>
                <label htmlFor="opacity" className={labelClass}>
                  Opacidade: <span className="text-[var(--color-ink)] font-bold">{opacity.toFixed(1)}</span>
                </label>
                <input
                  id="opacity"
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={opacity}
                  onChange={e => setOpacity(Number(e.target.value))}
                  className="w-full accent-[var(--color-blue)] h-9 flex items-center"
                />
              </div>
            </div>

            {/* Message */}
            {message && (
              <div
                className={`rounded-[var(--radius-sm)] px-3 py-2 text-xs font-medium ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60"
            >
              {loading ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
