'use client'

import { useState, useRef } from 'react'

interface BannerConfig {
  banner_image_path: string | null
  banner_title: string
  banner_subtitle: string
  banner_cta_text: string
  banner_cta_url: string
  footer_text: string
  footer_address: string
  footer_phone: string
  footer_whatsapp: string
  footer_instagram: string
  footer_facebook: string
  footer_email: string
}

interface SiteFormProps {
  tenantId: string
  initial: BannerConfig
}

const inputClass =
  'h-11 px-4 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm transition-all duration-200 focus:outline-none focus:border-[var(--color-blue)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] placeholder:text-[var(--color-ink-muted)]'
const labelClass =
  'block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)] mb-1.5'

export default function SiteForm({ tenantId, initial }: SiteFormProps) {
  const [bannerTitle, setBannerTitle] = useState(initial.banner_title)
  const [bannerSubtitle, setBannerSubtitle] = useState(initial.banner_subtitle)
  const [bannerCtaText, setBannerCtaText] = useState(initial.banner_cta_text)
  const [bannerCtaUrl, setBannerCtaUrl] = useState(initial.banner_cta_url)
  const [imagePath, setImagePath] = useState(initial.banner_image_path)
  const [footerText, setFooterText] = useState(initial.footer_text ?? '')
  const [footerAddress, setFooterAddress] = useState(initial.footer_address ?? '')
  const [footerPhone, setFooterPhone] = useState(initial.footer_phone ?? '')
  const [footerWhatsapp, setFooterWhatsapp] = useState(initial.footer_whatsapp ?? '')
  const [footerInstagram, setFooterInstagram] = useState(initial.footer_instagram ?? '')
  const [footerFacebook, setFooterFacebook] = useState(initial.footer_facebook ?? '')
  const [footerEmail, setFooterEmail] = useState(initial.footer_email ?? '')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`
    : ''

  const currentImageUrl = previewUrl ?? (imagePath ? `${storageBase}/${imagePath}` : null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('banner_title', bannerTitle)
      formData.append('banner_subtitle', bannerSubtitle)
      formData.append('banner_cta_text', bannerCtaText)
      formData.append('banner_cta_url', bannerCtaUrl)
      const file = fileRef.current?.files?.[0]
      if (file) {
        formData.append('banner_image', file)
      }
      formData.append('footer_text', footerText)
      formData.append('footer_address', footerAddress)
      formData.append('footer_phone', footerPhone)
      formData.append('footer_whatsapp', footerWhatsapp)
      formData.append('footer_instagram', footerInstagram)
      formData.append('footer_facebook', footerFacebook)
      formData.append('footer_email', footerEmail)

      const res = await fetch('/api/tenant/site', {
        method: 'PUT',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: json.error ?? 'Erro ao salvar.' })
      } else {
        setImagePath(json.config?.banner_image_path ?? imagePath)
        setPreviewUrl(null)
        if (fileRef.current) fileRef.current.value = ''
        setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro inesperado ao salvar configurações.' })
    } finally {
      setLoading(false)
    }
  }

  // suppress unused tenantId warning — it's kept for potential future use
  void tenantId

  return (
    <div className="space-y-6">
    <div
      className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="px-6 py-5 border-b border-[var(--color-border-strong)]">
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Configurações do Banner</h2>
        <p className="text-[var(--color-ink-muted)] text-sm mt-0.5">Personalize o banner da página pública do seu estúdio</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-6">
          {/* Banner image upload */}
          <div>
            <label className={labelClass}>Imagem do banner</label>
            {currentImageUrl && (
              <div className="mb-3 rounded-[var(--radius-sm)] overflow-hidden border border-[var(--color-border)] w-full max-w-md h-40 bg-[var(--color-surface-alt)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImageUrl}
                  alt="Banner preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-[var(--color-ink-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-[var(--radius-sm)] file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-surface-alt)] file:text-[var(--color-ink)] hover:file:bg-[var(--color-border)] transition-all"
            />
            <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">Formatos aceitos: JPG, PNG, WebP. Recomendado: 1920×600px.</p>
          </div>

          {/* Banner title */}
          <div>
            <label htmlFor="banner_title" className={labelClass}>Título do banner</label>
            <input
              id="banner_title"
              type="text"
              value={bannerTitle}
              onChange={e => setBannerTitle(e.target.value)}
              placeholder="Ex: Registrando momentos únicos"
              className={inputClass}
            />
          </div>

          {/* Banner subtitle */}
          <div>
            <label htmlFor="banner_subtitle" className={labelClass}>Subtítulo</label>
            <input
              id="banner_subtitle"
              type="text"
              value={bannerSubtitle}
              onChange={e => setBannerSubtitle(e.target.value)}
              placeholder="Ex: Fotografia profissional para eventos especiais"
              className={inputClass}
            />
          </div>

          {/* CTA text */}
          <div>
            <label htmlFor="banner_cta_text" className={labelClass}>Texto do botão CTA</label>
            <input
              id="banner_cta_text"
              type="text"
              value={bannerCtaText}
              onChange={e => setBannerCtaText(e.target.value)}
              placeholder="Ex: Ver eventos"
              className={inputClass}
            />
          </div>

          {/* CTA URL */}
          <div>
            <label htmlFor="banner_cta_url" className={labelClass}>URL do botão CTA</label>
            <input
              id="banner_cta_url"
              type="text"
              value={bannerCtaUrl}
              onChange={e => setBannerCtaUrl(e.target.value)}
              placeholder="Ex: /eventos"
              className={inputClass}
            />
          </div>

          {/* Message */}
          {message && (
            <div
              className={`rounded-[var(--radius-sm)] px-4 py-3 text-sm font-medium ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60"
          >
            {loading ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </form>
    </div>

    {/* Seção Rodapé */}
    <div className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <div className="px-6 py-4 border-b border-[var(--color-border-strong)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
          Rodapé do Site
        </h2>
        <p className="text-xs text-[var(--color-ink-muted)] mt-1">
          Informações exibidas no rodapé do seu portal público.
        </p>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className={labelClass}>Texto do rodapé</label>
          <textarea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            rows={3}
            className={inputClass + ' h-auto py-2.5 resize-none'}
            placeholder="Breve texto sobre seu trabalho..."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Endereço</label>
            <input type="text" value={footerAddress} onChange={(e) => setFooterAddress(e.target.value)} className={inputClass} placeholder="Cidade, Estado" />
          </div>
          <div>
            <label className={labelClass}>Telefone</label>
            <input type="tel" value={footerPhone} onChange={(e) => setFooterPhone(e.target.value)} className={inputClass} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label className={labelClass}>WhatsApp</label>
            <input type="tel" value={footerWhatsapp} onChange={(e) => setFooterWhatsapp(e.target.value)} className={inputClass} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label className={labelClass}>E-mail de contato</label>
            <input type="email" value={footerEmail} onChange={(e) => setFooterEmail(e.target.value)} className={inputClass} placeholder="contato@seusite.com" />
          </div>
          <div>
            <label className={labelClass}>Instagram</label>
            <input type="text" value={footerInstagram} onChange={(e) => setFooterInstagram(e.target.value)} className={inputClass} placeholder="@seuusuario" />
          </div>
          <div>
            <label className={labelClass}>Facebook</label>
            <input type="text" value={footerFacebook} onChange={(e) => setFooterFacebook(e.target.value)} className={inputClass} placeholder="facebook.com/suapagina" />
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
