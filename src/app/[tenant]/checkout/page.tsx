import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CheckoutForm } from '@/components/checkout/checkout-form'

type Props = { params: Promise<{ tenant: string }> }

export default async function CheckoutPage({ params }: Props) {
  const { tenant: tenantSlug } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userEmail: string | undefined
  let isLoggedIn = false

  if (user) {
    isLoggedIn = true
    userEmail = user.email ?? undefined
  }

  // Fetch profile role to determine access
  let profileRole: string | null = null
  if (user) {
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (adminClient as any)
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    profileRole = profile?.role ?? null
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex flex-col">
      {/* Minimal header */}
      <header className="border-b border-[var(--color-border)] px-6 py-4 flex items-center gap-3 bg-[var(--color-card)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-cta)] flex items-center justify-center text-[var(--color-cta-fg)] text-sm">
          📷
        </div>
        <span className="font-display font-bold text-[var(--color-ink)]">FotoSaaS</span>
        <div className="ml-auto text-sm text-[var(--color-ink-muted)]">Compra segura</div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center p-6 pt-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-2xl font-bold text-[var(--color-ink)] mb-2">
            Finalizar Compra
          </h1>

          {!isLoggedIn ? (
            /* Not logged in — prompt login */
            <div
              className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-8 text-center"
              style={{ boxShadow: 'var(--shadow-md)' }}
            >
              <p className="text-[var(--color-ink)] font-semibold mb-2">Login necessário</p>
              <p className="text-sm text-[var(--color-ink-muted)] mb-6">
                Faça login ou crie uma conta para finalizar sua compra.
              </p>
              <Link
                href={`/${tenantSlug}/login?redirect=checkout`}
                className="inline-flex items-center justify-center w-full h-[50px] rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] font-semibold text-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
              >
                Entrar na minha conta
              </Link>
              <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
                Não tem conta?{' '}
                <Link
                  href={`/${tenantSlug}/cadastro`}
                  className="text-[var(--color-gold)] font-medium hover:underline"
                >
                  Cadastrar &rarr;
                </Link>
              </p>
            </div>
          ) : (
            /* Logged in — show checkout form */
            <>
              <p className="text-sm text-[var(--color-ink-muted)] mb-8">
                Preencha seus dados para receber os downloads por e-mail.
              </p>
              <div
                className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6"
                style={{ boxShadow: 'var(--shadow-md)' }}
              >
                <CheckoutForm
                  initialEmail={profileRole === 'client' ? (userEmail ?? '') : ''}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
