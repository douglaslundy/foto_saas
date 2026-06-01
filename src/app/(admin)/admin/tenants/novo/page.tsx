import { NewTenantForm } from './_components/new-tenant-form'
import Link from 'next/link'

export default function NovoFotografoPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <Link
          href="/admin/tenants"
          className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          ← Voltar para Tenants
        </Link>
        <h1
          className="text-3xl font-bold tracking-tight text-[var(--color-ink)] mt-1"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Novo Tenant
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">
          Cria um novo tenant e conta de acesso para o fotógrafo.
        </p>
      </div>
      <NewTenantForm />
    </div>
  )
}
