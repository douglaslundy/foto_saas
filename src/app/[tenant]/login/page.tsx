import { Suspense } from 'react'
import { LoginForm } from './_components/login-form'

type Props = { params: Promise<{ tenant: string }> }

export default async function ClientLoginPage({ params }: Props) {
  const { tenant: tenantSlug } = await params

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        {/* Card */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold text-[var(--color-ink)] mb-2">
              Entrar
            </h1>
            <p className="text-[var(--color-ink-muted)] text-sm">
              Acesse sua conta para ver seus pedidos e downloads
            </p>
          </div>
          <Suspense>
            <LoginForm tenantSlug={tenantSlug} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
