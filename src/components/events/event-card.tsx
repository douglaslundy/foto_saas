'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { EventStatusBadge } from './event-status-badge'

type EventItem = {
  id: string
  title: string
  slug: string
  type: 'event' | 'session'
  event_date: string | null
  status: string
}

export function EventCard({ event, tenantSlug }: { event: EventItem; tenantSlug?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'publish' | 'delete' | null>(null)

  const typeLabel = event.type === 'event' ? 'Evento' : 'Ensaio'

  async function handlePublish() {
    setLoading('publish')
    const res = await fetch(`/api/events/${event.id}/publish`, { method: 'POST' })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string }
      alert(data.error ?? 'Erro ao publicar evento')
    }
    setLoading(null)
  }

  async function handleDelete() {
    if (!confirm(`Excluir "${event.title}"? Esta ação não pode ser desfeita.`)) return
    setLoading('delete')
    const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string }
      alert(data.error ?? 'Erro ao excluir evento')
      setLoading(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{event.title}</CardTitle>
          <EventStatusBadge status={event.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          {typeLabel}
          {event.event_date &&
            ` · ${new Date(event.event_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`}
        </p>
      </CardHeader>
      <CardContent />
      {tenantSlug && (
        <div className="px-6 pb-2">
          <p className="text-xs text-muted-foreground truncate">
            Link:{' '}
            {event.status === 'published' ? (
              <a
                href={`/${tenantSlug}/evento/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline font-mono"
              >
                /{tenantSlug}/evento/{event.slug}
              </a>
            ) : (
              <span className="font-mono text-muted-foreground/60">
                /{tenantSlug}/evento/{event.slug}{' '}
                <span className="not-italic">(publicar para ativar)</span>
              </span>
            )}
          </p>
        </div>
      )}
      <CardFooter className="pt-0 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/eventos/${event.id}/editar`}>Editar</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/eventos/${event.id}/fotos`}>Fotos</Link>
        </Button>
        {event.status === 'published' && tenantSlug && (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${tenantSlug}/evento/${event.slug}`} target="_blank">
                Ver site
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${tenantSlug}/evento/${event.slug}/qr`} target="_blank">
                QR Code
              </Link>
            </Button>
          </>
        )}
        {event.status === 'draft' && (
          <>
            <Button size="sm" onClick={handlePublish} disabled={loading === 'publish'}>
              {loading === 'publish' ? 'Publicando...' : 'Publicar'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={loading === 'delete'}
            >
              Excluir
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
