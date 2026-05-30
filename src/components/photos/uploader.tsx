'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type FileStatus = 'pending' | 'uploading' | 'processing' | 'ready' | 'error'

type FileUploadState = {
  file: File
  status: FileStatus
  photoId?: string
  error?: string
}

type PhotoUploaderProps = {
  eventId: string
  onUploadComplete?: (photoIds: string[]) => void
}

const statusLabel: Record<FileStatus, string> = {
  pending: 'Aguardando',
  uploading: 'Enviando…',
  processing: 'Processando…',
  ready: 'Concluída ✓',
  error: 'Erro',
}

const statusColor: Record<FileStatus, string> = {
  pending: 'text-muted-foreground',
  uploading: 'text-blue-500',
  processing: 'text-yellow-500',
  ready: 'text-green-600',
  error: 'text-destructive',
}

export function PhotoUploader({ eventId, onUploadComplete }: PhotoUploaderProps) {
  const [uploads, setUploads] = useState<FileUploadState[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

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
        const { status } = await res.json()
        if (status === 'ready') {
          setFileStatus(index, { status: 'ready' })
          return
        }
        if (status === 'error') {
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
      pollStatus(photo_id, index) // não aguarda — roda em paralelo
      return photo_id as string
    } catch {
      setFileStatus(index, { status: 'error', error: 'Erro de rede' })
      return null
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (fileArray.length === 0) return

    const startIndex = uploads.length
    setUploads((prev) => [
      ...prev,
      ...fileArray.map((file) => ({ file, status: 'pending' as FileStatus })),
    ])

    setIsUploading(true)
    const completedIds: string[] = []

    for (let i = 0; i < fileArray.length; i++) {
      const id = await uploadSingleFile(fileArray[i], startIndex + i)
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
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        className={[
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-primary/50',
        ].join(' ')}
      >
        <p className="text-muted-foreground mb-3">Arraste fotos aqui ou</p>
        <label className="cursor-pointer">
          <Button type="button" variant="outline" disabled={isUploading} asChild>
            <span>{isUploading ? 'Enviando…' : 'Selecionar arquivos'}</span>
          </Button>
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
            className="sr-only"
            disabled={isUploading}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </label>
        <p className="text-xs text-muted-foreground mt-3">
          JPG, PNG, WEBP, HEIC · Máx. 50 MB por foto
        </p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {doneCount}/{uploads.length} enviadas
            {errorCount > 0 && (
              <span className="text-destructive ml-2">· {errorCount} com erro</span>
            )}
          </p>
          <ul className="max-h-64 overflow-y-auto space-y-1">
            {uploads.map((u, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-sm border rounded px-3 py-2"
              >
                <span className="truncate max-w-xs text-foreground">{u.file.name}</span>
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
