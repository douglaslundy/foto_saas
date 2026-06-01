'use client'

import { useState } from 'react'

interface PhotoPackage {
  id: string
  tenant_id: string
  name: string
  min_quantity: number
  discount_percent: number
  active: boolean
  created_at: string
}

interface PackagesManagerProps {
  initialPackages: PhotoPackage[]
}

const inputClass =
  'h-11 px-4 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(200,169,110,0.12)] placeholder:text-[var(--color-ink-muted)]'
const labelClass =
  'block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)] mb-1.5'

const EMPTY_FORM = { name: '', min_quantity: 10, discount_percent: 10, active: true }

export default function PackagesManager({ initialPackages }: PackagesManagerProps) {
  const [packages, setPackages] = useState<PhotoPackage[]>(initialPackages)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function startEdit(pkg: PhotoPackage) {
    setEditingId(pkg.id)
    setForm({
      name: pkg.name,
      min_quantity: pkg.min_quantity,
      discount_percent: pkg.discount_percent,
      active: pkg.active,
    })
    setMessage(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setMessage(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      if (editingId) {
        // PATCH existing
        const res = await fetch(`/api/packages/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const json = await res.json()
        if (!res.ok) {
          setMessage({ type: 'error', text: json.error ?? 'Erro ao atualizar.' })
        } else {
          setPackages(prev => prev.map(p => p.id === editingId ? json.package : p))
          setEditingId(null)
          setForm(EMPTY_FORM)
          setMessage({ type: 'success', text: 'Pacote atualizado com sucesso!' })
        }
      } else {
        // POST new
        const res = await fetch('/api/packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const json = await res.json()
        if (!res.ok) {
          setMessage({ type: 'error', text: json.error ?? 'Erro ao criar pacote.' })
        } else {
          setPackages(prev => [...prev, json.package].sort((a, b) => a.min_quantity - b.min_quantity))
          setForm(EMPTY_FORM)
          setMessage({ type: 'success', text: 'Pacote criado com sucesso!' })
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro inesperado.' })
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(pkg: PhotoPackage) {
    try {
      const res = await fetch(`/api/packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !pkg.active }),
      })
      const json = await res.json()
      if (res.ok) {
        setPackages(prev => prev.map(p => p.id === pkg.id ? json.package : p))
      }
    } catch {
      // silent fail on toggle
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este pacote?')) return
    try {
      const res = await fetch(`/api/packages/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setPackages(prev => prev.filter(p => p.id !== id))
        if (editingId === id) cancelEdit()
        setMessage({ type: 'success', text: 'Pacote excluído.' })
      } else {
        const json = await res.json()
        setMessage({ type: 'error', text: json.error ?? 'Erro ao excluir.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro inesperado ao excluir.' })
    }
  }

  return (
    <div className="space-y-4">
      {/* Package list */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-5 border-b border-[var(--color-border-strong)]">
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Pacotes de desconto</h2>
          <p className="text-[var(--color-ink-muted)] text-sm mt-0.5">Ofereça descontos progressivos por quantidade de fotos</p>
        </div>

        {packages.length === 0 ? (
          <div className="px-6 py-10 text-center text-[var(--color-ink-muted)] text-sm">
            Nenhum pacote configurado ainda. Adicione um pacote abaixo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)]">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)]">Qtd mínima</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)]">Desconto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)]">Ativo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {packages.map(pkg => (
                  <tr key={pkg.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-alt)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{pkg.name}</td>
                    <td className="px-4 py-3 text-[var(--color-ink-soft)]">{pkg.min_quantity} fotos</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-gold)] text-white">
                        {pkg.discount_percent}% off
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(pkg)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          pkg.active ? 'bg-[var(--color-gold)]' : 'bg-[var(--color-border-strong)]'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            pkg.active ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(pkg)}
                          className="text-xs px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-alt)] transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(pkg.id)}
                          className="text-xs px-3 py-1.5 rounded-[var(--radius-sm)] border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit form */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-5 border-b border-[var(--color-border-strong)]">
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
            {editingId ? 'Editar pacote' : 'Adicionar pacote'}
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            <div>
              <label htmlFor="pkg_name" className={labelClass}>Nome do pacote</label>
              <input
                id="pkg_name"
                type="text"
                required
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Pacote Básico"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="pkg_min_quantity" className={labelClass}>Qtd mínima de fotos</label>
                <input
                  id="pkg_min_quantity"
                  type="number"
                  required
                  min={1}
                  value={form.min_quantity}
                  onChange={e => setForm(prev => ({ ...prev, min_quantity: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="pkg_discount" className={labelClass}>Desconto (%)</label>
                <input
                  id="pkg_discount"
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={form.discount_percent}
                  onChange={e => setForm(prev => ({ ...prev, discount_percent: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                    className="sr-only"
                  />
                  <div
                    className={`h-5 w-9 rounded-full transition-colors ${
                      form.active ? 'bg-[var(--color-gold)]' : 'bg-[var(--color-border-strong)]'
                    }`}
                  >
                    <span
                      className={`inline-block mt-0.75 h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        form.active ? 'translate-x-4' : 'translate-x-1'
                      }`}
                      style={{ marginTop: '3px' }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium text-[var(--color-ink)]">Pacote ativo</span>
              </label>
            </div>

            {message && (
              <div
                className={`rounded-[var(--radius-sm)] px-4 py-3 text-sm font-medium ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-end gap-3">
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-[var(--color-ink-soft)] text-sm font-medium hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60"
            >
              {loading ? 'Salvando...' : editingId ? 'Atualizar pacote' : 'Adicionar pacote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
