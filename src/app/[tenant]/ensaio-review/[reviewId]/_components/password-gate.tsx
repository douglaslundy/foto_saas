'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  reviewId: string
}

export function PasswordGate({ reviewId }: Props) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/essay-reviews/${reviewId}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Senha incorreta.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
          <span className="text-blue-600 text-2xl">🔒</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Ensaio protegido por senha</h1>
        <p className="text-gray-500 text-sm">
          Digite a senha que o fotógrafo enviou para ver e selecionar suas fotos.
        </p>
        <input
          type="text"
          inputMode="numeric"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha do ensaio"
          autoFocus
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {loading ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
