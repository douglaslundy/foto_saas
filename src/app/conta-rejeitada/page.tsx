import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function ContaRejeitadaPage() {
  let rejectionNote: string | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const admin = createAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (admin as any)
        .from('users').select('tenant_id').eq('id', user.id).single() as
        { data: { tenant_id: string } | null }

      if (profile?.tenant_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: reg } = await (admin as any)
          .from('tenant_registrations').select('notes').eq('tenant_id', profile.tenant_id).single() as
          { data: { notes: string | null } | null }
        rejectionNote = reg?.notes ?? null
      }
    }
  } catch {
    // fail gracefully
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#111827] mb-2">Cadastro não aprovado</h1>
        <p className="text-sm text-[#6b7280] mb-4">
          Infelizmente seu cadastro não foi aprovado no momento.
        </p>
        {rejectionNote && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4 text-left">
            <strong>Motivo:</strong> {rejectionNote}
          </div>
        )}
        <p className="text-xs text-[#9ca3af] mb-6">
          Se tiver dúvidas, entre em contato conosco.
        </p>
        <Link
          href="/api/auth/signout"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg border border-[#e5e7eb] text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          Sair
        </Link>
      </div>
    </div>
  )
}
