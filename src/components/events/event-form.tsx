'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { slugify } from '@/lib/slug'

type EventFormValues = {
  id?: string
  title?: string
  slug?: string
  type?: 'event' | 'session'
  event_date?: string
  description?: string
  is_public?: boolean
  price_cents?: number
  facial_recognition_enabled?: boolean
  cover_image_path?: string | null
  session_price_cents?: number
  included_photo_count?: number
  extra_photo_price_cents?: number
}

const inputClass =
  'h-11 px-4 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.12)]'

const labelClass =
  'block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)] mb-1.5'

export function EventForm({
  defaultValues,
  mode,
}: {
  defaultValues?: EventFormValues
  mode: 'create' | 'edit'
}) {
  const router = useRouter()
  const [title, setTitle] = useState(defaultValues?.title ?? '')
  const [slug, setSlug] = useState(defaultValues?.slug ?? '')
  const [type, setType] = useState<'event' | 'session'>(defaultValues?.type ?? 'event')
  const [eventDate, setEventDate] = useState(defaultValues?.event_date ?? '')
  const [description, setDescription] = useState(defaultValues?.description ?? '')
  const [isPublic, setIsPublic] = useState(defaultValues?.is_public ?? true)
  const [password, setPassword] = useState('')
  const [priceDisplay, setPriceDisplay] = useState(
    ((defaultValues?.price_cents ?? 0) / 100).toFixed(2)
  )
  const [facialEnabled, setFacialEnabled] = useState(
    defaultValues?.facial_recognition_enabled ?? false
  )
  const [sessionPriceDisplay, setSessionPriceDisplay] = useState(
    ((defaultValues?.session_price_cents ?? 0) / 100).toFixed(2)
  )
  const [includedPhotoCount, setIncludedPhotoCount] = useState(
    String(defaultValues?.included_photo_count ?? 0)
  )
  const [extraPhotoPriceDisplay, setExtraPhotoPriceDisplay] = useState(
    ((defaultValues?.extra_photo_price_cents ?? 0) / 100).toFixed(2)
  )
  const [slugManual, setSlugManual] = useState(mode === 'edit')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(
    defaultValues?.cover_image_path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public/${defaultValues.cover_image_path}`
      : null
  )

  useEffect(() => {
    if (!slugManual && title) {
      setSlug(slugify(title))
    }
  }, [title, slugManual])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const body: Record<string, unknown> = {
      title,
      slug,
      type,
      price_cents: type === 'event' ? (Math.round(parseFloat(priceDisplay) * 100) || 0) : 0,
      is_public: type === 'event' ? isPublic : false,
      facial_recognition_enabled: type === 'event' ? facialEnabled : false,
      session_price_cents: type === 'session' ? (Math.round(parseFloat(sessionPriceDisplay) * 100) || 0) : 0,
      included_photo_count: type === 'session' ? (parseInt(includedPhotoCount, 10) || 0) : 0,
      extra_photo_price_cents: type === 'session' ? (Math.round(parseFloat(extraPhotoPriceDisplay) * 100) || 0) : 0,
    }
    if (eventDate) body.event_date = eventDate
    if (description) body.description = description
    if (!isPublic && password) body.password = password

    const url = mode === 'create' ? '/api/events' : `/api/events/${defaultValues?.id}`
    const method = mode === 'create' ? 'POST' : 'PATCH'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Erro ao salvar evento')
        return
      }

      // Upload de capa se selecionada
      const eventId = mode === 'create'
        ? (data as { id?: string }).id
        : defaultValues?.id
      if (coverFile && eventId) {
        const coverFormData = new FormData()
        coverFormData.append('cover_image', coverFile)
        const coverRes = await fetch(`/api/events/${eventId}/cover`, { method: 'PUT', body: coverFormData })
        if (!coverRes.ok) {
          const coverErr = await coverRes.json().catch(() => ({})) as { error?: string }
          setError(`Evento salvo, mas falha ao salvar capa: ${coverErr.error ?? 'tente novamente'}`)
          setLoading(false)
          return
        }
      }

      router.push('/dashboard/eventos')
      router.refresh()
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
        {/* Left column — main fields */}
        <div
          className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="px-6 py-5 border-b border-[var(--color-border-strong)]">
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
              Informações Básicas
            </h2>
            <p className="text-[var(--color-ink-muted)] text-sm mt-0.5">
              Dados principais do evento ou ensaio
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* Title */}
            <div>
              <label htmlFor="title" className={labelClass}>
                Título *
              </label>
              <input
                id="title"
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome do evento"
                required
              />
            </div>

            {/* Slug */}
            <div>
              <label htmlFor="slug" className={labelClass}>
                Slug *
              </label>
              <input
                id="slug"
                className={inputClass}
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugManual(true)
                }}
                placeholder="meu-evento"
                required
              />
              <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">
                URL pública: /[tenant]/{type === 'event' ? 'evento' : 'ensaio'}/{slug || '…'}
              </p>
            </div>

            {/* Type + Date in 2 cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Type */}
              <div>
                <p className={labelClass}>Tipo *</p>
                <div className="flex gap-6 h-11 items-center">
                  {(['event', 'session'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={t}
                        checked={type === t}
                        onChange={() => setType(t)}
                        className="accent-[var(--color-gold)]"
                      />
                      <span className="text-sm text-[var(--color-ink)]">
                        {t === 'event' ? 'Evento' : 'Ensaio'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label htmlFor="event_date" className={labelClass}>
                  Data do evento
                </label>
                <input
                  id="event_date"
                  type="date"
                  className={inputClass}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className={labelClass}>
                Descrição
              </label>
              <textarea
                id="description"
                rows={3}
                className={`${inputClass} h-auto py-3 resize-none`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional"
              />
            </div>

            {/* Price (evento: preço por foto) */}
            {type === 'event' && (
              <div>
                <label htmlFor="price" className={labelClass}>
                  Preço por foto (R$)
                </label>
                <input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={priceDisplay}
                  onChange={(e) => setPriceDisplay(e.target.value)}
                />
              </div>
            )}

            {/* Session-only pricing */}
            {type === 'session' && (
              <div
                className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] p-4 space-y-4"
                style={{ background: 'var(--color-surface-alt)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)]">
                  Preço do ensaio
                </p>

                <div>
                  <label htmlFor="session_price" className={labelClass}>
                    Valor do ensaio (R$)
                  </label>
                  <input
                    id="session_price"
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={sessionPriceDisplay}
                    onChange={(e) => setSessionPriceDisplay(e.target.value)}
                  />
                  <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">
                    Deixe 0 para ensaio gratuito — o cliente não precisará pagar.
                  </p>
                </div>

                <div>
                  <label htmlFor="included_photo_count" className={labelClass}>
                    Fotos incluídas no valor do ensaio
                  </label>
                  <input
                    id="included_photo_count"
                    type="number"
                    step="1"
                    min="0"
                    className={inputClass}
                    value={includedPhotoCount}
                    onChange={(e) => setIncludedPhotoCount(e.target.value)}
                  />
                  <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">
                    Deixe 0 para o cliente poder escolher todas as fotos do ensaio, sem limite.
                  </p>
                </div>

                <div>
                  <label htmlFor="extra_photo_price" className={labelClass}>
                    Valor por foto extra (R$)
                  </label>
                  <input
                    id="extra_photo_price"
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={extraPhotoPriceDisplay}
                    onChange={(e) => setExtraPhotoPriceDisplay(e.target.value)}
                  />
                  <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">
                    Cobrado por cada foto selecionada além das incluídas acima.
                  </p>
                </div>
              </div>
            )}

            {/* Event-only settings */}
            {type === 'event' && (
              <div
                className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] p-4 space-y-4"
                style={{ background: 'var(--color-surface-alt)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)]">
                  Configurações do evento
                </p>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">Acesso público</p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      Clientes acessam sem senha
                    </p>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>

                {!isPublic && (
                  <div>
                    <label htmlFor="password" className={labelClass}>
                      {mode === 'create' ? 'Senha de acesso' : 'Nova senha (vazio = manter a atual)'}
                    </label>
                    <input
                      id="password"
                      type="password"
                      className={inputClass}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Senha do evento"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      Reconhecimento facial
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      Clientes buscam fotos com selfie
                    </p>
                  </div>
                  <Switch checked={facialEnabled} onCheckedChange={setFacialEnabled} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column — sidebar */}
        <div
          className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="px-6 py-5 border-b border-[var(--color-border-strong)]">
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
              Publicação
            </h2>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <p className="text-sm font-medium" style={{ color: 'var(--color-danger)' }}>
                {error}
              </p>
            )}

            {/* Imagem de Capa */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-muted)] mb-1.5">
                Imagem de Capa
              </label>
              {coverPreview && (
                <div className="mb-2 rounded-[var(--radius-sm)] overflow-hidden h-32 bg-[var(--color-surface-alt)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setCoverFile(f)
                    setCoverPreview(URL.createObjectURL(f))
                  }
                }}
                className="w-full text-sm text-[var(--color-ink-muted)] file:mr-3 file:py-2 file:px-4 file:rounded-[var(--radius-sm)] file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-surface-alt)] file:text-[var(--color-ink)] hover:file:bg-[var(--color-surface)] cursor-pointer"
              />
              <p className="text-xs text-[var(--color-ink-muted)] mt-1">Recomendado: 1200×600px (JPG, PNG ou WebP)</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] font-semibold text-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60"
            >
              {loading ? 'Salvando...' : mode === 'create' ? 'Criar evento' : 'Salvar alterações'}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="w-full h-11 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-[var(--color-ink)] font-semibold text-sm hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
