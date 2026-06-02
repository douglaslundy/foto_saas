import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/slug'
import { sendRegistrationNotification } from '@/lib/notifications/email'

export async function POST(request: NextRequest) {
  let body: {
    name?: string
    email?: string
    password?: string
    phone?: string
    cpf_cnpj?: string
    studio_name?: string
    city?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { name, email, password, phone, cpf_cnpj, studio_name, city } = body

  if (!name?.trim() || !email?.trim() || !password || !phone?.trim() ||
      !cpf_cnpj?.trim() || !studio_name?.trim() || !city?.trim()) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Senha deve ter ao menos 8 caracteres.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Generate unique slug
  const baseSlug = slugify(studio_name)
  let slug = baseSlug
  let suffix = 1
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!existing) break
    slug = `${baseSlug}-${suffix++}`
  }

  // Create tenant with status pending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant, error: tenantError } = await (admin as any)
    .from('tenants')
    .insert({ name: studio_name.trim(), slug, status: 'pending' })
    .select('id, name, slug')
    .single() as { data: { id: string; name: string; slug: string } | null; error: unknown }

  if (tenantError || !tenant) {
    console.error('[register] tenant insert error:', tenantError)
    return NextResponse.json({ error: 'Erro ao criar estúdio.' }, { status: 500 })
  }

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  })

  if (authError) {
    // Rollback tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('tenants').delete().eq('id', tenant.id)
    const isConflict = authError.message?.toLowerCase().includes('already')
    return NextResponse.json(
      { error: isConflict ? 'Email já cadastrado.' : 'Erro ao criar conta.' },
      { status: isConflict ? 409 : 500 }
    )
  }

  const userId = authData.user.id

  // Create users row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('users').insert({
    id: userId,
    email: email.trim(),
    name: name.trim(),
    role: 'photographer',
    tenant_id: tenant.id,
  })

  // Create registration details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('tenant_registrations').insert({
    tenant_id: tenant.id,
    phone: phone.trim(),
    cpf_cnpj: cpf_cnpj.trim(),
    city: city.trim(),
  })

  // Notify super admin
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
  if (superAdminEmail) {
    await sendRegistrationNotification({
      to: superAdminEmail,
      studioName: tenant.name,
      photographerName: name.trim(),
      email: email.trim(),
      city: city.trim(),
      phone: phone.trim(),
      cpfCnpj: cpf_cnpj.trim(),
    })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
