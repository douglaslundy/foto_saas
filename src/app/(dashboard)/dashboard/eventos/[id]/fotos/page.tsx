import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PhotoUploader } from '@/components/photos/uploader'

type Props = { params: Promise<{ id: string }> }

export default async function FotosEventoPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = (await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()) as { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    redirect('/login')
  }

  const [eventResult, tenantResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('events')
      .select('id, title, slug, status')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single() as Promise<{ data: { id: string; title: string; slug: string; status: string } | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('tenants')
      .select('slug')
      .eq('id', profile.tenant_id)
      .single() as Promise<{ data: { slug: string } | null }>,
  ])

  const event = eventResult.data
  const tenant = tenantResult.data
  if (!event) notFound()

  const publicUrl = tenant?.slug
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${tenant.slug}/evento/${event.slug}`
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/eventos">← Eventos</Link>
        </Button>
        <h1 className="text-xl font-bold">{event.title} — Fotos</h1>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          event.status === 'published'
            ? 'bg-green-100 text-green-700'
            : 'bg-yellow-100 text-yellow-700'
        }`}>
          {event.status === 'published' ? 'Publicado' : 'Rascunho'}
        </span>
      </div>

      {publicUrl && (
        <div className="border rounded-lg px-4 py-3 bg-muted/40 text-sm flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm mb-0.5">Link público do evento</p>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-primary underline break-all"
            >
              {publicUrl}
            </a>
          </div>
          {event.status !== 'published' && (
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              (só ativo após publicar)
            </p>
          )}
        </div>
      )}

      <PhotoUploader eventId={id} />
    </div>
  )
}
