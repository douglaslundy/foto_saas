import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import WatermarkForm from './_components/watermark-form'

export const metadata = { title: "Marca d'água" }

export default async function WatermarkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) redirect('/login')

  const { data: config } = await (admin as any)
    .from('watermark_configs')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Marca d&apos;água</h1>
      <p className="text-sm text-gray-500 mb-8">
        Configure a marca d&apos;água aplicada automaticamente nas fotos processadas.
      </p>
      <WatermarkForm tenantId={profile.tenant_id} initial={config} />
    </div>
  )
}
