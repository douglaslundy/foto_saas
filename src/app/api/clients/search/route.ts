// src/app/api/clients/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
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

  if (!profile?.tenant_id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const q = request.nextUrl.searchParams.get('q') ?? ''
  if (q.trim().length < 2) return NextResponse.json({ clients: [] })

  const search = `%${q.trim()}%`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('users')
    .select('id, name, email, cpf')
    .eq('tenant_id', profile.tenant_id)
    .eq('role', 'client')
    .or(`name.ilike.${search},email.ilike.${search}`)
    .order('name', { ascending: true })
    .limit(10) as { data: { id: string; name: string; email: string; cpf: string | null }[] | null; error: unknown }

  if (error) return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })

  return NextResponse.json({ clients: data ?? [] })
}
