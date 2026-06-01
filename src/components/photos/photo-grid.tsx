'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

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
}

type ViewMode = 'grid' | 'list'

const statusLabel: Record<string, string> = {
  ready: 'Pronta',
  processing: 'Processando…',
  error: 'Erro',
  pending: 'Aguardando',
}

const statusClass: Record<string, string> = {
  ready: 'text-green-600 bg-green-50',
  processing: 'text-yellow-700 bg-yellow-50',
  error: 'text-red-600 bg-red-50',
  pending: 'text-gray-600 bg-gray-100',
}

function thumbUrl(photo: Photo, storageBase: string) {
  const path = photo.thumbnail_path ?? photo.public_storage_path
  if (!path) return null
  return `${storageBase}/${path}`
}

function photoName(photo: Photo) {
  const path = photo.thumbnail_path ?? photo.public_storage_path ?? ''
  const parts = path.split('/')
  return parts[parts.length - 1] || photo.id.slice(0, 8)
}

export function PhotoGrid({ photos, storageBase, onDelete, onBulkDelete, onReprocess }: PhotoGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [reprocessing, setReprocessing] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(photos.map((p) => p.id)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  async function handleDelete(photoId: string) {
    if (!confirm('Deletar esta foto? Esta ação não pode ser desfeita.')) return
    setDeleting((prev) => new Set(prev).add(photoId))
    try {
      const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' })
      if (res.ok) {
        onDelete(photoId)
      } else {
        alert('Erro ao deletar foto.')
      }
    } finally {
      setDeleting((prev) => {
        const s = new Set(prev)
        s.delete(photoId)
        return s
      })
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
    } catch {
      alert('Erro ao deletar fotos.')
    } finally {
      setBulkDeleting(false)
    }
  }

  async function handleReprocess(photoId: string) {
    setReprocessing((prev) => new Set(prev).add(photoId))
    try {
      const res = await fetch(`/api/photos/${photoId}/reprocess`, { method: 'POST' })
      if (res.ok) {
        onReprocess(photoId)
      } else {
        alert('Erro ao reprocessar foto.')
      }
    } finally {
      setReprocessing((prev) => {
        const s = new Set(prev)
        s.delete(photoId)
        return s
      })
    }
  }

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
        Nenhuma foto enviada ainda.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <Button variant="outline" size="sm" onClick={selectAll} disabled={bulkDeleting}>
                Selecionar todas
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection} disabled={bulkDeleting}>
                Limpar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selected.size === 0 || bulkDeleting}
                onClick={handleBulkDelete}
              >
                {bulkDeleting ? 'Deletando…' : `Deletar selecionadas (${selected.size})`}
              </Button>
              <Button variant="ghost" size="sm" onClick={exitSelectMode} disabled={bulkDeleting}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setSelectMode(true)}>
              Selecionar
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-2.5 py-1 rounded text-sm transition-colors ${
              viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
            title="Vista em grade"
          >
            ⊞
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1 rounded text-sm transition-colors ${
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
            title="Vista em lista"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {photos.map((photo) => {
            const isDeleting = deleting.has(photo.id)
            const isReprocessing = reprocessing.has(photo.id)
            const isSelected = selected.has(photo.id)
            const url = thumbUrl(photo, storageBase)

            return (
              <div
                key={photo.id}
                className={`relative group aspect-square rounded-lg overflow-hidden border bg-muted transition-all ${
                  selectMode ? 'cursor-pointer' : ''
                } ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                onClick={selectMode ? () => toggleSelect(photo.id) : undefined}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xs text-muted-foreground text-center px-2">
                      {statusLabel[photo.status] ?? photo.status}
                    </span>
                  </div>
                )}

                {photo.status !== 'ready' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-xs text-white font-medium">
                      {statusLabel[photo.status] ?? photo.status}
                    </span>
                  </div>
                )}

                {/* Checkbox no modo seleção */}
                {selectMode && (
                  <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-white/80 border-gray-400'
                  }`}>
                    {isSelected && <span className="text-xs leading-none">✓</span>}
                  </div>
                )}

                {/* Botão deletar — aparece no hover (fora do select mode) */}
                {!selectMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(photo.id) }}
                    disabled={isDeleting}
                    className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    title="Deletar foto"
                  >
                    {isDeleting ? '…' : '×'}
                  </button>
                )}

                {/* Botão reprocessar */}
                {!selectMode && photo.status === 'error' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReprocess(photo.id) }}
                    disabled={isReprocessing}
                    className="absolute bottom-1.5 left-1.5 bg-black/60 hover:bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 text-xs"
                    title="Reprocessar foto"
                  >
                    {isReprocessing ? '…' : '↻'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {selectMode && <th className="w-10 px-3 py-2" />}
                <th className="px-3 py-2 text-left font-medium w-12">Foto</th>
                <th className="px-3 py-2 text-left font-medium">Nome</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {photos.map((photo) => {
                const isDeleting = deleting.has(photo.id)
                const isReprocessing = reprocessing.has(photo.id)
                const isSelected = selected.has(photo.id)
                const url = thumbUrl(photo, storageBase)

                return (
                  <tr
                    key={photo.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      selectMode ? 'cursor-pointer' : ''
                    } ${isSelected ? 'bg-primary/5' : ''}`}
                    onClick={selectMode ? () => toggleSelect(photo.id) : undefined}
                  >
                    {selectMode && (
                      <td className="px-3 py-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-gray-400'
                        }`}>
                          {isSelected && <span className="text-[10px] leading-none">✓</span>}
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt=""
                          className="w-10 h-10 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground">?</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[180px]">
                      {photoName(photo)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass[photo.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel[photo.status] ?? photo.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(photo.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!selectMode && (
                        <div className="flex items-center justify-end gap-2">
                          {photo.status === 'error' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReprocess(photo.id) }}
                              disabled={isReprocessing}
                              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                            >
                              {isReprocessing ? '…' : 'Reprocessar'}
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(photo.id) }}
                            disabled={isDeleting}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            {isDeleting ? 'Deletando…' : 'Deletar'}
                          </button>
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
