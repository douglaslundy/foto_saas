import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { CartButton } from '@/components/cart/cart-button'
import { CookieConsent } from '@/components/ui/cookie-consent'

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
    ? await query.eq('custom_domain', customDomain).single()
    : await query.eq('slug', slug).single()

  if (!tenant || (tenant as { status: string }).status !== 'active') notFound()

  return (
    <div className="min-h-screen bg-[var(--color-surface,var(--background))]">
      {/* CartButton floating — available across all tenant pages */}
      <div className="fixed top-4 right-4 z-50">
        <CartButton />
      </div>
      <main>{children}</main>
      <CookieConsent />
    </div>
  )
}
