'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EventStatusBadge } from './event-status-badge'

type EventItem = {
  id: string; title: string; slug: string; type: 'event' | 'session'
  event_date: string | null; status: string; cover_image_path?: string | null
}

export function EventCard({ event, tenantSlug }: { event: EventItem; tenantSlug?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'publish' | 'delete' | null>(null)
  const typeLabel = event.type === 'event' ? 'Evento' : 'Ensaio'

  async function handlePublish() {
    setLoading('publish')
    const res = await fetch(`/api/events/${event.id}/publish`, { method: 'POST' })
    if (res.ok) { router.refresh() }
    else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(data.error ?? 'Erro ao publicar evento')
    }
    setLoading(null)
  }

  async function handleDelete() {
    if (!confirm(`Excluir "${event.title}"? Esta ação não pode ser desfeita.`)) return
    setLoading('delete')
    const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) { router.refresh() }
    else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(data.error ?? 'Erro ao excluir evento')
      setLoading(null)
    }
  }

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      {/* Capa */}
      <div className="h-36 bg-[#f9fafb] relative overflow-hidden">
        {event.cover_image_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public/${event.cover_image_path}`}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-semibold text-[#111827] text-sm leading-snug truncate">{event.title}</p>
            <p className="text-xs text-[#6b7280] mt-0.5">
              {typeLabel}
              {event.event_date && ` · ${new Date(event.event_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`}
            </p>
          </div>
          <EventStatusBadge status={event.status} />
        </div>

        {/* Link público */}
        {tenantSlug && event.status === 'published' && (
          <p className="text-xs text-[#6b7280] truncate mb-3">
            <a
              href={`/${tenantSlug}/evento/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2563eb] hover:underline"
            >
              Ver galeria pública →
            </a>
          </p>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Link
            href={`/dashboard/eventos/${event.id}/editar`}
            className="px-2.5 py-1 rounded text-xs font-medium border border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb] transition-colors"
          >
            Editar
          </Link>
          <Link
            href={`/dashboard/eventos/${event.id}/fotos`}
            className="px-2.5 py-1 rounded text-xs font-medium border border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb] transition-colors"
          >
            Fotos
          </Link>
          {event.status === 'published' && tenantSlug && (
            <Link
              href={`/${tenantSlug}/evento/${event.slug}/qr`}
              target="_blank"
              className="px-2.5 py-1 rounded text-xs font-medium border border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb] transition-colors"
            >
              QR Code
            </Link>
          )}
          {event.status === 'draft' && (
            <button
              onClick={handlePublish}
              disabled={loading === 'publish'}
              className="px-2.5 py-1 rounded text-xs font-medium bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
            >
              {loading === 'publish' ? 'Publicando...' : 'Publicar'}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={loading === 'delete'}
            className="px-2.5 py-1 rounded text-xs font-medium bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-colors disabled:opacity-60"
          >
            {loading === 'delete' ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}
