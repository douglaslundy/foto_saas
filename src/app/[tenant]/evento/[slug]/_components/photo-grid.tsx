'use client'

import { useState, useCallback } from 'react'
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
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const [loading, setLoading] = useState(false)
  const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode)

  // Multi-select state (only used when isManager)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

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

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Excluir ${selected.size} foto(s)? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    const ids = Array.from(selected)
    try {
      await Promise.all(ids.map((id) => fetch(`/api/photos/${id}`, { method: 'DELETE' })))
      setPhotos((prev) => prev.filter((p) => !selected.has(p.id)))
      exitSelectMode()
    } catch {
      alert('Erro ao excluir fotos.')
    } finally {
      setDeleting(false)
    }
  }

  const addToCart = useCallback(async (photoId: string) => {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      })
      if (res.ok || res.status === 409) {
        setAddedToCart((prev) => new Set(prev).add(photoId))
      }
    } catch (err) {
      console.error('Failed to add to cart:', err)
    }
  }, [])

  const displayed = filteredIds != null
    ? photos.filter((p) => filteredIds.includes(p.id))
    : photos

  const hasMore = filteredIds == null && photos.length < total

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

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Manager: select mode controls */}
          {isManager && (
            selectMode ? (
              <>
                <button
                  onClick={() => setSelected(new Set(displayed.map((p) => p.id)))}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded border border-[var(--color-border,#e5e5e5)] text-xs font-medium hover:bg-[var(--color-surface-alt,#f5f4f0)] transition-colors disabled:opacity-50"
                >
                  Todas
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded border border-[var(--color-border,#e5e5e5)] text-xs font-medium hover:bg-[var(--color-surface-alt,#f5f4f0)] transition-colors disabled:opacity-50"
                >
                  Limpar
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selected.size === 0 || deleting}
                  className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  {deleting ? 'Excluindo…' : `Excluir (${selected.size})`}
                </button>
                <button
                  onClick={exitSelectMode}
                  disabled={deleting}
                  className="px-3 py-1.5 text-xs font-medium text-[var(--color-ink-muted,#6b6b6b)] hover:text-[var(--color-ink,#1a1a1a)] transition-colors"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                className="px-3 py-1.5 rounded border border-[var(--color-border,#e5e5e5)] text-xs font-medium hover:bg-[var(--color-surface-alt,#f5f4f0)] transition-colors"
              >
                Selecionar
              </button>
            )
          )}

          {/* Photo count (shown when not in select mode) */}
          {!selectMode && (
            <span className="text-xs text-[var(--color-ink-muted,#6b6b6b)]">
              {displayed.length === 0 && filteredIds != null
                ? 'Nenhuma foto encontrada'
                : `${displayed.length} ${displayed.length === 1 ? 'foto' : 'fotos'}`}
            </span>
          )}
          {selectMode && selected.size > 0 && (
            <span className="text-xs text-[var(--color-ink-muted,#6b6b6b)]">
              {selected.size} selecionada{selected.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 border border-[var(--color-border,#e5e5e5)] rounded-md p-0.5">
          <button
            onClick={() => changeViewMode('grid')}
            aria-label="Visualização em grade"
            title="Grade"
            className={`px-2.5 py-1.5 rounded text-sm transition-colors ${
              viewMode === 'grid'
                ? 'bg-[var(--color-ink,#1a1a1a)] text-white'
                : 'text-[var(--color-ink-muted,#6b6b6b)] hover:text-[var(--color-ink,#1a1a1a)]'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="6" height="6" rx="1"/>
              <rect x="9" y="1" width="6" height="6" rx="1"/>
              <rect x="1" y="9" width="6" height="6" rx="1"/>
              <rect x="9" y="9" width="6" height="6" rx="1"/>
            </svg>
          </button>
          <button
            onClick={() => changeViewMode('list')}
            aria-label="Visualização em lista"
            title="Lista"
            className={`px-2.5 py-1.5 rounded text-sm transition-colors ${
              viewMode === 'list'
                ? 'bg-[var(--color-ink,#1a1a1a)] text-white'
                : 'text-[var(--color-ink-muted,#6b6b6b)] hover:text-[var(--color-ink,#1a1a1a)]'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="2" width="14" height="2.5" rx="1"/>
              <rect x="1" y="6.75" width="14" height="2.5" rx="1"/>
              <rect x="1" y="11.5" width="14" height="2.5" rx="1"/>
            </svg>
          </button>
        </div>
      </div>

      {displayed.length === 0 && filteredIds != null && (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Nenhuma foto encontrada com os critérios da busca.
        </p>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {displayed.map((photo) => {
            const isSelected = selected.has(photo.id)
            return (
              <div
                key={photo.id}
                className={`group relative aspect-square bg-muted rounded overflow-hidden transition-all ${
                  selectMode ? 'cursor-pointer' : ''
                } ${isSelected ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                onClick={() => {
                  if (selectMode) { toggleSelect(photo.id); return }
                  if (photo.status === 'ready') setLightbox(photo)
                }}
              >
                {photo.status === 'ready' && photo.public_storage_path ? (
                  <>
                    <img
                      src={getPhotoUrl(photo.public_storage_path) ?? ''}
                      alt=""
                      className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                      draggable="false"
                      onContextMenu={(e) => e.preventDefault()}
                    />

                    {/* Select checkbox overlay */}
                    {selectMode && (
                      <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center z-10 ${
                        isSelected
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-white/80 border-gray-400'
                      }`}>
                        {isSelected && <span className="text-[10px] leading-none font-bold">✓</span>}
                      </div>
                    )}

                    {/* Cart button (hidden in select mode) */}
                    {!selectMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          addToCart(photo.id)
                        }}
                        className={`absolute bottom-2 right-2 flex items-center gap-1 text-xs px-2 py-1 rounded transition-opacity ${
                          addedToCart.has(photo.id)
                            ? 'bg-green-600 text-white opacity-100'
                            : 'bg-primary text-primary-foreground opacity-0 group-hover:opacity-100'
                        }`}
                        aria-label="Adicionar ao carrinho"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        {addedToCart.has(photo.id) ? '✓' : '+'}
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

      {/* List view */}
      {viewMode === 'list' && (
        <div className="flex flex-col gap-1.5">
          {displayed.map((photo, idx) => {
            const isSelected = selected.has(photo.id)
            return (
              <div
                key={photo.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  selectMode ? 'cursor-pointer' : photo.status === 'ready' ? 'cursor-pointer' : ''
                } ${
                  isSelected
                    ? 'border-red-400 bg-red-50'
                    : 'border-[var(--color-border,#e5e5e5)] bg-white/60 hover:bg-[var(--color-surface-alt,#f5f4f0)]'
                }`}
                onClick={() => {
                  if (selectMode) { toggleSelect(photo.id); return }
                  if (photo.status === 'ready') setLightbox(photo)
                }}
              >
                {/* Select checkbox (manager only) */}
                {selectMode && (
                  <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'bg-red-600 border-red-600 text-white' : 'border-gray-400 bg-white'
                  }`}>
                    {isSelected && <span className="text-[10px] leading-none font-bold">✓</span>}
                  </div>
                )}

                {/* Thumbnail */}
                <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-muted">
                  {photo.status === 'ready' && photo.public_storage_path ? (
                    <img
                      src={getPhotoUrl(photo.public_storage_path) ?? ''}
                      alt=""
                      className="w-full h-full object-cover"
                      draggable="false"
                      onContextMenu={(e) => e.preventDefault()}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground">…</span>
                    </div>
                  )}
                </div>

                {/* Label */}
                <span className="flex-1 text-sm text-[var(--color-ink,#1a1a1a)] font-medium select-none">
                  Foto {idx + 1}
                </span>

                {/* Cart button (hidden in select mode) */}
                {photo.status === 'ready' && !selectMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      addToCart(photo.id)
                    }}
                    className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors ${
                      addedToCart.has(photo.id)
                        ? 'bg-green-600 text-white'
                        : 'bg-primary text-primary-foreground hover:opacity-90'
                    }`}
                    aria-label="Adicionar ao carrinho"
                  >
                    <ShoppingCart className="h-3 w-3" />
                    {addedToCart.has(photo.id) ? 'Adicionada' : 'Adicionar'}
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

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={getPhotoUrl(lightbox.public_storage_path) ?? ''}
            alt=""
            className="max-w-full max-h-full object-contain"
            draggable="false"
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl leading-none"
            onClick={() => setLightbox(null)}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
