import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ThemeToggle } from '@/components/theme-toggle'
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
  const query = supabase.from('tenants').select('id, name, slug, status, logo_storage_path')
  const { data: tenant } = customDomain
    ? await query.eq('custom_domain', customDomain).single()
    : await query.eq('slug', slug).single()

  if (!tenant || (tenant as { status: string }).status !== 'active') notFound()

  const tenantData = tenant as { name: string; logo_storage_path: string | null }

  const logoUrl = tenantData.logo_storage_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public/${tenantData.logo_storage_path}`
    : null

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-6 py-3 flex items-center justify-between">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={tenantData.name}
            height={40}
            width={160}
            className="h-10 w-auto object-contain"
            priority
          />
        ) : (
          <span className="font-bold text-xl">{tenantData.name}</span>
        )}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <CartButton />
          <Link
            href="/login"
            className="inline-flex items-center px-3 py-1.5 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Entrar
          </Link>
        </div>
      </nav>
      <main>{children}</main>
      <CookieConsent />
    </div>
  )
}
