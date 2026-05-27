import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PhotoUploader } from '@/components/photos/uploader'

type Props = { params: Promise<{ id: string }> }

export default async function FotosEventoPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = (await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()) as { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer'].includes(profile.role)) {
    redirect('/login')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = (await (adminClient as any)
    .from('events')
    .select('id, title, status')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()) as { data: { id: string; title: string; status: string } | null }

  if (!event) notFound()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/eventos">← Eventos</Link>
        </Button>
        <h1 className="text-xl font-bold">{event.title} — Fotos</h1>
      </div>

      <PhotoUploader eventId={id} />
    </div>
  )
}
