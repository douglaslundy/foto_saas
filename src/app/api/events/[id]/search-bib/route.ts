import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

// Stub: returns all photo IDs for the event (OCR implementation in future plan)
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
  const { data: event } = (await (adminClient as any)
    .from('events')
    .select('id, status')
    .eq('id', id)
    .single()) as { data: { id: string; status: string } | null }

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  if (event.status !== 'published') {
    return NextResponse.json({ error: 'Evento não publicado.' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos } = (await (adminClient as any)
    .from('photos')
    .select('id')
    .eq('event_id', id)
    .eq('status', 'ready')
    .range(0, 499)) as { data: { id: string }[] | null }

  const photoIds = (photos ?? []).map((p) => p.id)
  return NextResponse.json({ photo_ids: photoIds, count: photoIds.length })
}
