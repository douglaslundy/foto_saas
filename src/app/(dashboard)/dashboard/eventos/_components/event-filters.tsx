'use client'

import { useState } from 'react'
import { EventCard } from '@/components/events/event-card'

type EventItem = {
  id: string
  title: string
  slug: string
  type: 'event' | 'session'
  event_date: string | null
  status: string
}

type Props = {
  events: EventItem[]
  tenantSlug?: string
}

export function EventFilters({ events, tenantSlug }: Props) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'event' | 'session'>('all')
  const [search, setSearch] = useState('')

  const filtered = events.filter((e) => {
    if (statusFilter === 'published' && e.status !== 'published') return false
    if (statusFilter === 'draft' && e.status !== 'draft') return false
    if (typeFilter === 'event' && e.type !== 'event') return false
    if (typeFilter === 'session' && e.type !== 'session') return false
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos os status</option>
          <option value="published">Publicados</option>
          <option value="draft">Rascunhos</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos os tipos</option>
          <option value="event">Evento</option>
          <option value="session">Ensaio</option>
        </select>

        <input
          type="text"
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[200px]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">Nenhum evento encontrado com os filtros selecionados.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} tenantSlug={tenantSlug} />
          ))}
        </div>
      )}
    </div>
  )
}
