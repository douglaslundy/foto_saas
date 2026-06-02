import Link from 'next/link'

export default function ContaEmAnalisePage() {
  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#111827] mb-2">Cadastro em análise</h1>
        <p className="text-sm text-[#6b7280] mb-6">
          Recebemos seu pedido! Nossa equipe irá analisá-lo em breve. Você receberá um email quando for aprovado.
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
