import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  const headersList = await headers()
  const customDomain = headersList.get('x-custom-domain')

  const supabase = createAdminClient()

  const query = supabase
    .from('tenants')
    .select('id, name, slug, status')

  const { data: tenant } = customDomain
    ? await query.eq('custom_domain', customDomain).single()
    : await query.eq('slug', slug).single()

  // @ts-expect-error: tenant type is not properly inferred from placeholder Database type
  if (!tenant || tenant.status !== 'active') notFound()

  const tenantWithName = tenant as { name?: string } | null
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <span className="font-bold text-xl">{tenantWithName?.name}</span>
      </header>
      <main>{children}</main>
    </div>
  )
}
