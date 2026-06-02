'use client'

import { useState } from 'react'

type Photo = {
  id: string
  public_storage_path: string | null
  status: string
}

type Package = {
  name: string
  min_quantity: number
  discount_percent: number
}

type Props = {
  reviewId: string
  photos: Photo[]
  pricePerPhotoCents: number
  packages: Package[]
  tenantSlug: string
}

const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

function getPhotoUrl(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${STORAGE_URL}/${path}`
}

function calcTotal(count: number, pricePerPhotoCents: number, packages: Package[]) {
  const subtotal = pricePerPhotoCents * count
  const matched = packages.find((p) => count >= p.min_quantity)
  const discount = matched ? Math.round(subtotal * matched.discount_percent / 100) : 0
  return { subtotal, discount, total: subtotal - discount, pkg: matched ?? null }
}

type Step = 'select' | 'confirm' | 'payment' | 'done'

export function ReviewClient({ reviewId, photos, pricePerPhotoCents, packages, tenantSlug }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<Step>('select')
  const [submitting, setSubmitting] = useState(false)
  const [paymentData, setPaymentData] = useState<{
    payment_method: string
    total_cents: number
    pix_qr_code?: string | null
    pix_qr_code_base64?: string | null
    stripe_client_secret?: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function togglePhoto(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const { subtotal, discount, total, pkg } = calcTotal(selected.size, pricePerPhotoCents, packages)

  async function handleSubmit(paymentMethod: 'stripe' | 'pix' | 'manual') {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/essay-reviews/${reviewId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_photo_ids: Array.from(selected),
          notes: notes.trim() || undefined,
          payment_method: paymentMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao enviar seleção.')
        return
      }
      if (paymentMethod === 'manual') {
        setStep('done')
        return
      }
      setPaymentData(data)
      setStep('payment')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Selection screen ─────────────────────────────────────────
  if (step === 'select') {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Selecione suas fotos</h1>
          <p className="text-sm text-gray-500">Clique nas fotos que deseja. Você pode selecionar quantas quiser.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
          {photos.map((photo) => {
            const isSelected = selected.has(photo.id)
            return (
              <div
                key={photo.id}
                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'
                }`}
                onClick={() => togglePhoto(photo.id)}
              >
                {photo.public_storage_path ? (
                  <img
                    src={getPhotoUrl(photo.public_storage_path) ?? ''}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable="false"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <span className="text-xs text-gray-400">Processando…</span>
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observações para o fotógrafo (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: prefiro as fotos com fundo branco, quero incluir as do parque…"
          />
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">
                {selected.size} foto{selected.size !== 1 ? 's' : ''} selecionada{selected.size !== 1 ? 's' : ''}
              </span>
              {pricePerPhotoCents > 0 && selected.size > 0 && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {pkg && (
                    <span className="text-green-600 mr-2">Pacote {pkg.name} ({pkg.discount_percent}% off)</span>
                  )}
                  Total: R$ {(total / 100).toFixed(2).replace('.', ',')}
                </div>
              )}
            </div>
            <button
              onClick={() => setStep('confirm')}
              disabled={selected.size === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Confirmar seleção
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Confirmation screen ──────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Confirmar envio</h1>

        <div className="border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Fotos selecionadas</span>
            <span className="font-medium">{selected.size}</span>
          </div>
          {pricePerPhotoCents > 0 && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>R$ {(subtotal / 100).toFixed(2).replace('.', ',')}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Desconto ({pkg?.name})</span>
                  <span>-R$ {(discount / 100).toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t border-gray-100 pt-2">
                <span>Total</span>
                <span>R$ {(total / 100).toFixed(2).replace('.', ',')}</span>
              </div>
            </>
          )}
          {notes && (
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-500">Observações: {notes}</p>
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {pricePerPhotoCents > 0 && total > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Forma de pagamento:</p>
            <button
              onClick={() => handleSubmit('pix')}
              disabled={submitting}
              className="w-full py-3 border-2 border-blue-600 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-50 disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Processando…' : 'Pagar com PIX'}
            </button>
            <button
              onClick={() => handleSubmit('stripe')}
              disabled={submitting}
              className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Processando…' : 'Pagar com cartão'}
            </button>
            <button
              onClick={() => handleSubmit('manual')}
              disabled={submitting}
              className="w-full py-3 text-gray-500 text-sm hover:text-gray-700 disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Enviando…' : 'Pagarei depois'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => handleSubmit('manual')}
            disabled={submitting}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Enviando…' : 'Enviar seleção'}
          </button>
        )}

        <button
          onClick={() => setStep('select')}
          disabled={submitting}
          className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar e revisar seleção
        </button>
      </div>
    )
  }

  // ── PIX payment screen ───────────────────────────────────────
  if (step === 'payment' && paymentData) {
    return (
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Pagamento PIX</h1>
        <p className="text-sm text-gray-500 mb-6">
          Total: <strong>R$ {((paymentData.total_cents ?? 0) / 100).toFixed(2).replace('.', ',')}</strong>
        </p>
        {paymentData.pix_qr_code_base64 && (
          <img
            src={`data:image/png;base64,${paymentData.pix_qr_code_base64}`}
            alt="QR Code PIX"
            className="mx-auto w-48 h-48 mb-4"
          />
        )}
        {paymentData.pix_qr_code && (
          <div className="bg-gray-50 rounded-lg p-3 mb-6 text-xs text-gray-700 break-all select-all">
            {paymentData.pix_qr_code}
          </div>
        )}
        <p className="text-xs text-gray-500 mb-6">
          Sua seleção já foi enviada ao fotógrafo. Após o pagamento ser confirmado, suas fotos serão tratadas.
        </p>
        <button
          onClick={() => setStep('done')}
          className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Concluir
        </button>
      </div>
    )
  }

  // ── Success screen ───────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-green-600 text-2xl">✓</span>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Seleção enviada!</h1>
      <p className="text-gray-500 text-sm">
        O fotógrafo recebeu sua seleção e entrará em contato em breve.
      </p>
    </div>
  )
}
