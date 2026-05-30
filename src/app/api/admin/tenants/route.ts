import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { tenantName, slug, photographerName, email, password } = await request.json()

    if (!tenantName || !slug || !email || !password) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 1. Criar tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tenant, error: tenantError } = await (adminClient as any)
      .from('tenants')
      .insert({ name: tenantName, slug: slug.toLowerCase().trim(), status: 'active' })
      .select()
      .single()

    if (tenantError) {
      return NextResponse.json(
        { error: tenantError.message.includes('unique') ? 'Slug já em uso.' : tenantError.message },
        { status: 400 }
      )
    }

    // 2. Criar usuário no GoTrue
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      // Rollback tenant
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any).from('tenants').delete().eq('id', tenant.id)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 3. Criar perfil em public.users
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient as any).from('users').insert({
      id: authData.user.id,
      email,
      name: photographerName || tenantName,
      role: 'photographer',
      tenant_id: tenant.id,
    })

    return NextResponse.json({ success: true, tenantId: tenant.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
