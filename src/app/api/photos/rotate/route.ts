import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { watermarkQueue } from '@/lib/queues/watermark-queue'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  let body: { photo_ids?: string[]; direction?: 'left' | 'right' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { photo_ids, direction } = body
  if (!Array.isArray(photo_ids) || photo_ids.length === 0 || (direction !== 'left' && direction !== 'right')) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, error } = await (admin as any)
    .from('photos')
    .select('id, original_storage_path, event_id, tenant_id, rotation_degrees')
    .in('id', photo_ids)
    .eq('tenant_id', profile.tenant_id)
    .not('original_storage_path', 'is', null)
    .neq('status', 'processing') as {
      data: { id: string; original_storage_path: string; event_id: string; tenant_id: string; rotation_degrees: number }[] | null
      error: unknown
    }

  if (error || !photos) {
    return NextResponse.json({ error: 'Erro ao buscar fotos.' }, { status: 500 })
  }

  const delta = direction === 'right' ? 90 : -90

  await Promise.all(
    photos.map(async (p) => {
      const newRotation = ((p.rotation_degrees + delta) % 360 + 360) % 360

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('photos')
        .update({ rotation_degrees: newRotation, status: 'pending' })
        .eq('id', p.id)

      await watermarkQueue.add('process', {
        photo_id: p.id,
        event_id: p.event_id,
        tenant_id: p.tenant_id,
        original_storage_path: p.original_storage_path,
      })
    })
  )

  return NextResponse.json({ count: photos.length })
}
