import { Suspense } from 'react'
import { LoginForm } from './_components/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left column — always dark */}
      <div
        className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: '#0d0f14',
          backgroundImage:
            'radial-gradient(ellipse 60% 50% at 30% 20%, rgba(200,169,110,0.18), transparent), repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(255,255,255,0.03) 47px, rgba(255,255,255,0.03) 48px), repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(255,255,255,0.03) 47px, rgba(255,255,255,0.03) 48px)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#c8a96e] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="7" r="3" stroke="#0d0f14" strokeWidth="1.5" />
              <path
                d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5"
                stroke="#0d0f14"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="font-display font-bold text-white text-base">FotoSaaS</span>
        </div>

        {/* Footer copy */}
        <div>
          <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
            Gestão de eventos &amp; ensaios fotográficos
          </h1>
          <p className="text-white/50 text-base mb-8">
            A plataforma completa para fotógrafos profissionais.
          </p>
          <div className="flex gap-4">
            {['+2k Eventos', '98% Satisfação', '24h Suporte'].map((badge) => (
              <div
                key={badge}
                className="px-3 py-1.5 rounded-full border border-white/20 text-white/70 text-xs font-medium"
              >
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right column — form */}
      <div className="flex items-center justify-center p-8 bg-[var(--color-surface)]">
        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-[var(--color-ink)] mb-2">
              Bem-vindo de volta
            </h2>
            <p className="text-[var(--color-ink-muted)] text-sm">
              Entre com suas credenciais para continuar
            </p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
