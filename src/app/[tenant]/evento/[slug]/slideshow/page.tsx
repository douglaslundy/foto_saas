import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { SlideshowPlayer } from './_components/slideshow-player'

type Props = { params: Promise<{ tenant: string; slug: string }> }

type Photo = { id: string; public_storage_path: string }

export default async function SlideshowPage({ params }: Props) {
  const { tenant, slug } = await params
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow } = await (adminClient as any)
    .from('tenants')
    .select('id')
    .eq('slug', tenant)
    .single()

  if (!tenantRow) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (adminClient as any)
    .from('events')
    .select('id, title, status')
    .eq('slug', slug)
    .eq('tenant_id', tenantRow.id)
    .single()

  if (!event || event.status !== 'published') notFound()

  // Fetch photos (up to 200 for slideshow)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos } = (await (adminClient as any)
    .from('photos')
    .select('id, public_storage_path')
    .eq('event_id', event.id)
    .eq('status', 'ready')
    .not('public_storage_path', 'is', null)
    .order('created_at', { ascending: true })
    .limit(200)) as { data: Photo[] | null }

  return <SlideshowPlayer photos={photos ?? []} />
}
