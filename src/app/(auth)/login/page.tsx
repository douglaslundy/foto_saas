import { Suspense } from 'react'
import { LoginForm } from './_components/login-form'
import { getPlatformConfig } from '@/lib/platform-config'

export default async function LoginPage() {
  const { platformName } = await getPlatformConfig()

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left — imagem/branding */}
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

      {/* Right — formulário */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6 md:hidden">
              <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
                  <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="font-semibold text-[#111827]">{platformName}</span>
            </div>
            <h2 className="text-2xl font-bold text-[#111827] mb-1">Bem-vindo de volta</h2>
            <p className="text-sm text-[#6b7280]">Entre com suas credenciais para continuar</p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
