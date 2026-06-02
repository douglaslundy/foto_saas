'use client'

import { useState } from 'react'

type Photo = {
  id: string
  status: string
  thumbnail_path: string | null
  public_storage_path: string | null
  created_at: string
}

interface PhotoGridProps {
  photos: Photo[]
  storageBase: string
  onDelete: (photoId: string) => void
  onBulkDelete: (photoIds: string[]) => void
  onReprocess: (photoId: string) => void
  onSetCover?: (path: string) => Promise<void>
}

type ViewMode = 'grid' | 'list'

const statusLabel: Record<string, string> = {
  ready: 'Pronta', processing: 'Processando…', error: 'Erro', pending: 'Aguardando',
}

function thumbUrl(photo: Photo, storageBase: string) {
  const path = photo.thumbnail_path ?? photo.public_storage_path
  return path ? `${storageBase}/${path}` : null
}

function photoName(photo: Photo) {
  const path = photo.thumbnail_path ?? photo.public_storage_path ?? ''
  const parts = path.split('/')
  return parts[parts.length - 1] || photo.id.slice(0, 8)
}

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'grid'
  try { return localStorage.getItem('fotosaas_view_mode') === 'list' ? 'list' : 'grid' } catch { return 'grid' }
}

export function PhotoGrid({ photos, storageBase, onDelete, onBulkDelete, onReprocess, onSetCover }: PhotoGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [reprocessing, setReprocessing] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [settingCover, setSettingCover] = useState<string | null>(null)

  async function handleSetCover(photoId: string, path: string) {
    if (!onSetCover) return
    setSettingCover(photoId)
    try {
      await onSetCover(path)
    } finally {
      setSettingCover(null)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function exitSelectMode() { setSelectMode(false); setSelected(new Set()) }

  async function handleDelete(photoId: string) {
    if (!confirm('Deletar esta foto? Esta ação não pode ser desfeita.')) return
    setDeleting((prev) => new Set(prev).add(photoId))
    try {
      const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' })
      if (res.ok) onDelete(photoId)
      else alert('Erro ao deletar foto.')
    } finally {
      setDeleting((prev) => { const s = new Set(prev); s.delete(photoId); return s })
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Deletar ${selected.size} foto(s)? Esta ação não pode ser desfeita.`)) return
    setBulkDeleting(true)
    const ids = Array.from(selected)
    try {
      await Promise.all(ids.map((id) => fetch(`/api/photos/${id}`, { method: 'DELETE' })))
      onBulkDelete(ids)
      exitSelectMode()
    } catch { alert('Erro ao deletar fotos.') }
    finally { setBulkDeleting(false) }
  }

  async function handleReprocess(photoId: string) {
    setReprocessing((prev) => new Set(prev).add(photoId))
    try {
      const res = await fetch(`/api/photos/${photoId}/reprocess`, { method: 'POST' })
      if (res.ok) onReprocess(photoId)
      else alert('Erro ao reprocessar foto.')
    } finally {
      setReprocessing((prev) => { const s = new Set(prev); s.delete(photoId); return s })
    }
  }

  if (photos.length === 0) {
    return (
      <div className="py-16 text-center">
        <svg className="mx-auto mb-4 text-[var(--color-ink-muted)]" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
        <p className="font-display text-lg font-semibold text-[var(--color-ink)]">Nenhuma foto enviada ainda.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <button onClick={() => setSelected(new Set(photos.map((p) => p.id)))} disabled={bulkDeleting} className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-xs font-medium hover:bg-[var(--color-surface-alt)] transition-colors disabled:opacity-50">Selecionar todas</button>
              <button onClick={() => setSelected(new Set())} disabled={bulkDeleting} className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-xs font-medium hover:bg-[var(--color-surface-alt)] transition-colors disabled:opacity-50">Limpar</button>
              <button onClick={handleBulkDelete} disabled={selected.size === 0 || bulkDeleting} className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-danger)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40">{bulkDeleting ? 'Deletando…' : `Deletar (${selected.size})`}</button>
              <button onClick={exitSelectMode} disabled={bulkDeleting} className="px-3 py-1.5 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">Cancelar</button>
            </>
          ) : (
            <button onClick={() => setSelectMode(true)} className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-xs font-medium hover:bg-[var(--color-surface-alt)] transition-colors">Selecionar</button>
          )}
        </div>
        <div className="flex items-center gap-0.5 border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] p-0.5">
          <button
            onClick={() => { setViewMode('grid'); try { localStorage.setItem('fotosaas_view_mode', 'grid') } catch {} }}
            className={`px-2.5 py-1 rounded text-sm transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-cta)] text-[var(--color-cta-fg)]' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'}`}
            title="Grade"
          >⊞</button>
          <button
            onClick={() => { setViewMode('list'); try { localStorage.setItem('fotosaas_view_mode', 'list') } catch {} }}
            className={`px-2.5 py-1 rounded text-sm transition-colors ${viewMode === 'list' ? 'bg-[var(--color-cta)] text-[var(--color-cta-fg)]' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'}`}
            title="Lista"
          >☰</button>
        </div>
      </div>

      {/* Grade */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {photos.map((photo) => {
            const isDeleting = deleting.has(photo.id)
            const isSelected = selected.has(photo.id)
            const imgSrc = thumbUrl(photo, storageBase)
            return (
              <div key={photo.id} onClick={selectMode ? () => toggleSelect(photo.id) : undefined}
                className={`relative group aspect-square rounded-[var(--radius-sm)] overflow-hidden border bg-[var(--color-surface-alt)] transition-all ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'border-[var(--color-gold)] ring-2 ring-[var(--color-gold)] ring-offset-1' : 'border-[var(--color-border)]'}`}>
                {imgSrc
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><span className="text-xs text-[var(--color-ink-muted)] text-center px-2">{photo.status}</span></div>
                }
                {selectMode && (
                  <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-[var(--color-gold)] border-[var(--color-gold)] text-white' : 'bg-[var(--color-card)]/80 border-[var(--color-border-strong)]'}`}>
                    {isSelected && <span className="text-[10px] leading-none font-bold">✓</span>}
                  </div>
                )}
                {!selectMode && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    {onSetCover && photo.status === 'ready' && photo.public_storage_path && (
                      <button onClick={(e) => { e.stopPropagation(); handleSetCover(photo.id, photo.public_storage_path!) }} disabled={settingCover === photo.id}
                        className="px-2 py-1 rounded bg-[#2563eb] text-white text-[10px] font-bold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50" title="Definir como capa do evento">
                        {settingCover === photo.id ? '…' : 'Capa'}
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(photo.id) }} disabled={isDeleting}
                      className="w-9 h-9 rounded-full bg-[var(--color-card)]/90 text-[var(--color-ink)] flex items-center justify-center hover:bg-[var(--color-danger)] hover:text-white transition-colors disabled:opacity-50" title="Excluir">
                      {isDeleting ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>}
                    </button>
                    {photo.status === 'error' && (
                      <button onClick={(e) => { e.stopPropagation(); handleReprocess(photo.id) }} disabled={reprocessing.has(photo.id)}
                        className="w-9 h-9 rounded-full bg-[var(--color-card)]/90 text-[var(--color-ink)] flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors disabled:opacity-50" title="Reprocessar">
                        <span className="text-sm">↻</span>
                      </button>
                    )}
                  </div>
                )}
                {photo.status === 'processing' && <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none"><div className="w-6 h-6 rounded-full border-2 border-[var(--color-gold)] border-t-transparent animate-spin" /></div>}
                {photo.status === 'pending' && !imgSrc && <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none"><div className="w-6 h-6 rounded-full border-2 border-white/60 border-t-transparent animate-spin" /></div>}
                {photo.status === 'error' && <div className="absolute inset-0 bg-[var(--color-danger)]/30 flex items-center justify-center pointer-events-none"><span className="text-white text-lg">⚠</span></div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Lista */}
      {viewMode === 'list' && (
        <div className="border border-[var(--color-border-strong)] rounded-[var(--radius)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border-strong)] bg-[var(--color-surface-alt)]">
              <tr>
                {selectMode && <th className="w-10 px-3 py-2" />}
                <th className="px-3 py-2 w-12" />
                <th className="px-3 py-2 text-left font-medium text-[var(--color-ink-muted)]">Arquivo</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--color-ink-muted)]">Status</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--color-ink-muted)]">Data</th>
                <th className="px-3 py-2 text-right font-medium text-[var(--color-ink-muted)]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {photos.map((photo) => {
                const isSelected = selected.has(photo.id)
                const isDeleting = deleting.has(photo.id)
                const isReprocessing = reprocessing.has(photo.id)
                const imgSrc = thumbUrl(photo, storageBase)
                return (
                  <tr key={photo.id} onClick={selectMode ? () => toggleSelect(photo.id) : undefined}
                    className={`hover:bg-[var(--color-surface-alt)] transition-colors ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-[var(--color-gold-light)]' : ''}`}>
                    {selectMode && (
                      <td className="px-3 py-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-[var(--color-gold)] border-[var(--color-gold)] text-white' : 'border-[var(--color-border-strong)]'}`}>
                          {isSelected && <span className="text-[10px] leading-none font-bold">✓</span>}
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {imgSrc
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={imgSrc} alt="" className="w-10 h-10 object-cover rounded-[var(--radius-sm)] border border-[var(--color-border)]" />
                        : <div className="w-10 h-10 bg-[var(--color-surface-alt)] rounded-[var(--radius-sm)] border border-[var(--color-border)] flex items-center justify-center"><span className="text-[10px] text-[var(--color-ink-muted)]">?</span></div>
                      }
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-ink-muted)] truncate max-w-[180px]">{photoName(photo)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${photo.status === 'ready' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : photo.status === 'error' ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' : 'bg-[var(--color-gold-light)] text-[var(--color-gold)]'}`}>
                        {statusLabel[photo.status] ?? photo.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-ink-muted)] text-xs whitespace-nowrap">
                      {new Date(photo.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!selectMode && (
                        <div className="flex items-center justify-end gap-3">
                          {photo.status === 'error' && <button onClick={(e) => { e.stopPropagation(); handleReprocess(photo.id) }} disabled={isReprocessing} className="text-xs text-blue-600 hover:underline disabled:opacity-50">{isReprocessing ? '…' : 'Reprocessar'}</button>}
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(photo.id) }} disabled={isDeleting} className="text-xs text-[var(--color-danger)] hover:underline disabled:opacity-50">{isDeleting ? '…' : 'Deletar'}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
