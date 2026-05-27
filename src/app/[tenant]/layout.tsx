import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

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
  const query = supabase.from('tenants').select('id, name, slug, status')
  const { data: tenant } = customDomain
    ? // @ts-expect-error: tenant type is not properly inferred from placeholder Database type
      await query.eq('custom_domain', customDomain).single()
    : // @ts-expect-error: tenant type is not properly inferred from placeholder Database type
      await query.eq('slug', slug).single()

  // @ts-expect-error: tenant type is not properly inferred from placeholder Database type
  if (!tenant || tenant.status !== 'active') notFound()

  const tenantData = tenant as { name: string }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-xl">{tenantData.name}</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm">
            Entrar
          </Button>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
