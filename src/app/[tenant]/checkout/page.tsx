import { CheckoutForm } from '@/components/checkout/checkout-form'

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex flex-col">
      {/* Minimal header */}
      <header className="border-b border-[var(--color-border)] px-6 py-4 flex items-center gap-3 bg-[var(--color-card)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-ink)] flex items-center justify-center text-white text-sm">
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
          <p className="text-sm text-[var(--color-ink-muted)] mb-8">
            Preencha seus dados para receber os downloads por e-mail.
          </p>

          <div
            className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6"
            style={{ boxShadow: 'var(--shadow-md)' }}
          >
            <CheckoutForm />
          </div>
        </div>
      </div>
    </div>
  )
}
