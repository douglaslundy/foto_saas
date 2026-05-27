import { EventForm } from '@/components/events/event-form'

export default function NovoEventoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Novo Evento</h1>
      <EventForm mode="create" />
    </div>
  )
}
