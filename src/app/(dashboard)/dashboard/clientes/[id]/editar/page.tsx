import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getDashboardFallbackPath } from '@/lib/dashboard-access'
import { EditClientForm } from './_components/edit-client-form'

type Props = {
  params: Promise<{ id: string }>
}

async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.role !== 'admin' && !profile.tenant_id) {
    redirect(getDashboardFallbackPath(profile as { role?: string | null; tenant_id?: string | null } | null))
  }

  return profile as { tenant_id: string | null; role: string }
}

export default async function EditClientPage({ params }: Props) {
  const { id } = await params
  const profile = await getProfile()
  if (profile.role !== 'admin') redirect('/dashboard/clientes')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client } = await (adminClient as any)
    .from('users')
    .select('id, name, email, phone, cpf, role')
    .eq('id', id)
    .single()

  if (!client || (client.role !== 'client' && client.role !== 'client_inactive')) {
    notFound()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-[var(--color-ink-muted)]">Editar cliente</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          {client.name ?? client.email}
        </h1>
      </div>

      <EditClientForm
        clientId={client.id}
        initialName={client.name ?? ''}
        initialEmail={client.email}
        initialPhone={client.phone ?? ''}
        initialCpf={client.cpf ?? ''}
        initialActive={client.role === 'client'}
      />

      <Link href={`/dashboard/clientes/${client.id}`} className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Voltar
      </Link>
    </div>
  )
}
