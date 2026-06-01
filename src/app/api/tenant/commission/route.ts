import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'Tenant não encontrado.' }, { status: 404 })
  }

  // Fetch tenant override and global setting in parallel
  const [tenantResult, settingResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('tenants')
      .select('commission_override_percent')
      .eq('id', profile.tenant_id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('system_settings')
      .select('value')
      .eq('key', 'global_commission_percent')
      .single(),
  ])

  const override = tenantResult.data?.commission_override_percent
  const globalPercent = parseInt(settingResult.data?.value ?? '10', 10)

  const commission_percent = override !== null && override !== undefined ? override : globalPercent

  return NextResponse.json({ commission_percent })
}
