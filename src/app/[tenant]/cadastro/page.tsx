import { Suspense } from 'react'
import { RegisterForm } from './_components/register-form'

type Props = { params: Promise<{ tenant: string }> }

export default async function CadastroPage({ params }: Props) {
  const { tenant: tenantSlug } = await params

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        {/* Card */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold text-[var(--color-ink)] mb-2">
              Criar conta
            </h1>
            <p className="text-[var(--color-ink-muted)] text-sm">
              Cadastre-se para comprar fotos dos eventos
            </p>
          </div>
          <Suspense>
            <RegisterForm tenantSlug={tenantSlug} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
