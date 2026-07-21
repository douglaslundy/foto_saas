'use client'

import { useState, useEffect } from 'react'
import { StripeCardForm } from '@/components/checkout/stripe-card-form'

type Photo = {
  id: string
  public_storage_path: string | null
  status: string
}

type Props = {
  reviewId: string
  photos: Photo[]
  sessionPriceCents: number
  includedPhotoCount: number
  extraPhotoPriceCents: number
  tenantSlug: string
}

const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

function getPhotoUrl(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${STORAGE_URL}/${path}`
}

// included=0 significa "sem limite": todas as fotos selecionadas ficam
// dentro do valor fixo do ensaio, sem cobrança extra.
function calcTotal(count: number, sessionPriceCents: number, includedPhotoCount: number, extraPhotoPriceCents: number) {
  const extraCount = includedPhotoCount === 0 ? 0 : Math.max(0, count - includedPhotoCount)
  const extraCost = extraCount * extraPhotoPriceCents
  const total = sessionPriceCents + extraCost
  return { extraCount, extraCost, total }
}

type Step = 'select' | 'confirm' | 'payment' | 'done'

export function ReviewClient({ reviewId, photos, sessionPriceCents, includedPhotoCount, extraPhotoPriceCents, tenantSlug }: Props) {
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

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  function togglePhoto(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openLightbox(idx: number) {
    if (photos[idx]?.public_storage_path) setLightboxIndex(idx)
  }
  function closeLightbox() { setLightboxIndex(null) }
  function prevPhoto() {
    setLightboxIndex((i) => (i !== null ? (i > 0 ? i - 1 : photos.length - 1) : null))
  }
  function nextPhoto() {
    setLightboxIndex((i) => (i !== null ? (i < photos.length - 1 ? i + 1 : 0) : null))
  }

  useEffect(() => {
    if (lightboxIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prevPhoto()
      else if (e.key === 'ArrowRight') nextPhoto()
      else if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, photos.length])

  const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] ?? null : null

  const { extraCount, extraCost, total } = calcTotal(selected.size, sessionPriceCents, includedPhotoCount, extraPhotoPriceCents)
  const isFree = total === 0

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
          <p className="text-sm text-gray-500">
            {includedPhotoCount > 0
              ? `Escolha até ${includedPhotoCount} foto${includedPhotoCount !== 1 ? 's' : ''} sem custo extra. Fotos além disso custam R$ ${(extraPhotoPriceCents / 100).toFixed(2).replace('.', ',')} cada.`
              : 'Você pode selecionar quantas fotos quiser, sem custo extra.'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
          {photos.map((photo, idx) => {
            const isSelected = selected.has(photo.id)
            return (
              <div
                key={photo.id}
                className={`group relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'
                }`}
                onClick={() => openLightbox(idx)}
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
                <button
                  onClick={(e) => { e.stopPropagation(); togglePhoto(photo.id) }}
                  className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-opacity ${
                    isSelected ? 'opacity-100 bg-blue-500' : 'opacity-0 group-hover:opacity-100 bg-white/80'
                  }`}
                  aria-label="Selecionar foto"
                >
                  {isSelected
                    ? <span className="text-white text-xs font-bold">✓</span>
                    : <span className="text-gray-500 text-xs font-bold">○</span>}
                </button>
              </div>
            )
          })}
        </div>

        {/* ── Lightbox ─────────────────────────────────────── */}
        {lightboxPhoto && lightboxIndex !== null && (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={closeLightbox}>
            <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
              <span className="text-white/60 text-sm tabular-nums">
                {lightboxIndex + 1} / {photos.length}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => togglePhoto(lightboxPhoto.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selected.has(lightboxPhoto.id) ? 'bg-green-600 text-white' : 'bg-blue-500 text-white hover:opacity-90'
                  }`}
                >
                  {selected.has(lightboxPhoto.id) ? 'Selecionada ✓' : 'Selecionar esta foto'}
                </button>
                <button onClick={closeLightbox} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition-colors" aria-label="Fechar">×</button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative min-h-0 px-16" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={prevPhoto}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white text-xl transition-colors z-10"
                aria-label="Foto anterior"
              >
                ‹
              </button>

              <img
                src={getPhotoUrl(lightboxPhoto.public_storage_path) ?? ''}
                alt=""
                className="max-w-full max-h-full object-contain select-none"
                draggable="false"
                onContextMenu={(e) => e.preventDefault()}
              />

              <button
                onClick={nextPhoto}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white text-xl transition-colors z-10"
                aria-label="Próxima foto"
              >
                ›
              </button>
            </div>

            {photos.length > 1 && photos.length <= 20 && (
              <div className="flex items-center justify-center gap-1.5 py-4 shrink-0 flex-wrap px-4" onClick={(e) => e.stopPropagation()}>
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxIndex(i)}
                    className={`rounded-full transition-all ${i === lightboxIndex ? 'w-4 h-2 bg-blue-500' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`}
                    aria-label={`Foto ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

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
              {!isFree && selected.size > 0 && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {extraCount > 0 && (
                    <span className="text-amber-600 mr-2">{extraCount} extra{extraCount !== 1 ? 's' : ''}</span>
                  )}
                  Total: R$ {(total / 100).toFixed(2).replace('.', ',')}
                </div>
              )}
              {isFree && selected.size > 0 && (
                <div className="text-xs text-green-600 mt-0.5">Ensaio gratuito</div>
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
          {!isFree && (
            <>
              {sessionPriceCents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Valor do ensaio</span>
                  <span>R$ {(sessionPriceCents / 100).toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              {extraCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{extraCount} foto{extraCount !== 1 ? 's' : ''} extra{extraCount !== 1 ? 's' : ''}</span>
                  <span>R$ {(extraCost / 100).toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t border-gray-100 pt-2">
                <span>Total</span>
                <span>R$ {(total / 100).toFixed(2).replace('.', ',')}</span>
              </div>
            </>
          )}
          {isFree && (
            <p className="text-sm font-medium text-green-600">Ensaio gratuito — sem cobrança.</p>
          )}
          {notes && (
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-500">Observações: {notes}</p>
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {!isFree ? (
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

  // ── Payment screen ───────────────────────────────────────────
  if (step === 'payment' && paymentData) {
    // Stripe card payment
    if (paymentData.payment_method === 'stripe' && paymentData.stripe_client_secret) {
      return (
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Pagamento com cartão</h1>
          <p className="text-sm text-gray-500 mb-6">
            Total: <strong>R$ {((paymentData.total_cents ?? 0) / 100).toFixed(2).replace('.', ',')}</strong>
          </p>
          <StripeCardForm
            clientSecret={paymentData.stripe_client_secret}
            orderId={reviewId}
            returnUrl={typeof window !== 'undefined' ? window.location.href : undefined}
            onSuccess={() => setStep('done')}
          />
        </div>
      )
    }

    // PIX payment
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
