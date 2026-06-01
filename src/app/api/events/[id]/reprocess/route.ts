import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { watermarkQueue } from '@/lib/queues/watermark-queue'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id: eventId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // Verify event belongs to this tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (admin as any)
    .from('events')
    .select('id, tenant_id')
    .eq('id', eventId)
    .eq('tenant_id', profile.tenant_id)
    .single() as { data: { id: string; tenant_id: string } | null }

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })

  // Fetch all photos with an original file (any status except 'processing')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, error } = await (admin as any)
    .from('photos')
    .select('id, original_storage_path, tenant_id')
    .eq('event_id', eventId)
    .eq('tenant_id', profile.tenant_id)
    .not('original_storage_path', 'is', null)
    .neq('status', 'processing') as { data: { id: string; original_storage_path: string; tenant_id: string }[] | null; error: unknown }

  if (error || !photos) {
    return NextResponse.json({ error: 'Erro ao buscar fotos.' }, { status: 500 })
  }

  if (photos.length === 0) {
    return NextResponse.json({ count: 0 })
  }

  // Reset all to pending
  const ids = photos.map((p) => p.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('photos')
    .update({ status: 'pending' })
    .in('id', ids)

  // Re-enqueue watermark jobs
  await Promise.all(
    photos.map((p) =>
      watermarkQueue.add('process', {
        photo_id: p.id,
        event_id: eventId,
        tenant_id: p.tenant_id,
        original_storage_path: p.original_storage_path,
      })
    )
  )

  return NextResponse.json({ count: photos.length })
}
