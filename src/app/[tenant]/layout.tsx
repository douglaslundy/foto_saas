import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { CartButton } from '@/components/cart/cart-button'
import { CookieConsent } from '@/components/ui/cookie-consent'
import { TenantFooter } from '@/components/portal/tenant-footer'

const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

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
  // Colunas base — sempre existem
  const query = supabase.from('tenants').select('id, name, slug, status, logo_storage_path')
  const { data: tenant } = customDomain
    ? await query.eq('custom_domain', customDomain).single()
    : await query.eq('slug', slug).single()

  if (!tenant || (tenant as { status: string }).status !== 'active') notFound()

  const tenantBase = tenant as { id: string; name: string; slug: string; status: string; logo_storage_path: string | null }

  // Colunas de rodapé — adicionadas pela migration 0008, podem não existir ainda
  type FooterFields = { footer_text: string | null; footer_address: string | null; footer_phone: string | null; footer_whatsapp: string | null; footer_instagram: string | null; footer_facebook: string | null; footer_email: string | null }
  let footerData: FooterFields = { footer_text: null, footer_address: null, footer_phone: null, footer_whatsapp: null, footer_instagram: null, footer_facebook: null, footer_email: null }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: footerRow } = await (supabase as any)
      .from('tenants')
      .select('footer_text, footer_address, footer_phone, footer_whatsapp, footer_instagram, footer_facebook, footer_email')
      .eq('id', tenantBase.id)
      .single()
    if (footerRow) footerData = footerRow as FooterFields
  } catch { /* migration ainda não aplicada */ }

  const tenantRecord = { ...tenantBase, ...footerData }

  const logoUrl = tenantRecord.logo_storage_path
    ? `${STORAGE_URL}/${tenantRecord.logo_storage_path}`
    : null

  return (
    <div className="min-h-screen bg-[var(--color-surface,var(--background))]">
      {/* Top navigation bar */}
      <nav
        className="sticky top-0 z-40 border-b border-[var(--color-border)]"
        style={{ background: 'rgba(var(--color-surface-rgb), 0.92)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={tenantRecord.name}
                className="h-10 w-auto object-contain"
              />
            ) : (
              <span className="text-lg font-bold text-[var(--color-ink)]">
                {tenantRecord.name}
              </span>
            )}
          </div>
          <CartButton tenantSlug={tenantRecord.slug} />
        </div>
      </nav>
      <main>{children}</main>
      <TenantFooter data={tenantRecord} />
      <CookieConsent />
    </div>
  )
}
