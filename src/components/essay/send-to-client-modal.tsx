'use client'

import { useState, useCallback, useRef } from 'react'

type ClientResult = {
  id: string
  name: string
  email: string
  cpf: string | null
}

type Props = {
  eventId: string
  onClose: () => void
  onSent: () => void
}

export function SendToClientModal({ eventId, onClose, onSent }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClientResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newCpf, setNewCpf] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    setSelectedClient(null)
    setShowNewForm(false)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (q.trim().length < 2) { setResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.clients ?? [])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      const body = selectedClient
        ? { event_id: eventId, client_id: selectedClient.id }
        : {
            event_id: eventId,
            client: { name: newName.trim(), email: newEmail.trim(), cpf: newCpf.trim() },
          }

      const res = await fetch('/api/essay-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao enviar.')
        return
      }
      onSent()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  const canSend = selectedClient || (showNewForm && newName.trim() && newEmail.trim() && newCpf.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Enviar para cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Buscar cliente</label>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Nome ou email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {searching && <p className="text-xs text-gray-500 mb-2">Buscando…</p>}
        {!searching && results.length > 0 && !selectedClient && (
          <div className="border border-gray-200 rounded-lg mb-3 divide-y divide-gray-100 max-h-40 overflow-y-auto">
            {results.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedClient(c); setResults([]); setShowNewForm(false) }}
                className="w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-500">{c.email}</div>
              </button>
            ))}
          </div>
        )}
        {!searching && query.trim().length >= 2 && results.length === 0 && !selectedClient && !showNewForm && (
          <div className="mb-3">
            <p className="text-sm text-gray-500 mb-2">Nenhum cliente encontrado.</p>
            <button
              onClick={() => { setShowNewForm(true); setNewEmail(query.includes('@') ? query : '') }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Cadastrar novo cliente
            </button>
          </div>
        )}

        {selectedClient && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
            <div>
              <div className="text-sm font-medium text-gray-900">{selectedClient.name}</div>
              <div className="text-xs text-gray-500">{selectedClient.email}</div>
            </div>
            <button onClick={() => { setSelectedClient(null); setQuery('') }} className="text-xs text-gray-500 hover:text-gray-700 ml-2">
              Trocar
            </button>
          </div>
        )}

        {showNewForm && (
          <div className="space-y-2 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-600 mb-2">Novo cliente</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome completo"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={newCpf}
              onChange={(e) => setNewCpf(e.target.value)}
              placeholder="CPF (000.000.000-00)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend || sending}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {sending ? 'Enviando…' : 'Enviar link'}
          </button>
        </div>
      </div>
    </div>
  )
}
