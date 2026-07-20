'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type Status = {
  configured: boolean
  exists?: boolean
  connected?: boolean
  status?: string
  number?: string | null
  profileName?: string | null
  error?: string
}

const POLL_WHILE_CONNECTING_MS = 3000

export function WhatsAppConnectionCard() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [generatingQr, setGeneratingQr] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/whatsapp/status')
      const data = await res.json() as Status
      setStatus(data)
      if (data.connected) {
        setQrCode(null)
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      }
      return data
    } catch {
      setStatus({ configured: false, error: 'Erro de conexão.' })
      return null
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStatus])

  async function handleGenerateQr() {
    setGeneratingQr(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/whatsapp/qrcode', { method: 'POST' })
      const data = await res.json() as { qrcode?: string; error?: string }
      if (!res.ok || !data.qrcode) {
        setError(data.error ?? 'Erro ao gerar QR Code.')
        return
      }
      setQrCode(data.qrcode)
      // Enquanto o QR estiver na tela, checa periodicamente se ja foi escaneado
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(fetchStatus, POLL_WHILE_CONNECTING_MS)
    } catch {
      setError('Erro de conexão ao gerar QR Code.')
    } finally {
      setGeneratingQr(false)
    }
  }

  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">WhatsApp (Evolution API)</h2>
        <p className="text-[var(--color-ink-muted)] text-sm mt-0.5">
          Usado para enviar o link de seleção do ensaio por WhatsApp, além do e-mail.
        </p>
      </div>

      <div className="px-6 py-5 space-y-4">
        {loadingStatus && <p className="text-sm text-[var(--color-ink-muted)]">Verificando status…</p>}

        {!loadingStatus && status && !status.configured && (
          <p className="text-sm text-[var(--color-danger)]">
            Evolution API não configurada (falta EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE).
          </p>
        )}

        {!loadingStatus && status?.configured && status.connected && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-success,#16a34a)]/10 text-[var(--color-success,#16a34a)]">
              ● Conectado
            </span>
            <span className="text-sm text-[var(--color-ink)]">
              {status.profileName ?? 'WhatsApp'} {status.number ? `(${status.number})` : ''}
            </span>
          </div>
        )}

        {!loadingStatus && status?.configured && !status.connected && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                ● Não conectado
              </span>
              {status.status && <span className="text-xs text-[var(--color-ink-muted)]">status: {status.status}</span>}
            </div>

            {qrCode ? (
              <div className="space-y-2">
                <p className="text-sm text-[var(--color-ink)]">
                  Escaneie com o WhatsApp do estúdio: Aparelhos conectados → Conectar um aparelho.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="QR Code WhatsApp" className="w-56 h-56 border border-[var(--color-border-strong)] rounded-[var(--radius-sm)]" />
                <p className="text-xs text-[var(--color-ink-muted)]">
                  O código expira rápido — clique em &quot;Gerar novo QR Code&quot; se não conseguir escanear a tempo. Esta tela atualiza sozinha quando conectar.
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-ink-muted)]">
                Clique abaixo para gerar um QR Code e conectar o WhatsApp do estúdio.
              </p>
            )}

            <button
              type="button"
              onClick={handleGenerateQr}
              disabled={generatingQr}
              className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-blue)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generatingQr ? 'Gerando...' : qrCode ? 'Gerar novo QR Code' : 'Gerar QR Code'}
            </button>

            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
