'use client'

import { useState, useRef } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface PerfilStudioFormProps {
  initial: {
    name: string
    slug: string
    custom_domain: string | null
    primary_color: string | null
    bio: string | null
    logo_storage_path: string | null
    favicon_url: string | null
  }
}

const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

const inputClass =
  'h-11 px-4 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-blue)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] placeholder:text-[var(--color-ink-muted)]'
const labelClass =
  'block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)] mb-1.5'

export function PerfilStudioForm({ initial }: PerfilStudioFormProps) {
  const { toast } = useToast()
  const [name, setName] = useState(initial.name)
  const [bio, setBio] = useState(initial.bio ?? '')
  const [primaryColor, setPrimaryColor] = useState(initial.primary_color ?? '#3b82f6')
  const [customDomain, setCustomDomain] = useState(initial.custom_domain ?? '')
  const [loading, setLoading] = useState(false)

  const [logoPreview, setLogoPreview] = useState<string | null>(
    initial.logo_storage_path
      ? `${STORAGE_URL}/${initial.logo_storage_path}`
      : null
  )
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [faviconUrl, setFaviconUrl] = useState(initial.favicon_url ?? '')
  const [faviconUploading, setFaviconUploading] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function handleLogoUpload() {
    if (!logoFile) return
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', logoFile)
      const res = await fetch('/api/tenant/logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro ao fazer upload', description: data.error ?? 'Falha no upload', variant: 'destructive' })
      } else {
        setLogoPreview(data.logoUrl)
        setLogoFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast({ title: 'Erro ao fazer upload', description: message, variant: 'destructive' })
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFaviconUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/tenant/favicon', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) setFaviconUrl(data.url)
      else toast({ title: 'Erro', description: data.error ?? 'Falha no upload', variant: 'destructive' })
    } catch {
      toast({ title: 'Erro de conexão', variant: 'destructive' })
    } finally {
      setFaviconUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/tenant/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          bio: bio || null,
          primary_color: primaryColor || null,
          custom_domain: customDomain || null,
          favicon_url: faviconUrl || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ title: 'Erro', description: err.error ?? 'Falha ao salvar', variant: 'destructive' })
      } else {
        toast({ title: 'Perfil atualizado com sucesso!', variant: 'success' })
      }
    } catch {
      toast({ title: 'Erro de conexão. Tente novamente.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="px-6 py-5 border-b border-[var(--color-border-strong)]">
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Dados do Estúdio</h2>
        <p className="text-[var(--color-ink-muted)] text-sm mt-0.5">Informações públicas do seu estúdio fotográfico</p>
      </div>

      {/* Logo upload section */}
      <div className="px-6 py-5 border-b border-[var(--color-border-strong)]">
        <p className={labelClass}>Logotipo do estúdio</p>
        <div className="flex items-center gap-4">
          {/* Preview box */}
          <div
            className="w-20 h-20 flex-shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] flex items-center justify-center overflow-hidden"
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo do estúdio" className="w-full h-full object-contain" />
            ) : (
              <span className="text-3xl select-none">🖼️</span>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="text-sm text-[var(--color-ink-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded-[var(--radius-sm)] file:border file:border-[var(--color-border-strong)] file:text-xs file:font-medium file:bg-[var(--color-bg-alt)] file:text-[var(--color-ink-soft)] hover:file:bg-[var(--color-surface)] file:cursor-pointer"
            />
            <p className="text-xs text-[var(--color-ink-muted)]">JPG, PNG ou WEBP. Máximo 2 MB.</p>
            {logoFile !== null && (
              <button
                type="button"
                onClick={handleLogoUpload}
                disabled={logoUploading}
                className="self-start px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-blue)] text-white text-xs font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60"
              >
                {logoUploading ? 'Enviando...' : 'Enviar logotipo'}
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-5">
          {/* Nome do estúdio */}
          <div>
            <label htmlFor="name" className={labelClass}>
              Nome do estúdio <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do seu estúdio"
              className={inputClass}
            />
          </div>

          {/* Slug (read-only) */}
          <div>
            <label className={labelClass}>Slug (não editável)</label>
            <div className="h-11 px-4 flex items-center w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] opacity-60 text-sm font-mono text-[var(--color-ink-soft)] select-all">
              {initial.slug}
            </div>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">
              O slug identifica seu estúdio na URL e não pode ser alterado aqui.
            </p>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className={labelClass}>Bio / descrição</label>
            <textarea
              id="bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte um pouco sobre seu estúdio..."
              className="px-4 py-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-blue)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] placeholder:text-[var(--color-ink-muted)] resize-y"
            />
          </div>

          {/* Cor principal */}
          <div>
            <label htmlFor="primary_color" className={labelClass}>Cor principal</label>
            <div className="flex items-center gap-3">
              <input
                id="primary_color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-11 w-16 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] p-1 bg-[var(--color-surface)]"
              />
              <span className="text-sm font-mono text-[var(--color-ink-soft)]">{primaryColor}</span>
            </div>
          </div>

          {/* Domínio personalizado */}
          <div>
            <label htmlFor="custom_domain" className={labelClass}>Domínio personalizado</label>
            <input
              id="custom_domain"
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="fotos.meusite.com.br"
              className={inputClass}
            />
            <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">
              Configure seu DNS para apontar para o servidor antes de salvar.
            </p>
          </div>

          {/* Favicon */}
          <div>
            <label className={labelClass}>Favicon do portal</label>
            {faviconUrl && (
              <div className="mb-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faviconUrl} alt="Favicon" className="w-8 h-8 object-contain border border-[var(--color-border)] rounded" />
                <span className="text-xs text-[var(--color-ink-muted)]">Favicon atual</span>
              </div>
            )}
            <div className="space-y-2">
              <div>
                <label className="text-xs text-[var(--color-ink-muted)] mb-1 block">Upload (PNG, ICO, SVG, JPG — máx. 512 KB)</label>
                <input
                  type="file"
                  accept=".png,.ico,.svg,.jpg,.jpeg"
                  onChange={handleFaviconUpload}
                  disabled={faviconUploading}
                  className="text-sm text-[var(--color-ink-soft)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[var(--color-surface-alt)] file:text-[var(--color-ink)] hover:file:opacity-80 disabled:opacity-50"
                />
                {faviconUploading && <p className="text-xs text-[var(--color-ink-muted)] mt-1">Fazendo upload…</p>}
              </div>
              <div>
                <label className="text-xs text-[var(--color-ink-muted)] mb-1 block">ou URL externa</label>
                <input
                  type="url"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="https://exemplo.com/favicon.ico"
                  className={inputClass}
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
              Ícone exibido na aba do navegador para visitantes do seu portal.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60"
          >
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
