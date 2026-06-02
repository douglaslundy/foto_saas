import Link from 'next/link'
import { getPlatformConfig } from '@/lib/platform-config'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { platformName } = await getPlatformConfig()

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left — branding */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-[#111827]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2563eb] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
              <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-semibold text-white">{platformName}</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Gestão de eventos &amp; ensaios fotográficos
          </h1>
          <p className="text-white/50 text-base">
            A plataforma completa para fotógrafos profissionais.
          </p>
        </div>
      </div>

      {/* Right — ações */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[380px]">
          {/* Logo mobile */}
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
                <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold text-[#111827]">{platformName}</span>
          </div>

          <h2 className="text-2xl font-bold text-[#111827] mb-2">Bem-vindo</h2>
          <p className="text-sm text-[#6b7280] mb-8">
            Gerencie eventos, ensaios e vendas de fotos em um só lugar.
          </p>

          <div className="space-y-3">
            <Link
              href="/login"
              className="flex items-center justify-center w-full h-12 rounded-lg bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="flex items-center justify-center w-full h-12 rounded-lg border-2 border-[#2563eb] text-[#2563eb] font-semibold text-sm hover:bg-[#eff6ff] transition-colors"
            >
              Cadastre seu estúdio
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-[#9ca3af]">
            Já tem conta?{' '}
            <Link href="/login" className="text-[#2563eb] hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
