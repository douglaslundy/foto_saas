'use client'

import { useState } from 'react'
import Link from 'next/link'

type PublicEvent = {
  id: string
  title: string
  slug: string
  type: 'event' | 'session'
  event_date: string | null
  created_at: string
  cover_image_path?: string | null
}

export function EventsSearchGrid({
  events,
  tenantSlug,
}: {
  events: PublicEvent[]
  tenantSlug: string
}) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? events.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
    : events

  return (
    <div className="space-y-6">
      <input
        type="search"
        placeholder="Buscar eventos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm h-10 px-4 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.12)] transition-all duration-200"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="mx-auto mb-4 opacity-30"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="text-xl font-semibold text-[var(--color-ink)]">
            {search.trim() ? 'Nenhum evento encontrado.' : 'Nenhum evento publicado ainda.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((event) => {
            const href = `/${tenantSlug}/${event.type === 'event' ? 'evento' : 'ensaio'}/${event.slug}`

            return (
              <Link
                key={event.id}
                href={href}
                className="group rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg block"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                {/* Cover */}
                <div className="aspect-video bg-[var(--color-surface-alt)] overflow-hidden flex items-center justify-center">
                  {event.cover_image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public/${event.cover_image_path}`}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="opacity-30"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-gold)] mb-2 block">
                    {event.type === 'session' ? 'Ensaio' : 'Evento'}
                  </span>
                  <h3 className="text-lg font-semibold text-[var(--color-ink)] mb-1 leading-tight">
                    {event.title}
                  </h3>
                  {event.event_date && (
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {new Date(event.event_date).toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </p>
                  )}
                  <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <span className="text-sm font-medium text-[var(--color-ink-soft,var(--color-ink))] group-hover:text-[var(--color-gold)] transition-colors">
                      Ver fotos →
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
