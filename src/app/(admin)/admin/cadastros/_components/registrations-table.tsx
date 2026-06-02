'use client'

import { useState } from 'react'

type Registration = {
  tenant_id: string
  studio_name: string
  slug: string
  created_at: string
  photographer: { name: string; email: string } | null
  registration: { phone: string; cpf_cnpj: string; city: string } | null
}

type Props = { registrations: Registration[] }

export function RegistrationsTable({ registrations: initial }: Props) {
  const [items, setItems] = useState(initial)
  const [rejectModal, setRejectModal] = useState<{ tenantId: string; studioName: string } | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [working, setWorking] = useState<string | null>(null)

  async function handleApprove(tenantId: string) {
    setWorking(tenantId)
    try {
      const res = await fetch(`/api/admin/registrations/${tenantId}/approve`, { method: 'PATCH' })
      if (res.ok) setItems((prev) => prev.filter((r) => r.tenant_id !== tenantId))
    } finally {
      setWorking(null)
    }
  }

  async function handleReject() {
    if (!rejectModal) return
    setWorking(rejectModal.tenantId)
    try {
      const res = await fetch(`/api/admin/registrations/${rejectModal.tenantId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: rejectNotes }),
      })
      if (res.ok) {
        setItems((prev) => prev.filter((r) => r.tenant_id !== rejectModal.tenantId))
        setRejectModal(null)
        setRejectNotes('')
      }
    } finally {
      setWorking(null)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
        {/* Header */}
        <div className="bg-[#f9fafb] px-6 py-3 border-b border-[#e5e7eb] grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4">
          {['Estúdio', 'Fotógrafo', 'Cidade', 'Data', 'Ações'].map((h) => (
            <span key={h} className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{h}</span>
          ))}
        </div>

        <div className="divide-y divide-[#f3f4f6]">
          {items.map((r) => (
            <div key={r.tenant_id} className="px-6 py-4 grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4 items-center">
              <div>
                <p className="text-sm font-semibold text-[#111827]">{r.studio_name}</p>
                <p className="text-xs text-[#9ca3af] font-mono">{r.slug}</p>
                {r.registration && (
                  <p className="text-xs text-[#9ca3af]">CPF/CNPJ: {r.registration.cpf_cnpj}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-[#111827]">{r.photographer?.name ?? '—'}</p>
                <p className="text-xs text-[#6b7280]">{r.photographer?.email ?? '—'}</p>
                {r.registration && (
                  <p className="text-xs text-[#9ca3af]">{r.registration.phone}</p>
                )}
              </div>
              <p className="text-sm text-[#6b7280]">{r.registration?.city ?? '—'}</p>
              <p className="text-sm text-[#6b7280]">
                {new Date(r.created_at).toLocaleDateString('pt-BR')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApprove(r.tenant_id)}
                  disabled={working === r.tenant_id}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {working === r.tenant_id ? '…' : 'Aprovar'}
                </button>
                <button
                  onClick={() => setRejectModal({ tenantId: r.tenant_id, studioName: r.studio_name })}
                  disabled={working === r.tenant_id}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-1">Rejeitar cadastro</h2>
            <p className="text-sm text-[#6b7280] mb-4">{rejectModal.studioName}</p>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              Motivo (opcional)
            </label>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              placeholder="Ex: documentação insuficiente, área não atendida…"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setRejectModal(null); setRejectNotes('') }}
                className="flex-1 py-2.5 border border-[#e5e7eb] rounded-xl text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={working === rejectModal.tenantId}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {working === rejectModal.tenantId ? 'Rejeitando…' : 'Confirmar rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
