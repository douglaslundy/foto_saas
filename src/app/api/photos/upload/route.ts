import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadOriginal } from '@/lib/storage'
import type { WatermarkJobData } from '@/lib/queues/watermark-queue'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const MAX_SIZE_BYTES = 50 * 1024 * 1024 // 50MB

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heic',
  }
  return map[mimeType] ?? 'jpg'
}

async function enqueueWatermarkJob(data: WatermarkJobData) {
  const { watermarkQueue } = await import('@/lib/queues/watermark-queue')
  await watermarkQueue.add('watermark', data)
}

export async function POST(request: NextRequest) {
  // 1. Verify authentication
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  // 2. Get user's tenant_id and role
  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null }

  if (
    !profile?.tenant_id ||
    !['photographer', 'sub_photographer'].includes(profile.role)
  ) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // 3. Parse FormData
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const eventId = formData.get('event_id') as string | null

  if (!file || !eventId) {
    return NextResponse.json({ error: 'Campos obrigatórios: file, event_id.' }, { status: 400 })
  }

  // 4. Validate file type and size
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Formato não suportado. Use JPG, PNG, WEBP ou HEIC.' },
      { status: 400 }
    )
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Arquivo muito grande. Tamanho máximo: 50MB.' },
      { status: 400 }
    )
  }

  // 5. Generate IDs and storage path
  const photoId = randomUUID()
  const ext = getExtension(file.type)
  const storagePath = `${profile.tenant_id}/${eventId}/${photoId}.${ext}`

  // 6. Upload to private bucket
  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    await uploadOriginal(buffer, storagePath)
  } catch (err) {
    console.error('[upload] Storage error:', err)
    return NextResponse.json({ error: 'Erro ao salvar arquivo.' }, { status: 500 })
  }

  // 7. Create photo record in DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (adminClient as any)
    .from('photos')
    .insert({
      id: photoId,
      event_id: eventId,
      tenant_id: profile.tenant_id,
      uploaded_by_user_id: user.id,
      original_storage_path: storagePath,
      status: 'processing',
    }) as { error: { message: string } | null }

  if (insertError) {
    console.error('[upload] DB insert error:', insertError)
    return NextResponse.json({ error: 'Erro ao registrar foto.' }, { status: 500 })
  }

  // 8. Enqueue watermark job
  try {
    await enqueueWatermarkJob({
      photo_id: photoId,
      event_id: eventId,
      tenant_id: profile.tenant_id,
      original_storage_path: storagePath,
    })
  } catch (err) {
    console.error('[upload] Queue error:', err)
    // Photo was saved — don't return error. Worker can be re-queued manually if needed.
  }

  return NextResponse.json(
    { photo_id: photoId, status: 'processing' },
    { status: 201 }
  )
}
