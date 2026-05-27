'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

type SearchState = 'idle' | 'consent' | 'uploading' | 'results' | 'error'

type FaceSearchIslandProps = {
  eventId: string
  bibEnabled?: boolean
  onResults: (photoIds: string[] | null) => void  // null = reset (show all)
}

export function FaceSearchIsland({ eventId, bibEnabled, onResults }: FaceSearchIslandProps) {
  const [state, setState] = useState<SearchState>('idle')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [resultCount, setResultCount] = useState(0)
  const [showBib, setShowBib] = useState(false)
  const [bibNumber, setBibNumber] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSelfie(file: File) {
    setState('uploading')
    const form = new FormData()
    form.append('selfie', file)
    try {
      const res = await fetch(`/api/events/${eventId}/search`, { method: 'POST', body: form })
      const data = await res.json() as { photo_ids?: string[]; count?: number; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Erro ao buscar fotos.')
        setState('error')
        return
      }
      setResultCount(data.count ?? data.photo_ids?.length ?? 0)
      onResults(data.photo_ids ?? [])
      setState('results')
    } catch {
      setError('Erro de rede. Tente novamente.')
      setState('error')
    }
  }

  async function handleBib() {
    if (!bibNumber.trim()) return
    setState('uploading')
    try {
      const res = await fetch(`/api/events/${eventId}/search-bib`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bib_number: bibNumber }),
      })
      const data = await res.json() as { photo_ids?: string[]; count?: number; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Erro ao buscar fotos.')
        setState('error')
        return
      }
      setResultCount(data.count ?? data.photo_ids?.length ?? 0)
      onResults(data.photo_ids ?? [])
      setState('results')
    } catch {
      setError('Erro de rede. Tente novamente.')
      setState('error')
    }
  }

  function reset() {
    setState('idle')
    setConsent(false)
    setError('')
    setBibNumber('')
    setShowBib(false)
    onResults(null)
  }

  if (state === 'idle') {
    return (
      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={() => setState('consent')}>
          🔍 Encontrar minhas fotos
        </Button>
        {bibEnabled && !showBib && (
          <Button variant="outline" onClick={() => setShowBib(true)}>
            Buscar por número de peito
          </Button>
        )}
        {showBib && (
          <div className="flex gap-2 items-center">
            <input
              type="number"
              placeholder="Nº de peito"
              value={bibNumber}
              onChange={(e) => setBibNumber(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm w-32"
              onKeyDown={(e) => e.key === 'Enter' && handleBib()}
            />
            <Button size="sm" onClick={handleBib} disabled={!bibNumber}>Buscar</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowBib(false)}>×</Button>
          </div>
        )}
      </div>
    )
  }

  if (state === 'consent') {
    return (
      <div className="border rounded-xl p-4 space-y-3 max-w-md bg-card">
        <p className="text-sm font-medium">Encontrar minhas fotos com selfie</p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            Concordo que minha selfie seja utilizada exclusivamente para localizar fotos neste evento
            e que ela <strong>não será armazenada</strong> (LGPD — Lei 13.709/2018).
          </span>
        </label>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!consent}
            onClick={() => fileInputRef.current?.click()}
          >
            Confirmar e enviar selfie
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>Cancelar</Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleSelfie(file)
          }}
        />
      </div>
    )
  }

  if (state === 'uploading') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Buscando suas fotos...</span>
      </div>
    )
  }

  if (state === 'results') {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-medium text-green-600 dark:text-green-400">
          {resultCount === 0
            ? 'Nenhuma foto encontrada'
            : `${resultCount} foto${resultCount !== 1 ? 's' : ''} encontrada${resultCount !== 1 ? 's' : ''}`}
        </p>
        <Button variant="ghost" size="sm" onClick={reset}>
          Ver todas as fotos
        </Button>
      </div>
    )
  }

  // error state
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <p className="text-sm text-destructive">{error}</p>
      <Button variant="ghost" size="sm" onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
