'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PendingEvent = {
  id: string
  title: string
  type: string
  event_date: string | null
  created_at: string
  creator_email?: string | null
}

export function ApprovalQueue({ events }: { events: PendingEvent[] }) {
  const router = useRouter()
  const [processing, setProcessing] = useState<string | null>(null)

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setProcessing(id)
    try {
      const res = await fetch(`/api/events/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        alert(data.error ?? 'Erro ao processar aprovação.')
      }
      router.refresh()
    } catch {
      alert('Erro de rede. Tente novamente.')
    } finally {
      setProcessing(null)
    }
  }

  if (events.length === 0) {
    return (
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-12 text-center"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <p className="text-4xl mb-4">✅</p>
        <p className="font-display text-xl font-semibold text-[var(--color-ink)]">
          Nenhuma aprovação pendente
        </p>
        <p className="text-sm text-[var(--color-ink-muted)] mt-2">
          Todos os eventos da sua equipe foram revisados.
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="divide-y divide-[var(--color-border)]">
        {events.map((event) => (
          <div key={event.id} className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{event.title}</p>
              <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
                {event.type === 'event' ? 'Evento' : 'Ensaio'}
                {event.event_date && ` · ${new Date(event.event_date).toLocaleDateString('pt-BR')}`}
                {event.creator_email && ` · por ${event.creator_email}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleAction(event.id, 'reject')}
                disabled={processing === event.id}
                className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] border border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors disabled:opacity-40"
              >
                Rejeitar
              </button>
              <button
                onClick={() => handleAction(event.id, 'approve')}
                disabled={processing === event.id}
                className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-colors disabled:opacity-40"
              >
                {processing === event.id ? '...' : 'Aprovar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
