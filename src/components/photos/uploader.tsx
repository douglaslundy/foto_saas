'use client'

import { useRef, useState } from 'react'

type FileStatus = 'pending' | 'uploading' | 'processing' | 'ready' | 'error'

type FileUploadState = {
  file: File
  status: FileStatus
  photoId?: string
  error?: string
}

type PhotoData = {
  id: string
  status: string
  thumbnail_path: string | null
  public_storage_path: string | null
  created_at: string
  updated_at: string
}

type PhotoUploaderProps = {
  eventId: string
  onUploadComplete?: (photoIds: string[]) => void
  onPhotoReady?: (photo: PhotoData) => void
}

const statusLabel: Record<FileStatus, string> = {
  pending: 'Aguardando',
  uploading: 'Enviando…',
  processing: 'Processando…',
  ready: 'Concluída ✓',
  error: 'Erro',
}

const statusColor: Record<FileStatus, string> = {
  pending: 'text-[var(--color-ink-muted)]',
  uploading: 'text-blue-500',
  processing: 'text-[var(--color-gold)]',
  ready: 'text-green-600',
  error: 'text-[var(--color-danger)]',
}

export function PhotoUploader({ eventId, onUploadComplete, onPhotoReady }: PhotoUploaderProps) {
  const [uploads, setUploads] = useState<FileUploadState[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function setFileStatus(index: number, update: Partial<FileUploadState>) {
    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, ...update } : u)))
  }

  async function pollStatus(photoId: string, index: number) {
    const maxAttempts = 30 // 60 segundos
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const res = await fetch(`/api/photos/${photoId}`)
        if (!res.ok) break
        const photo = await res.json()
        if (photo.status === 'ready') {
          setFileStatus(index, { status: 'ready' })
          onPhotoReady?.(photo)
          return
        }
        if (photo.status === 'error') {
          setFileStatus(index, { status: 'error', error: 'Erro no processamento' })
          return
        }
      } catch {
        break
      }
    }
  }

  async function uploadSingleFile(file: File, index: number): Promise<string | null> {
    setFileStatus(index, { status: 'uploading' })
    const formData = new FormData()
    formData.append('file', file)
    formData.append('event_id', eventId)

    try {
      const res = await fetch('/api/photos/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setFileStatus(index, { status: 'error', error: body.error ?? 'Erro no upload' })
        return null
      }
      const { photo_id } = await res.json()
      setFileStatus(index, { status: 'processing', photoId: photo_id })
      // Add to grid immediately so it's visible while worker processes
      onPhotoReady?.({
        id: photo_id,
        status: 'processing',
        thumbnail_path: null,
        public_storage_path: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      pollStatus(photo_id, index) // updates to 'ready' when worker finishes
      return photo_id as string
    } catch {
      setFileStatus(index, { status: 'error', error: 'Erro de rede' })
      return null
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const ALLOWED_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'])
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    const startIndex = uploads.length
    setUploads((prev) => [
      ...prev,
      ...fileArray.map((file) => ({ file, status: 'pending' as FileStatus })),
    ])

    setIsUploading(true)
    const completedIds: string[] = []

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXTS.has(ext)) {
        const isRaw = ['cr2', 'cr3', 'cr32', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', 'raw'].includes(ext)
        setFileStatus(startIndex + i, {
          status: 'error',
          error: isRaw
            ? `RAW (.${ext}) não suportado — converta para JPG antes de enviar`
            : `Formato .${ext} não suportado. Use JPG, PNG, WEBP ou HEIC`,
        })
        continue
      }
      const id = await uploadSingleFile(file, startIndex + i)
      if (id) completedIds.push(id)
    }

    setIsUploading(false)
    onUploadComplete?.(completedIds)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  const doneCount = uploads.filter((u) => u.status === 'ready').length
  const errorCount = uploads.filter((u) => u.status === 'error').length

  return (
    <div className="space-y-4">
      {/* Zona de drop */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        className={`relative border-2 border-dashed rounded-[var(--radius)] p-10 text-center transition-all duration-200 ${
          isDragging
            ? 'border-[var(--color-gold)] bg-[var(--color-gold-light)]'
            : 'border-[var(--color-border-strong)] hover:border-[var(--color-gold)]/50 hover:bg-[var(--color-surface-alt)]'
        }`}
      >
        <svg
          className="mx-auto mb-4 text-[var(--color-ink-muted)]"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.5"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="font-display text-lg font-semibold text-[var(--color-ink)] mb-1">
          Arraste fotos ou clique para selecionar
        </p>
        <p className="text-[var(--color-ink-muted)] text-sm mb-4">
          JPG, PNG, WEBP, HEIC · Máx. 50 MB · RAW não suportado
        </p>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="px-5 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-sm font-medium hover:bg-[var(--color-surface-alt)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Enviando…' : 'Selecionar arquivos'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
          className="hidden"
          disabled={isUploading}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Lista de uploads */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {doneCount}/{uploads.length} enviadas
            {errorCount > 0 && (
              <span className="text-[var(--color-danger)] ml-2">· {errorCount} com erro</span>
            )}
          </p>
          <ul className="max-h-64 overflow-y-auto space-y-1">
            {uploads.map((u, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 bg-[var(--color-card)]"
              >
                <span className="truncate max-w-xs text-[var(--color-ink)]">{u.file.name}</span>
                <span className={statusColor[u.status]}>
                  {u.status === 'error' ? (u.error ?? 'Erro') : statusLabel[u.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
