import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { EventsSearchGrid } from './_components/events-search-grid'

type Props = { params: Promise<{ tenant: string }> }

export default async function TenantHomePage({ params }: Props) {
  const { tenant: slug } = await params
  const headersList = await headers()
  const customDomain = headersList.get('x-custom-domain')

  const adminClient = createAdminClient()
  const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

  const query = adminClient.from('tenants').select('id, name, slug, status, bio, banner_image_path, banner_title, banner_subtitle')
  const { data: tenant } = customDomain
    ? await query.eq('custom_domain', customDomain).single()
    : await query.eq('slug', slug).single()

  if (!tenant || (tenant as { status: string }).status !== 'active') notFound()

  const tenantData = tenant as { id: string; slug: string; name: string; bio: string | null; banner_image_path: string | null; banner_title: string | null; banner_subtitle: string | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events } = (await (adminClient as any)
    .from('events')
    .select('id, title, slug, type, event_date, created_at, cover_image_path')
    .eq('tenant_id', tenantData.id)
    .eq('status', 'published')
    .order('event_date', { ascending: false })
    .range(0, 49)) as {
    data: {
      id: string; title: string; slug: string; type: 'event' | 'session'
      event_date: string | null; created_at: string; cover_image_path?: string | null
    }[] | null
  }

  const bannerUrl = tenantData.banner_image_path
    ? `${STORAGE_URL}/${tenantData.banner_image_path}`
    : null

  return (
    <div className="min-h-screen bg-white">
      {/* Banner */}
      <div className="relative h-60 bg-[#111827] overflow-hidden">
        {bannerUrl && (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        )}
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-3xl font-bold text-white">{tenantData.name}</h1>
          {tenantData.bio && (
            <p className="text-white/70 text-sm mt-2 max-w-md">{tenantData.bio}</p>
          )}
        </div>
      </div>

      {/* Eventos */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-[#111827]">Eventos e Ensaios</h2>
        </div>
        <EventsSearchGrid events={events ?? []} tenantSlug={tenantData.slug} />
      </div>

      {/* Footer simples */}
      <footer className="border-t border-[#e5e7eb] py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          © {new Date().getFullYear()} {tenantData.name}
        </p>
      </footer>
    </div>
  )
}
