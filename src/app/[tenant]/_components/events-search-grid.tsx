'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type PublicEvent = {
  id: string
  title: string
  slug: string
  type: 'event' | 'session'
  event_date: string | null
  created_at: string
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

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar eventos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum evento encontrado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => {
            const isNew = new Date(event.created_at).getTime() > sevenDaysAgo
            const href = `/${tenantSlug}/${event.type === 'event' ? 'evento' : 'ensaio'}/${event.slug}`

            return (
              <Link
                key={event.id}
                href={href}
                className="block rounded-lg border bg-card hover:bg-accent transition-colors overflow-hidden"
              >
                {/* Cover placeholder */}
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-4xl">📷</span>
                </div>
                <div className="p-4 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-tight">{event.title}</p>
                    {isNew && <Badge variant="default" className="shrink-0 text-xs">Novo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {event.type === 'event' ? 'Evento' : 'Ensaio'}
                    {event.event_date &&
                      ` · ${new Date(event.event_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
