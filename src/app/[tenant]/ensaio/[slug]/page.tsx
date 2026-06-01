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
  const { tenant: tenantSlug, slug } = await params
  const session = await getSession(tenantSlug, slug)

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

  const photoCount = count ?? 0

  const content = (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Imersive header */}
      <div
        className="relative h-64 overflow-hidden flex flex-col justify-end"
        style={{
          background: '#0d0f14',
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(200,169,110,0.12), transparent)',
        }}
      >
        <a
          href={`/${tenantSlug}`}
          className="absolute top-5 left-6 text-white/70 hover:text-white text-sm flex items-center gap-1 transition-colors"
        >
          ← Voltar
        </a>
        <div className="px-6 pb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-gold)] mb-2 block">
            Ensaio
          </span>
          <h1 className="text-3xl font-bold text-white">{session.title}</h1>
          {session.event_date && (
            <p className="text-white/60 text-sm mt-1">
              {new Date(session.event_date).toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Sticky action bar */}
        <div
          className="sticky top-0 z-10 -mx-6 px-6 py-3 mb-6 flex items-center justify-between border-b border-[var(--color-border)]"
          style={{
            background: 'rgba(245,244,240,0.92)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <p className="text-sm text-[var(--color-ink-muted,#6b6b6b)]">
            {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}
          </p>
        </div>

        {/* Description */}
        {session.description && (
          <p className="text-[var(--color-ink-muted,#6b6b6b)] text-sm mb-6">{session.description}</p>
        )}

        <PhotoGrid
          initialPhotos={photos ?? []}
          eventId={session.id}
          total={photoCount}
        />
      </div>
    </div>
  )

  // Sessions always require a password
  return <PasswordGate eventId={session.id}>{content}</PasswordGate>
}
