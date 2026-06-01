'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
      const data = (await res.json().catch(() => ({}))) as { error?: string }
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
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(data.error ?? 'Erro ao excluir evento')
      setLoading(null)
    }
  }

  return (
    <div
      className="relative group rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md overflow-hidden"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Gold top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: 'var(--color-gold)' }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold text-[var(--color-ink)] leading-tight truncate">
            {event.title}
          </p>
          <p className="text-sm text-[var(--color-ink-muted)] mt-0.5">
            {typeLabel}
            {event.event_date &&
              ` · ${new Date(event.event_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`}
          </p>
        </div>
        <EventStatusBadge status={event.status} />
      </div>

      {/* Public link */}
      {tenantSlug && (
        <div>
          <p className="text-xs text-[var(--color-ink-muted)] truncate">
            Link:{' '}
            {event.status === 'published' ? (
              <a
                href={`/${tenantSlug}/evento/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono underline"
                style={{ color: 'var(--color-gold)' }}
              >
                /{tenantSlug}/evento/{event.slug}
              </a>
            ) : (
              <span className="font-mono opacity-50">
                /{tenantSlug}/evento/{event.slug}{' '}
                <span className="not-italic">(publicar para ativar)</span>
              </span>
            )}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-auto">
        <Link
          href={`/dashboard/eventos/${event.id}/editar`}
          className="inline-flex items-center px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-xs font-semibold text-[var(--color-ink)] bg-transparent hover:bg-[var(--color-surface-alt)] transition-colors"
        >
          Editar
        </Link>
        <Link
          href={`/dashboard/eventos/${event.id}/fotos`}
          className="inline-flex items-center px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-xs font-semibold text-[var(--color-ink)] bg-transparent hover:bg-[var(--color-surface-alt)] transition-colors"
        >
          Fotos
        </Link>
        {event.status === 'published' && tenantSlug && (
          <>
            <Link
              href={`/${tenantSlug}/evento/${event.slug}`}
              target="_blank"
              className="inline-flex items-center px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-xs font-semibold text-[var(--color-ink)] bg-transparent hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              Ver site
            </Link>
            <Link
              href={`/${tenantSlug}/evento/${event.slug}/qr`}
              target="_blank"
              className="inline-flex items-center px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-xs font-semibold text-[var(--color-ink)] bg-transparent hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              QR Code
            </Link>
          </>
        )}
        {event.status === 'draft' && (
          <>
            <button
              onClick={handlePublish}
              disabled={loading === 'publish'}
              className="inline-flex items-center px-3 py-1.5 rounded-[var(--radius-sm)] bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading === 'publish' ? 'Publicando...' : 'Publicar'}
            </button>
            <button
              onClick={handleDelete}
              disabled={loading === 'delete'}
              className="inline-flex items-center px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-danger)] text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading === 'delete' ? 'Excluindo...' : 'Excluir'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
