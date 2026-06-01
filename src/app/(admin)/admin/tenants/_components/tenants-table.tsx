'use client'

import { useState } from 'react'
import Link from 'next/link'

type Tenant = {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
}

interface TenantsTableProps {
  tenants: Tenant[]
}

const PAGE_SIZE = 20

const statusClass: Record<string, string> = {
  active: 'text-green-600 bg-green-50',
  suspended: 'text-red-600 bg-red-50',
  pending: 'text-yellow-600 bg-yellow-50',
}

export function TenantsTable({ tenants }: TenantsTableProps) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(tenants.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const pageItems = tenants.slice(start, start + PAGE_SIZE)

  return (
    <div className="space-y-4">
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
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum fotógrafo encontrado.
                </td>
              </tr>
            ) : (
              pageItems.map((t) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/60 transition-colors"
          >
            ← Anterior
          </button>

          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/60 transition-colors"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
