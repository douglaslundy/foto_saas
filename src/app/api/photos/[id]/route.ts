import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

async function getAuthedProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    return null
  }
  return profile
}

// GET /api/photos/[id] — retorna status atual da foto
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const profile = await getAuthedProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photo } = await (admin as any)
    .from('photos')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single() as { data: { id: string; status: string } | null }

  if (!photo) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
  return NextResponse.json({ id: photo.id, status: photo.status })
}

// DELETE /api/photos/[id] — remove foto do storage e do banco
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const profile = await getAuthedProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photo } = await (admin as any)
    .from('photos')
    .select('id, original_storage_path, thumbnail_path, public_storage_path')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single() as {
      data: {
        id: string
        original_storage_path: string | null
        thumbnail_path: string | null
        public_storage_path: string | null
      } | null
    }

  if (!photo) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })

  // Remove arquivos do storage
  const originalPaths = [photo.original_storage_path].filter(Boolean) as string[]
  const publicPaths = [photo.thumbnail_path, photo.public_storage_path].filter(Boolean) as string[]

  if (originalPaths.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).storage.from('photos-original').remove(originalPaths)
  }
  if (publicPaths.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).storage.from('photos-public').remove(publicPaths)
  }

  // Remove do banco
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('photos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Erro ao deletar foto.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
