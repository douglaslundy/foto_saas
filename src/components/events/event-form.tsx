'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
}

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
  const [slugManual, setSlugManual] = useState(mode === 'edit')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      price_cents: Math.round(parseFloat(priceDisplay) * 100) || 0,
      is_public: type === 'event' ? isPublic : false,
      facial_recognition_enabled: type === 'event' ? facialEnabled : false,
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
      router.push('/dashboard/eventos')
      router.refresh()
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Título *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nome do evento"
          required
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="slug">Slug *</Label>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugManual(true) }}
          placeholder="meu-evento"
          required
        />
        <p className="text-xs text-muted-foreground">
          URL pública: /[tenant]/{type === 'event' ? 'evento' : 'ensaio'}/{slug || '…'}
        </p>
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <Label>Tipo *</Label>
        <div className="flex gap-6">
          {(['event', 'session'] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
              />
              <span className="text-sm">{t === 'event' ? 'Evento' : 'Ensaio'}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="event_date">Data do evento</Label>
        <Input
          id="event_date"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição opcional"
          rows={3}
        />
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <Label htmlFor="price">Preço (R$)</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          min="0"
          value={priceDisplay}
          onChange={(e) => setPriceDisplay(e.target.value)}
        />
      </div>

      {/* Event-only settings */}
      {type === 'event' && (
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">Configurações do evento</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Acesso público</p>
              <p className="text-xs text-muted-foreground">Clientes acessam sem senha</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          {!isPublic && (
            <div className="space-y-1.5">
              <Label htmlFor="password">
                {mode === 'create' ? 'Senha de acesso' : 'Nova senha (vazio = manter a atual)'}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha do evento"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Reconhecimento facial</p>
              <p className="text-xs text-muted-foreground">Clientes buscam fotos com selfie</p>
            </div>
            <Switch checked={facialEnabled} onCheckedChange={setFacialEnabled} />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : mode === 'create' ? 'Criar evento' : 'Salvar alterações'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
