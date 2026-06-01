'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'

export type Photo = {
  id: string
  public_storage_path: string | null
  status: string
}

const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

function getPhotoUrl(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${STORAGE_URL}/${path}`
}

type ViewMode = 'grid' | 'list'

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'grid'
  try {
    return localStorage.getItem('fotosaas_view_mode') === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

type PhotoGridProps = {
  initialPhotos: Photo[]
  eventId: string
  total: number
  filteredIds?: string[] | null
  isManager?: boolean
}

export function PhotoGrid({ initialPhotos, eventId, total, filteredIds, isManager = false }: PhotoGridProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode)
  const [cartWorking, setCartWorking] = useState<Set<string>>(new Set())

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode)
    try { localStorage.setItem('fotosaas_view_mode', mode) } catch {}
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  const displayed = filteredIds != null
    ? photos.filter((p) => filteredIds.includes(p.id))
    : photos

  const hasMore = filteredIds == null && photos.length < total

  // ── Lightbox navigation ──────────────────────────────────────
  const lightboxPhoto = lightboxIndex !== null ? displayed[lightboxIndex] ?? null : null

  function openLightbox(idx: number) {
    if (selectMode) { toggleSelect(displayed[idx].id); return }
    if (displayed[idx]?.status === 'ready') setLightboxIndex(idx)
  }

  function closeLightbox() { setLightboxIndex(null) }

  function prevPhoto() {
    setLightboxIndex((i) => (i !== null ? (i > 0 ? i - 1 : displayed.length - 1) : null))
  }

  function nextPhoto() {
    setLightboxIndex((i) => (i !== null ? (i < displayed.length - 1 ? i + 1 : 0) : null))
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
  }, [lightboxIndex, displayed.length])

  // ── Cart ─────────────────────────────────────────────────────
  const addToCart = useCallback(async (photoId: string) => {
    setCartWorking((prev) => new Set(prev).add(photoId))
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      })
      if (res.ok || res.status === 409) {
        setAddedToCart((prev) => new Set(prev).add(photoId))
        if (res.ok) window.dispatchEvent(new CustomEvent('fotosaas:cart-add'))
      }
    } catch (err) {
      console.error('Failed to add to cart:', err)
    } finally {
      setCartWorking((prev) => { const s = new Set(prev); s.delete(photoId); return s })
    }
  }, [])

  async function handleBulkAddToCart() {
    if (selected.size === 0) return
    setBulkWorking(true)
    const ids = Array.from(selected)
    let added = 0
    try {
      await Promise.all(ids.map(async (id) => {
        const res = await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoId: id }),
        })
        if (res.ok || res.status === 409) {
          setAddedToCart((prev) => new Set(prev).add(id))
          if (res.ok) added++
        }
      }))
      for (let i = 0; i < added; i++) window.dispatchEvent(new CustomEvent('fotosaas:cart-add'))
      exitSelectMode()
    } catch {
      alert('Erro ao adicionar fotos ao carrinho.')
    } finally {
      setBulkWorking(false)
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Excluir ${selected.size} foto(s)? Esta ação não pode ser desfeita.`)) return
    setBulkWorking(true)
    const ids = Array.from(selected)
    try {
      await Promise.all(ids.map((id) => fetch(`/api/photos/${id}`, { method: 'DELETE' })))
      setPhotos((prev) => prev.filter((p) => !selected.has(p.id)))
      exitSelectMode()
    } catch {
      alert('Erro ao excluir fotos.')
    } finally {
      setBulkWorking(false)
    }
  }

  async function loadMore() {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/photos?offset=${photos.length}&limit=48`)
      const data = await res.json() as { photos: Photo[] }
      setPhotos((prev) => [...prev, ...data.photos])
    } finally {
      setLoading(false)
    }
  }

  const selectedRing = isManager ? 'ring-2 ring-red-500 ring-offset-1' : 'ring-2 ring-[var(--color-gold,#c8a96e)] ring-offset-1'
  const checkboxSelected = isManager ? 'bg-red-600 border-red-600' : 'bg-[var(--color-gold,#c8a96e)] border-[var(--color-gold,#c8a96e)]'
  const selectedRowBg = isManager ? 'border-red-400 bg-red-50' : 'border-[var(--color-gold,#c8a96e)] bg-amber-50'

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {selectMode ? (
            <>
              {isManager && (
                <>
                  <button onClick={() => setSelected(new Set(displayed.filter(p => p.status === 'ready').map(p => p.id)))} disabled={bulkWorking} className="px-3 py-1.5 rounded border border-[var(--color-border,#e5e5e5)] text-xs font-medium hover:bg-[var(--color-surface-alt,#f5f4f0)] transition-colors disabled:opacity-50">Todas</button>
                  <button onClick={() => setSelected(new Set())} disabled={bulkWorking} className="px-3 py-1.5 rounded border border-[var(--color-border,#e5e5e5)] text-xs font-medium hover:bg-[var(--color-surface-alt,#f5f4f0)] transition-colors disabled:opacity-50">Limpar</button>
                </>
              )}
              {selected.size > 0 && <span className="text-xs text-[var(--color-ink-muted,#6b6b6b)]">{selected.size} selecionada{selected.size !== 1 ? 's' : ''}</span>}
              {!isManager && (
                <button onClick={handleBulkAddToCart} disabled={selected.size === 0 || bulkWorking} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-colors">
                  <ShoppingCart className="h-3 w-3" />
                  {bulkWorking ? 'Adicionando…' : `Adicionar (${selected.size})`}
                </button>
              )}
              {isManager && (
                <button onClick={handleBulkDelete} disabled={selected.size === 0 || bulkWorking} className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-40 transition-colors">
                  {bulkWorking ? 'Excluindo…' : `Excluir (${selected.size})`}
                </button>
              )}
              <button onClick={exitSelectMode} disabled={bulkWorking} className="px-3 py-1.5 text-xs font-medium text-[var(--color-ink-muted,#6b6b6b)] hover:text-[var(--color-ink,#1a1a1a)] transition-colors">Cancelar</button>
            </>
          ) : (
            <>
              <button onClick={() => setSelectMode(true)} className="px-3 py-1.5 rounded border border-[var(--color-border,#e5e5e5)] text-xs font-medium hover:bg-[var(--color-surface-alt,#f5f4f0)] transition-colors">Selecionar</button>
              <span className="text-xs text-[var(--color-ink-muted,#6b6b6b)]">
                {displayed.length === 0 && filteredIds != null ? 'Nenhuma foto encontrada' : `${displayed.length} ${displayed.length === 1 ? 'foto' : 'fotos'}`}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-0.5 border border-[var(--color-border,#e5e5e5)] rounded-md p-0.5">
          <button onClick={() => changeViewMode('grid')} aria-label="Grade" title="Grade" className={`px-2.5 py-1.5 rounded text-sm transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-ink,#1a1a1a)] text-white' : 'text-[var(--color-ink-muted,#6b6b6b)] hover:text-[var(--color-ink,#1a1a1a)]'}`}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
          </button>
          <button onClick={() => changeViewMode('list')} aria-label="Lista" title="Lista" className={`px-2.5 py-1.5 rounded text-sm transition-colors ${viewMode === 'list' ? 'bg-[var(--color-ink,#1a1a1a)] text-white' : 'text-[var(--color-ink-muted,#6b6b6b)] hover:text-[var(--color-ink,#1a1a1a)]'}`}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2.5" rx="1"/><rect x="1" y="6.75" width="14" height="2.5" rx="1"/><rect x="1" y="11.5" width="14" height="2.5" rx="1"/></svg>
          </button>
        </div>
      </div>

      {displayed.length === 0 && filteredIds != null && (
        <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma foto encontrada com os critérios da busca.</p>
      )}

      {/* ── Grid view ──────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {displayed.map((photo, idx) => {
            const isSelected = selected.has(photo.id)
            return (
              <div
                key={photo.id}
                className={`group relative aspect-square bg-muted rounded overflow-hidden transition-all ${selectMode && photo.status === 'ready' ? 'cursor-pointer' : photo.status === 'ready' ? 'cursor-pointer' : ''} ${isSelected ? selectedRing : ''}`}
                onClick={() => openLightbox(idx)}
              >
                {photo.status === 'ready' && photo.public_storage_path ? (
                  <>
                    <img src={getPhotoUrl(photo.public_storage_path) ?? ''} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" draggable="false" onContextMenu={(e) => e.preventDefault()} />
                    {selectMode && (
                      <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center z-10 pointer-events-none ${isSelected ? `${checkboxSelected} text-white` : 'bg-white/80 border-gray-400'}`}>
                        {isSelected && <span className="text-[10px] leading-none font-bold">✓</span>}
                      </div>
                    )}
                    {!selectMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); addToCart(photo.id) }}
                        disabled={cartWorking.has(photo.id)}
                        className={`absolute bottom-2 right-2 flex items-center gap-1 text-xs px-2 py-1 rounded transition-all disabled:opacity-60 ${addedToCart.has(photo.id) ? 'bg-green-600 text-white opacity-100' : 'bg-primary text-primary-foreground opacity-0 group-hover:opacity-100'}`}
                        aria-label="Adicionar ao carrinho"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        {cartWorking.has(photo.id) ? '…' : addedToCart.has(photo.id) ? '✓' : '+'}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Processando…</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── List view ──────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="flex flex-col gap-1.5">
          {displayed.map((photo, idx) => {
            const isSelected = selected.has(photo.id)
            return (
              <div
                key={photo.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${selectMode && photo.status === 'ready' ? 'cursor-pointer' : photo.status === 'ready' ? 'cursor-pointer' : ''} ${isSelected ? selectedRowBg : 'border-[var(--color-border,#e5e5e5)] bg-white/60 hover:bg-[var(--color-surface-alt,#f5f4f0)]'}`}
                onClick={() => openLightbox(idx)}
              >
                {selectMode && (
                  <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center pointer-events-none ${isSelected ? `${checkboxSelected} text-white` : 'border-gray-400 bg-white'}`}>
                    {isSelected && <span className="text-[10px] leading-none font-bold">✓</span>}
                  </div>
                )}
                <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-muted">
                  {photo.status === 'ready' && photo.public_storage_path ? (
                    <img src={getPhotoUrl(photo.public_storage_path) ?? ''} alt="" className="w-full h-full object-cover" draggable="false" onContextMenu={(e) => e.preventDefault()} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><span className="text-[10px] text-muted-foreground">…</span></div>
                  )}
                </div>
                <span className="flex-1 text-sm text-[var(--color-ink,#1a1a1a)] font-medium select-none">Foto {idx + 1}</span>
                {photo.status === 'ready' && !selectMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); addToCart(photo.id) }}
                    disabled={cartWorking.has(photo.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-60 ${addedToCart.has(photo.id) ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground hover:opacity-90'}`}
                    aria-label="Adicionar ao carrinho"
                  >
                    <ShoppingCart className="h-3 w-3" />
                    {cartWorking.has(photo.id) ? '…' : addedToCart.has(photo.id) ? 'Adicionada' : 'Adicionar'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-6">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}

      {/* ── Lightbox com slider ─────────────────────────────── */}
      {lightboxPhoto && lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={closeLightbox}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-white/60 text-sm tabular-nums">
              {lightboxIndex + 1} / {displayed.length}
            </span>
            <div className="flex items-center gap-3">
              {/* Cart button */}
              <button
                onClick={() => addToCart(lightboxPhoto.id)}
                disabled={cartWorking.has(lightboxPhoto.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-60 ${addedToCart.has(lightboxPhoto.id) ? 'bg-green-600 text-white' : 'bg-[var(--color-gold,#c8a96e)] text-[var(--color-ink,#0d0f14)] hover:opacity-90'}`}
              >
                <ShoppingCart className="h-4 w-4" />
                {cartWorking.has(lightboxPhoto.id) ? 'Adicionando…' : addedToCart.has(lightboxPhoto.id) ? 'Adicionada ✓' : 'Adicionar ao carrinho'}
              </button>
              {/* Close */}
              <button onClick={closeLightbox} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition-colors" aria-label="Fechar">×</button>
            </div>
          </div>

          {/* Image area */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 px-16" onClick={(e) => e.stopPropagation()}>
            {/* Prev arrow */}
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

            {/* Next arrow */}
            <button
              onClick={nextPhoto}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white text-xl transition-colors z-10"
              aria-label="Próxima foto"
            >
              ›
            </button>
          </div>

          {/* Bottom: dot navigation (max 12 dots) */}
          {displayed.length > 1 && displayed.length <= 20 && (
            <div className="flex items-center justify-center gap-1.5 py-4 shrink-0" onClick={(e) => e.stopPropagation()}>
              {displayed.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className={`rounded-full transition-all ${i === lightboxIndex ? 'w-4 h-2 bg-[var(--color-gold,#c8a96e)]' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`}
                  aria-label={`Foto ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
