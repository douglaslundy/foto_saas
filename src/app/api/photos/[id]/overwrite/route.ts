import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadOriginal } from '@/lib/storage'
import { watermarkQueue } from '@/lib/queues/watermark-queue'

type Params = { params: Promise<{ id: string }> }

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

async function getAuthedProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single() as
    { data: { tenant_id: string; role: string } | null }
  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) return null
  return profile
}

// POST /api/photos/[id]/overwrite — o fotógrafo reenvia a mesma foto após editá-la
// externamente. O novo original substitui o antigo; os arquivos antigos (original,
// miniatura e preview) só são apagados depois que o reprocessamento da nova versão
// terminar com sucesso (status=ready), feito pelo worker de marca d'água.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const profile = await getAuthedProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photo } = await (admin as any)
    .from('photos')
    .select('id, event_id, tenant_id, status, original_storage_path, thumbnail_path, public_storage_path')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single() as { data: {
      id: string; event_id: string; tenant_id: string; status: string
      original_storage_path: string | null; thumbnail_path: string | null; public_storage_path: string | null
    } | null }

  if (!photo) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
  if (photo.status === 'processing') {
    return NextResponse.json({ error: 'Esta foto ainda está sendo processada. Aguarde e tente novamente.' }, { status: 409 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Campo obrigatório: file.' }, { status: 400 })

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Formato não suportado. Use JPG, PNG, WEBP ou HEIC.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Arquivo muito grande. Tamanho máximo: 50MB.' }, { status: 400 })
  }

  const ext = getExtension(file.type)
  const newStoragePath = `${profile.tenant_id}/${photo.event_id}/${photo.id}-${randomUUID().slice(0, 8)}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    await uploadOriginal(buffer, newStoragePath, file.type)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[photos/overwrite] Storage error:', msg)
    return NextResponse.json({ error: 'Erro ao salvar arquivo.', detail: msg }, { status: 500 })
  }

  // Aponta a foto para o novo original e zera a rotação manual (a versão editada
  // já deve estar corretamente orientada). Miniatura/preview antigos permanecem
  // visíveis até o reprocessamento terminar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (admin as any)
    .from('photos')
    .update({
      original_storage_path: newStoragePath,
      status: 'processing',
      rotation_degrees: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', photo.id)

  if (updateError) {
    console.error('[photos/overwrite] DB update error:', updateError)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).storage.from('photos-original').remove([newStoragePath])
    } catch (cleanupErr) {
      console.error('[photos/overwrite] Failed to clean up orphaned storage object:', cleanupErr)
    }
    return NextResponse.json({ error: 'Erro ao registrar nova versão.' }, { status: 500 })
  }

  try {
    await watermarkQueue.add('watermark', {
      photo_id: photo.id,
      event_id: photo.event_id,
      tenant_id: profile.tenant_id,
      original_storage_path: newStoragePath,
      previous_original_storage_path: photo.original_storage_path ?? undefined,
      previous_thumbnail_path: photo.thumbnail_path ?? undefined,
      previous_public_storage_path: photo.public_storage_path ?? undefined,
    })
  } catch (err) {
    console.error('[photos/overwrite] Queue error:', err)
  }

  return NextResponse.json({ photo_id: photo.id, status: 'processing' })
}
