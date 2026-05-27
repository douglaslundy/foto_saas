import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

type Tenant = {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
}

type Member = { id: string; email: string; role: string }
type Event = { id: string; title: string; slug: string; status: string; type: string }

export default async function TenantDetailPage({ params }: Props) {
  const { id } = await params
  const adminClient = createAdminClient()

  const [tenantResult, membersResult, eventsResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('tenants')
      .select('id, name, slug, status, created_at')
      .eq('id', id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('users')
      .select('id, email, role')
      .eq('tenant_id', id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('events')
      .select('id, title, slug, status, type')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const tenant = tenantResult.data as Tenant | null
  if (!tenant) notFound()

  const members = (membersResult.data ?? []) as Member[]
  const events = (eventsResult.data ?? []) as Event[]

  const roleLabel: Record<string, string> = {
    photographer: 'Fotógrafo',
    sub_photographer: 'Sub-fotógrafo',
    admin: 'Admin',
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/tenants" className="text-xs text-muted-foreground hover:underline">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-bold mt-1">{tenant.name}</h1>
          <p className="text-muted-foreground text-sm">
            {tenant.slug} · Criado em {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded text-sm font-medium ${
            tenant.status === 'active'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {tenant.status === 'active' ? 'Ativo' : 'Suspenso'}
        </span>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <form
          onSubmit={undefined}
          action={`/api/admin/tenants/${id}/status`}
          method="post"
        >
          <button
            type="submit"
            className={`px-4 py-2 rounded text-sm font-medium border ${
              tenant.status === 'active'
                ? 'text-red-600 border-red-200 hover:bg-red-50'
                : 'text-green-600 border-green-200 hover:bg-green-50'
            }`}
          >
            {tenant.status === 'active' ? 'Suspender conta' : 'Reativar conta'}
          </button>
        </form>
      </div>

      {/* Members */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">
          Membros ({members.length})
        </div>
        <div className="divide-y">
          {members.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">Nenhum membro.</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="px-4 py-3 flex justify-between text-sm">
                <span>{m.email}</span>
                <span className="text-muted-foreground">{roleLabel[m.role] ?? m.role}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Events */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">
          Eventos ({events.length})
        </div>
        <div className="divide-y">
          {events.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">Nenhum evento.</p>
          ) : (
            events.map((e) => (
              <div key={e.id} className="px-4 py-3 flex justify-between text-sm">
                <span className="font-medium">{e.title}</span>
                <div className="flex gap-3 text-muted-foreground">
                  <span>{e.type === 'event' ? 'Evento' : 'Ensaio'}</span>
                  <span>{e.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
