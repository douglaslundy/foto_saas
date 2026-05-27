import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { compare } from 'bcryptjs'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = (await (adminClient as any)
    .from('events')
    .select('id, password_hash')
    .eq('id', id)
    .single()) as { data: { id: string; password_hash: string | null } | null }

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  if (!event.password_hash) {
    return NextResponse.json({ error: 'Evento não tem senha.' }, { status: 400 })
  }

  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  if (!body.password) {
    return NextResponse.json({ error: 'Senha obrigatória.' }, { status: 400 })
  }

  const valid = await compare(body.password, event.password_hash)
  if (!valid) return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 })

  const response = NextResponse.json({ success: true })
  response.cookies.set(`event-access-${id}`, '1', {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24h
    path: '/',
  })
  return response
}
