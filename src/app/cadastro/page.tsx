import { Suspense } from 'react'
import Link from 'next/link'
import { RegistrationForm } from './_components/registration-form'
import { getPlatformConfig } from '@/lib/platform-config'

export default async function CadastroPage() {
  const { platformName } = await getPlatformConfig()

  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-6">
      <div className="w-full max-w-[480px]">
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
                <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold text-[#111827]">{platformName}</span>
          </Link>
          <h1 className="text-2xl font-bold text-[#111827] mb-1">Cadastre seu estúdio</h1>
          <p className="text-sm text-[#6b7280]">
            Preencha os dados abaixo. Seu cadastro passará por aprovação.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#e5e7eb] p-6 shadow-sm">
          <Suspense>
            <RegistrationForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-sm text-[#6b7280]">
          Já tem conta?{' '}
          <Link href="/login" className="text-[#2563eb] hover:underline font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
