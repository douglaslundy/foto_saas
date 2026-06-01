import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params

  let body: { bib_number?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  if (!body.bib_number) {
    return NextResponse.json({ error: 'bib_number obrigatório.' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, error } = await (adminClient as any)
    .from('photos')
    .select('id')
    .eq('event_id', id)
    .eq('bib_number', body.bib_number)
    .eq('status', 'ready')

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar fotos.' }, { status: 500 })
  }

  const photo_ids: string[] = (photos ?? []).map((p: { id: string }) => p.id)

  return NextResponse.json({ photo_ids, count: photo_ids.length })
}
