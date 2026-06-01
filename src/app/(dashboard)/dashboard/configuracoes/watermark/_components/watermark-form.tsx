'use client'

import { useState } from 'react'

interface WatermarkConfig {
  id?: string
  tenant_id: string
  type: string
  text_content?: string | null
  font?: string
  font_size?: number
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
  'h-11 px-4 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.12)] placeholder:text-[var(--color-ink-muted)]'
const labelClass =
  'block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)] mb-1.5'

export default function WatermarkForm({ initial }: WatermarkFormProps) {
  const [type, setType] = useState(initial?.type ?? 'text')
  const [textContent, setTextContent] = useState(initial?.text_content ?? '')
  const [font] = useState(initial?.font ?? 'sans-serif')
  const [fontSize, setFontSize] = useState(initial?.font_size ?? 24)
  const [color, setColor] = useState(initial?.color ?? '#ffffff')
  const [opacity, setOpacity] = useState(initial?.opacity ?? 0.6)
  const [position, setPosition] = useState(initial?.position ?? 'tiled')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        type,
        position,
        opacity,
      }
      if (type === 'text') {
        payload.text_content = textContent
        payload.font = font
        payload.font_size = fontSize
        payload.color = color
      }
      const res = await fetch('/api/watermark-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        alert('Erro ao salvar: ' + (json.error ?? res.statusText))
      } else {
        alert('Configuração salva com sucesso!')
      }
    } catch {
      alert('Erro inesperado ao salvar configuração.')
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
        <div className="p-6 space-y-6">
          {/* Type */}
          <div>
            <label className={labelClass}>Tipo de marca d&apos;água</label>
            <div className="flex gap-6 mt-1">
              {[{ value: 'text', label: 'Texto' }, { value: 'image', label: 'Imagem' }].map(opt => (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="radio"
                      name="type"
                      value={opt.value}
                      checked={type === opt.value}
                      onChange={() => setType(opt.value)}
                      className="sr-only"
                    />
                    <div className={`h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-all ${
                      type === opt.value
                        ? 'border-[var(--color-gold)] bg-[var(--color-gold)]'
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
              <div>
                <label htmlFor="text_content" className={labelClass}>Texto</label>
                <input
                  id="text_content"
                  type="text"
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  placeholder="Ex: © Meu Estúdio"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="font_size" className={labelClass}>Tamanho da fonte (px)</label>
                <input
                  id="font_size"
                  type="number"
                  min={8}
                  max={200}
                  value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))}
                  className="h-11 px-4 w-32 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.12)]"
                />
              </div>

              <div>
                <label htmlFor="color" className={labelClass}>Cor do texto</label>
                <div className="flex items-center gap-3">
                  <input
                    id="color"
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="h-11 w-16 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] p-1 bg-[var(--color-surface)]"
                  />
                  <span className="text-sm font-mono text-[var(--color-ink-soft)]">{color}</span>
                </div>
              </div>
            </>
          )}

          {/* Position */}
          <div>
            <label htmlFor="position" className={labelClass}>Posição</label>
            <select
              id="position"
              value={position}
              onChange={e => setPosition(e.target.value)}
              className={inputClass}
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
              className="w-full accent-[var(--color-gold)] mt-1"
            />
            <div className="flex justify-between text-xs text-[var(--color-ink-muted)] mt-1">
              <span>0 (transparente)</span>
              <span>1 (opaco)</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60"
          >
            {loading ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </form>
    </div>
  )
}
