import { Badge } from '@/components/ui/badge'

type EventStatus = 'draft' | 'published' | 'archived'

const STATUS_CONFIG: Record<EventStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  published: { label: 'Publicado', variant: 'default' },
  archived: { label: 'Arquivado', variant: 'outline' },
}

export function EventStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as EventStatus] ?? { label: status, variant: 'outline' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
