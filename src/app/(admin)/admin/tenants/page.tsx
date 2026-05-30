import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

type Tenant = {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
}

export default async function TenantsPage() {
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenants } = (await (adminClient as any)
    .from('tenants')
    .select('id, name, slug, status, created_at')
    .order('created_at', { ascending: false })) as { data: Tenant[] | null }

  const statusClass: Record<string, string> = {
    active: 'text-green-600 bg-green-50',
    suspended: 'text-red-600 bg-red-50',
    pending: 'text-yellow-600 bg-yellow-50',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fotógrafos ({tenants?.length ?? 0})</h1>
        <Link
          href="/admin/tenants/novo"
          className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          + Novo Fotógrafo
        </Link>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Nome</th>
              <th className="px-4 py-2 text-left font-medium">Slug</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Criado em</th>
              <th className="px-4 py-2 text-left font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(tenants ?? []).map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass[t.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/tenants/${t.id}`}
                    className="text-primary text-xs underline"
                  >
                    Ver detalhes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
