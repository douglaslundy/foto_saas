'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/providers/confirm-provider'

type BannerItem = {
  id: string
  url: string
  storage_path: string
  title: string | null
  subtitle: string | null
  sort_order: number
  active: boolean
}

interface BannerManagerProps {
  initialMode: 'static' | 'carousel'
}

export function BannerManager({ initialMode }: BannerManagerProps) {
  const router = useRouter()
  const confirm = useConfirm()
  const [mode, setMode] = useState<'static' | 'carousel'>(initialMode)
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const inputClass = 'h-10 px-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent'

  useEffect(() => {
    fetch('/api/tenant/banners')
      .then((r) => r.json())
      .then(({ banners: b, banner_mode }) => {
        setBanners(b ?? [])
        if (banner_mode) setMode(banner_mode as 'static' | 'carousel')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleModeChange(newMode: 'static' | 'carousel') {
    setMode(newMode)
    await fetch('/api/tenant/banners/mode', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banner_mode: newMode }),
    })
    router.refresh()
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('image', file)
    if (title) formData.append('title', title)
    if (subtitle) formData.append('subtitle', subtitle)
    try {
      const res = await fetch('/api/tenant/banners', { method: 'POST', body: formData })
      if (res.ok) {
        const { banner } = await res.json() as { banner: BannerItem }
        const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`
        setBanners((prev) => [...prev, { ...banner, url: `${storageBase}/${banner.storage_path}` }])
        setTitle('')
        setSubtitle('')
        if (fileRef.current) fileRef.current.value = ''
        setUploadError(null)
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setUploadError(data.error ?? 'Erro ao enviar imagem.')
      }
    } finally {
      setUploading(false)
    }
  }

  async function toggleActive(id: string, active: boolean) {
    // Optimistic update
    setBanners((prev) => prev.map((b) => b.id === id ? { ...b, active } : b))
    try {
      const res = await fetch(`/api/tenant/banners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      })
      if (!res.ok) {
        // Revert on failure
        setBanners((prev) => prev.map((b) => b.id === id ? { ...b, active: !active } : b))
      }
    } catch {
      setBanners((prev) => prev.map((b) => b.id === id ? { ...b, active: !active } : b))
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Remover imagem',
      description: 'Remover esta imagem do carrossel?',
      confirmLabel: 'Remover',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/tenant/banners/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setBanners((prev) => prev.filter((b) => b.id !== id))
      }
    } catch {
      // silently ignore network errors on delete
    }
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>Modo do Banner</h2>
          <p className="text-xs text-[var(--color-ink-muted)] mt-1">Escolha como o banner do topo do seu site será exibido.</p>
        </div>
        <div className="px-6 py-5 flex gap-3">
          {(['static', 'carousel'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`flex-1 py-3 rounded-[var(--radius-sm)] border text-sm font-semibold transition-all ${
                mode === m
                  ? 'bg-[var(--color-cta)] text-[var(--color-cta-fg)] border-transparent'
                  : 'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-border-strong)] hover:border-[var(--color-gold)]'
              }`}
            >
              {m === 'static' ? '🖼 Estático (1 imagem)' : '🎠 Carrossel (múltiplas imagens)'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'carousel' && (
        <>
          {/* Upload form */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
              <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>Adicionar Imagem ao Carrossel</h2>
            </div>
            <form onSubmit={handleUpload} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Imagem *</label>
                <input ref={fileRef} type="file" accept="image/*" required
                  className="w-full text-sm text-[var(--color-ink-muted)] file:mr-3 file:py-2 file:px-4 file:rounded-[var(--radius-sm)] file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-surface-alt)] file:text-[var(--color-ink)] hover:file:bg-[var(--color-surface)]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Título (opcional)</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Ex: Casamento Silva & Costa" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">Subtítulo (opcional)</label>
                  <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputClass} placeholder="Ex: 15 de março de 2025" />
                </div>
              </div>
              <button type="submit" disabled={uploading}
                className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
                {uploading ? 'Enviando...' : '+ Adicionar ao carrossel'}
              </button>
              {uploadError && (
                <p className="text-sm text-[var(--color-danger)]">{uploadError}</p>
              )}
            </form>
          </div>

          {/* List */}
          {!loading && banners.length > 0 && (
            <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
                <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
                  Imagens do Carrossel <span className="text-sm font-normal text-[var(--color-ink-muted)]">({banners.length})</span>
                </h2>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {banners.map((b) => (
                  <div key={b.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-20 h-14 rounded-[var(--radius-sm)] overflow-hidden bg-[var(--color-surface-alt)] shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.url} alt={b.title ?? ''} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{b.title ?? 'Sem título'}</p>
                      {b.subtitle && <p className="text-xs text-[var(--color-ink-muted)] truncate">{b.subtitle}</p>}
                    </div>
                    <button
                      onClick={() => toggleActive(b.id, !b.active)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                        b.active
                          ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                          : 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)]'
                      }`}
                    >
                      {b.active ? 'Ativa' : 'Inativa'}
                    </button>
                    <button onClick={() => handleDelete(b.id)}
                      className="text-xs text-[var(--color-danger)] hover:underline ml-1">
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && banners.length === 0 && (
            <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border-strong)] p-8 text-center text-[var(--color-ink-muted)] text-sm">
              Nenhuma imagem adicionada ainda. Use o formulário acima para adicionar imagens ao carrossel.
            </div>
          )}
        </>
      )}
    </div>
  )
}
