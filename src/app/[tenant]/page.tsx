import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { EventsSearchGrid } from './_components/events-search-grid'
import { CarouselBanner, type CarouselSlide } from '@/components/portal/carousel-banner'

type Props = { params: Promise<{ tenant: string }> }

export default async function TenantHomePage({ params }: Props) {
  const { tenant: slug } = await params
  const headersList = await headers()
  const customDomain = headersList.get('x-custom-domain')

  const adminClient = createAdminClient()

  const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

  // Resolve tenant — colunas base (sempre existem)
  const query = adminClient.from('tenants').select('id, name, slug, status, bio, banner_image_path, banner_title, banner_subtitle')
  const { data: tenant } = customDomain
    ? await query.eq('custom_domain', customDomain).single()
    : await query.eq('slug', slug).single()

  if (!tenant || (tenant as { status: string }).status !== 'active') notFound()

  const tenantData = tenant as { id: string; slug: string; name: string; bio: string | null; banner_image_path: string | null; banner_title: string | null; banner_subtitle: string | null }

  // Tentar buscar banner_mode (coluna nova — pode não existir em instâncias sem migration)
  let bannerMode = 'static'
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: modeRow } = await (adminClient as any)
      .from('tenants')
      .select('banner_mode')
      .eq('id', tenantData.id)
      .single()
    if (modeRow?.banner_mode) bannerMode = modeRow.banner_mode
  } catch { /* migration ainda não aplicada — usar modo static */ }

  // Fetch carousel slides if mode is carousel
  let carouselSlides: CarouselSlide[] = []
  if (bannerMode === 'carousel') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bImgs } = await (adminClient as any)
      .from('banner_images')
      .select('id, storage_path, title, subtitle')
      .eq('tenant_id', tenantData.id)
      .eq('active', true)
      .order('sort_order', { ascending: true })
    carouselSlides = (bImgs ?? []).map((b: { id: string; storage_path: string; title: string | null; subtitle: string | null }) => ({
      id: b.id,
      url: `${STORAGE_URL}/${b.storage_path}`,
      title: b.title,
      subtitle: b.subtitle,
    }))
  }

  // Fetch published events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events } = (await (adminClient as any)
    .from('events')
    .select('id, title, slug, type, event_date, created_at, cover_image_path')
    .eq('tenant_id', tenantData.id)
    .eq('status', 'published')
    .order('event_date', { ascending: false })
    .range(0, 49)) as {
    data: {
      id: string
      title: string
      slug: string
      type: 'event' | 'session'
      event_date: string | null
      created_at: string
      cover_image_path?: string | null
    }[] | null
  }

  const tenantName = tenantData.name

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Hero section */}
      <div
        className="relative min-h-[380px] flex flex-col justify-between overflow-hidden"
        style={{
          background: '#0d0f14',
          backgroundImage:
            'radial-gradient(ellipse 60% 50% at 30% 20%, rgba(200,169,110,0.15), transparent)',
        }}
      >
        {bannerMode === 'carousel' && carouselSlides.length > 0 ? (
          <CarouselBanner slides={carouselSlides} className="absolute inset-0" />
        ) : tenantData.banner_image_path ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${STORAGE_URL}/${tenantData.banner_image_path})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)] via-[var(--color-ink-soft)] to-[var(--color-ink)]" />
        )}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          {/* Logo/avatar do tenant */}
          <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center mb-6 text-3xl font-bold text-white">
            {tenantName?.[0]?.toUpperCase() || '📷'}
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">{tenantName}</h1>
          {tenantData.bio && (
            <p className="text-white/60 text-base max-w-md">{tenantData.bio}</p>
          )}
        </div>
      </div>

      {/* Eventos e Ensaios */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-6">Eventos e Ensaios</h2>

        <EventsSearchGrid events={events ?? []} tenantSlug={tenantData.slug} />
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-8 text-center">
        <p className="text-xs text-[var(--color-ink-muted)]">
          © {new Date().getFullYear()} {tenantName} — powered by FotoSaaS
        </p>
      </footer>
    </div>
  )
}
