import { EventForm } from '@/components/events/event-form'

export default function NovoEventoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Novo Evento
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">
          Preencha os dados para criar um novo evento ou ensaio
        </p>
      </div>
      <EventForm mode="create" />
    </div>
  )
}
