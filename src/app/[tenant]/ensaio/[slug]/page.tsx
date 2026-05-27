import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { PasswordGate } from '@/components/events/password-gate'
import { PhotoGrid, type Photo } from './_components/photo-grid'

type Props = { params: Promise<{ tenant: string; slug: string }> }

type SessionRow = {
  id: string
  title: string
  description: string | null
  event_date: string | null
  status: string
  password_hash: string | null
  tenant_id: string
}

async function getSession(tenantSlug: string, sessionSlug: string): Promise<SessionRow | null> {
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = (await (adminClient as any)
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single()) as { data: { id: string } | null }

  if (!tenant) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = (await (adminClient as any)
    .from('events')
    .select('id, title, description, event_date, status, password_hash, tenant_id')
    .eq('slug', sessionSlug)
    .eq('tenant_id', tenant.id)
    .eq('type', 'session')
    .single()) as { data: SessionRow | null }

  return session
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant, slug } = await params
  const session = await getSession(tenant, slug)
  if (!session || session.status !== 'published') return {}
  return {
    title: session.title,
    description: session.description ?? `Ensaio fotográfico: ${session.title}`,
  }
}

export default async function EnsaioPage({ params }: Props) {
  const { tenant, slug } = await params
  const session = await getSession(tenant, slug)

  if (!session || session.status !== 'published') notFound()

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, count } = (await (adminClient as any)
    .from('photos')
    .select('id, public_storage_path, status', { count: 'exact' })
    .eq('event_id', session.id)
    .eq('status', 'ready')
    .order('created_at', { ascending: true })
    .range(0, 47)) as { data: Photo[] | null; count: number | null }

  const content = (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">{session.title}</h1>
        {session.event_date && (
          <p className="text-muted-foreground">
            {new Date(session.event_date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
        )}
        {session.description && (
          <p className="text-muted-foreground">{session.description}</p>
        )}
      </div>

      <PhotoGrid
        initialPhotos={photos ?? []}
        eventId={session.id}
        total={count ?? 0}
      />
    </div>
  )

  // Sessions always require a password
  return <PasswordGate eventId={session.id}>{content}</PasswordGate>
}
