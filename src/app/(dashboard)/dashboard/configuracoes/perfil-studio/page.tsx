import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PerfilStudioForm } from './_components/perfil-studio-form'

async function getTenantProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants')
    .select('name, slug, custom_domain, primary_color, bio')
    .eq('id', profile.tenant_id)
    .single()

  if (!tenant) redirect('/login')

  return tenant as {
    name: string
    slug: string
    custom_domain: string | null
    primary_color: string | null
    bio: string | null
  }
}

export default async function PerfilStudioPage() {
  const tenant = await getTenantProfile()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Perfil do Estúdio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as informações públicas do seu estúdio.
        </p>
      </div>

      <div className="border rounded-lg p-6">
        <PerfilStudioForm initial={tenant} />
      </div>
    </div>
  )
}
