interface FooterData {
  footer_text?: string | null
  footer_address?: string | null
  footer_phone?: string | null
  footer_whatsapp?: string | null
  footer_instagram?: string | null
  footer_facebook?: string | null
  footer_email?: string | null
  name: string
}

export function TenantFooter({ data }: { data: FooterData }) {
  const hasContent =
    data.footer_text || data.footer_address || data.footer_phone ||
    data.footer_whatsapp || data.footer_instagram || data.footer_facebook || data.footer_email

  if (!hasContent) return null

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-card)] mt-16">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <p className="font-display text-lg font-bold text-[var(--color-ink)] mb-3">{data.name}</p>
            {data.footer_text && (
              <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">{data.footer_text}</p>
            )}
          </div>

          {/* Contato */}
          {(data.footer_address || data.footer_phone || data.footer_whatsapp || data.footer_email) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-3">Contato</p>
              <ul className="space-y-2 text-sm text-[var(--color-ink-muted)]">
                {data.footer_address && <li>📍 {data.footer_address}</li>}
                {data.footer_phone && <li>📞 {data.footer_phone}</li>}
                {data.footer_whatsapp && (
                  <li>
                    <a
                      href={`https://wa.me/${data.footer_whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--color-gold)] transition-colors"
                    >
                      💬 WhatsApp
                    </a>
                  </li>
                )}
                {data.footer_email && (
                  <li>
                    <a href={`mailto:${data.footer_email}`} className="hover:text-[var(--color-gold)] transition-colors">
                      {data.footer_email}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Redes sociais */}
          {(data.footer_instagram || data.footer_facebook) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-3">Redes Sociais</p>
              <ul className="space-y-2 text-sm">
                {data.footer_instagram && (
                  <li>
                    <a
                      href={
                        data.footer_instagram.startsWith('http')
                          ? data.footer_instagram
                          : `https://instagram.com/${data.footer_instagram.replace('@', '')}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-ink-muted)] hover:text-[var(--color-gold)] transition-colors"
                    >
                      📸 Instagram {data.footer_instagram.startsWith('@') ? data.footer_instagram : `@${data.footer_instagram}`}
                    </a>
                  </li>
                )}
                {data.footer_facebook && (
                  <li>
                    <a
                      href={
                        data.footer_facebook.startsWith('http')
                          ? data.footer_facebook
                          : `https://facebook.com/${data.footer_facebook}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-ink-muted)] hover:text-[var(--color-gold)] transition-colors"
                    >
                      👍 Facebook
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--color-border)] text-center text-xs text-[var(--color-ink-muted)]">
          © {new Date().getFullYear()} {data.name}. Desenvolvido com FotoSaaS.
        </div>
      </div>
    </footer>
  )
}
