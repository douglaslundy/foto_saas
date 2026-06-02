import type { Metadata } from 'next'
import './globals.css'
import { getPlatformConfig } from '@/lib/platform-config'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const config = await getPlatformConfig()
    return {
      title: config.platformName,
      description: 'Plataforma de venda de fotos para fotógrafos',
      icons: config.faviconUrl ? { icon: config.faviconUrl } : undefined,
    }
  } catch {
    // Fallback at build time when DB is not available
    return {
      title: 'FotoSaaS',
      description: 'Plataforma de venda de fotos para fotógrafos',
    }
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
