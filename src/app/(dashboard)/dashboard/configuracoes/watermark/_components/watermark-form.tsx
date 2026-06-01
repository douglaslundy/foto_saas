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
  tenantId: string
  initial: WatermarkConfig | null
}

const POSITION_OPTIONS = [
  { value: 'top-left', label: 'Superior esquerdo' },
  { value: 'top-center', label: 'Superior centro' },
  { value: 'top-right', label: 'Superior direito' },
  { value: 'bottom-left', label: 'Inferior esquerdo' },
  { value: 'bottom-center', label: 'Inferior centro' },
  { value: 'bottom-right', label: 'Inferior direito' },
]

export default function WatermarkForm({ tenantId, initial }: WatermarkFormProps) {
  const [type, setType] = useState(initial?.type ?? 'text')
  const [textContent, setTextContent] = useState(initial?.text_content ?? '')
  const [font, setFont] = useState(initial?.font ?? 'sans-serif')
  const [fontSize, setFontSize] = useState(initial?.font_size ?? 24)
  const [color, setColor] = useState(initial?.color ?? '#ffffff')
  const [opacity, setOpacity] = useState(initial?.opacity ?? 0.6)
  const [position, setPosition] = useState(initial?.position ?? 'bottom-right')
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
    } catch (err) {
      alert('Erro inesperado ao salvar configuração.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de marca d&apos;água</label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="type"
              value="text"
              checked={type === 'text'}
              onChange={() => setType('text')}
              className="h-4 w-4 text-indigo-600"
            />
            <span className="text-sm text-gray-700">Texto</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="type"
              value="image"
              checked={type === 'image'}
              onChange={() => setType('image')}
              className="h-4 w-4 text-indigo-600"
            />
            <span className="text-sm text-gray-700">Imagem</span>
          </label>
        </div>
      </div>

      {/* Text fields — only when type=text */}
      {type === 'text' && (
        <>
          <div>
            <label htmlFor="text_content" className="block text-sm font-medium text-gray-700 mb-1">
              Texto
            </label>
            <input
              id="text_content"
              type="text"
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              placeholder="Ex: © Meu Estúdio"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="font_size" className="block text-sm font-medium text-gray-700 mb-1">
              Tamanho da fonte (px)
            </label>
            <input
              id="font_size"
              type="number"
              min={8}
              max={200}
              value={fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
              className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-1">
              Cor do texto
            </label>
            <div className="flex items-center gap-3">
              <input
                id="color"
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded border border-gray-300 p-0.5"
              />
              <span className="text-sm text-gray-500">{color}</span>
            </div>
          </div>
        </>
      )}

      {/* Position */}
      <div>
        <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
          Posição
        </label>
        <select
          id="position"
          value={position}
          onChange={e => setPosition(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
        <label htmlFor="opacity" className="block text-sm font-medium text-gray-700 mb-1">
          Opacidade: <span className="font-semibold">{opacity.toFixed(1)}</span>
        </label>
        <input
          id="opacity"
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={opacity}
          onChange={e => setOpacity(Number(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0 (transparente)</span>
          <span>1 (opaco)</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Salvando...' : 'Salvar configuração'}
      </button>
    </form>
  )
}
