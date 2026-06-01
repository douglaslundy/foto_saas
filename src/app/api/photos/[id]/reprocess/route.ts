import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { watermarkQueue } from '@/lib/queues/watermark-queue'

type Params = { params: Promise<{ id: string }> }

async function getAuthedProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single() as
    { data: { tenant_id: string; role: string } | null }
  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) return null
  return profile
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const profile = await getAuthedProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: photo } = await (admin as any)
    .from('photos')
    .select('id, original_storage_path, event_id, tenant_id, status')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single() as { data: { id: string; original_storage_path: string | null; event_id: string; tenant_id: string; status: string } | null }

  if (!photo) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
  if (!photo.original_storage_path) return NextResponse.json({ error: 'Foto sem arquivo original.' }, { status: 400 })

  // Reset status to pending
  await (admin as any).from('photos').update({ status: 'pending' }).eq('id', id)

  // Re-enqueue
  await watermarkQueue.add('process', {
    photo_id: photo.id,
    event_id: photo.event_id,
    tenant_id: photo.tenant_id,
    original_storage_path: photo.original_storage_path,
  })

  return NextResponse.json({ ok: true })
}
