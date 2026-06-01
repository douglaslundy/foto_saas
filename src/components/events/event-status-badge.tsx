type EventStatus = 'draft' | 'published' | 'archived'

const STATUS_CONFIG: Record<EventStatus, { label: string; className: string }> = {
  draft: {
    label: 'Rascunho',
    className:
      'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)] border border-[var(--color-border-strong)]',
  },
  published: {
    label: 'Publicado',
    className: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  },
  archived: {
    label: 'Arquivado',
    className: 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)]',
  },
}

export function EventStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as EventStatus] ?? {
    label: status,
    className: 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)]',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${config.className}`}
    >
      {config.label}
    </span>
  )
}
