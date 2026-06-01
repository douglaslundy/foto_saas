'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'

interface NavbarProps {
  userName: string
  userRole: 'admin' | 'photographer' | 'sub_photographer' | 'viewer'
}

const navLinks = [
  { href: '/dashboard', label: 'Início' },
  { href: '/dashboard/eventos', label: 'Eventos' },
  { href: '/dashboard/financeiro', label: 'Financeiro' },
  { href: '/dashboard/clientes', label: 'Clientes' },
  { href: '/dashboard/equipe', label: 'Equipe' },
  { href: '/dashboard/configuracoes', label: 'Configurações' },
]

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function Navbar({ userName, userRole }: NavbarProps) {
  const pathname = usePathname()

  return (
    <nav
      className="sticky top-0 z-50 h-[60px] flex items-center px-6 gap-8 border-b border-[var(--color-border)]"
      style={{ background: 'rgba(var(--color-surface-rgb, 245,244,240), 0.88)', backdropFilter: 'blur(16px)' }}
    >
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-ink)] flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5"/>
            <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="font-display font-bold text-base tracking-tight text-[var(--color-ink)]">
          FotoSaaS
        </span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1 flex-1">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--color-surface-alt)] text-[var(--color-ink)]'
                  : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)]'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        {userRole === 'admin' && (
          <Link href="/admin" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-[var(--color-gold-light)] text-[var(--color-gold)] border border-[var(--color-gold)]/30">
            Painel Admin
          </Link>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border-strong)] flex items-center justify-center text-xs font-semibold font-display text-[var(--color-ink)]">
            {getInitials(userName)}
          </div>
          <span className="hidden md:block text-sm text-[var(--color-ink-soft)] max-w-[120px] truncate">{userName}</span>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  )
}
