import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PhotoUploader } from '@/components/photos/uploader'
import { PhotoGrid } from '@/components/photos/photo-grid'

type Props = { params: Promise<{ id: string }> }

type Photo = {
  id: string
  status: string
  thumbnail_path: string | null
  public_storage_path: string | null
  created_at: string
}

export default async function FotosEventoPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  const [eventResult, tenantResult, photosResult] = await Promise.all([
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('photos')
      .select('id, status, thumbnail_path, public_storage_path, created_at')
      .eq('event_id', id)
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false }) as Promise<{ data: Photo[] | null }>,
  ])

  const event = eventResult.data
  const tenant = tenantResult.data
  const photos = photosResult.data ?? []
  if (!event) notFound()

  const publicUrl = tenant?.slug
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${tenant.slug}/evento/${event.slug}`
    : null

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/eventos">← Eventos</Link>
        </Button>
        <h1 className="text-xl font-bold">{event.title} — Fotos</h1>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          event.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>
          {event.status === 'published' ? 'Publicado' : 'Rascunho'}
        </span>
      </div>

      {publicUrl && (
        <div className="border rounded-lg px-4 py-3 bg-muted/40 text-sm flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm mb-0.5">Link público do evento</p>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
              className="font-mono text-xs text-primary underline break-all">
              {publicUrl}
            </a>
          </div>
          {event.status !== 'published' && (
            <p className="text-xs text-muted-foreground whitespace-nowrap">(só ativo após publicar)</p>
          )}
        </div>
      )}

      <PhotoUploader eventId={id} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            {photos.length} {photos.length === 1 ? 'foto' : 'fotos'} neste evento
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/eventos/${id}/fotos`}>↻ Atualizar</Link>
          </Button>
        </div>
        <PhotoGrid photos={photos} storageBase={storageBase} />
      </div>
    </div>
  )
}
