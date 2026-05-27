import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { generateQRCodeDataURL } from '@/lib/qrcode'

type Props = { params: Promise<{ tenant: string; slug: string }> }

export default async function EventoQRPage({ params }: Props) {
  const { tenant, slug } = await params
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow } = await (adminClient as any)
    .from('tenants')
    .select('id, name')
    .eq('slug', tenant)
    .single()

  if (!tenantRow) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (adminClient as any)
    .from('events')
    .select('id, title, status')
    .eq('slug', slug)
    .eq('tenant_id', tenantRow.id)
    .eq('type', 'event')
    .single()

  if (!event || event.status !== 'published') notFound()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const eventUrl = `${appUrl}/${tenant}/evento/${slug}`
  const qrDataUrl = await generateQRCodeDataURL(eventUrl)

  return (
    <div className="p-6 max-w-sm mx-auto text-center space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">QR Code para compartilhar</p>
      </div>

      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt={`QR Code — ${event.title}`} className="border rounded" />
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground break-all">{eventUrl}</p>
        <a
          href={qrDataUrl}
          download={`qrcode-${slug}.png`}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium"
        >
          Baixar QR Code
        </a>
      </div>
    </div>
  )
}
