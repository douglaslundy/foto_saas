# Redesign Editorial Limpo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o design atual (creme + dourado + Playfair Display) pelo design "Editorial Limpo" — branco, Inter, azul #2563eb, sem dark mode.

**Architecture:** Estratégia top-down — atualizar o design system base (globals.css + tokens CSS) primeiro para que os valores novos se propaguem via variáveis CSS. Em seguida corrigir os componentes e páginas com estilos hardcoded que não usam variáveis. Mantemos a estrutura de componentes existente; apenas atualizamos estilos.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, CSS custom properties, Google Fonts (Inter)

---

## Mapa de Arquivos

| Arquivo | Ação |
|---------|------|
| `src/app/globals.css` | Modificar — novos tokens CSS, remover dark mode |
| `src/app/layout.tsx` | Modificar — trocar fontes para Inter, remover ThemeProvider |
| `tailwind.config.ts` | Modificar — atualizar aliases de cor |
| `src/components/navbar.tsx` | Modificar — remover ThemeToggle, estilos novos |
| `src/components/theme-toggle.tsx` | Manter (não usado após remoção) |
| `src/app/(dashboard)/dashboard/layout.tsx` | Modificar — background branco |
| `src/app/(dashboard)/dashboard/page.tsx` | Modificar — KPI cards novos |
| `src/app/(admin)/admin/layout.tsx` | Modificar — sidebar → top nav escuro |
| `src/app/(auth)/login/page.tsx` | Modificar — remover dark/gold hardcoded |
| `src/app/(auth)/login/_components/login-form.tsx` | Verificar e ajustar se necessário |
| `src/app/[tenant]/layout.tsx` | Modificar — header branco limpo |
| `src/app/[tenant]/page.tsx` | Modificar — remover gradientes dark |
| `src/app/[tenant]/evento/[slug]/page.tsx` | Modificar — clean layout |
| `src/components/events/event-card.tsx` | Modificar — remover gold line |
| `src/components/events/event-status-badge.tsx` | Verificar tokens |
| `src/components/portal/tenant-footer.tsx` | Verificar e simplificar |

---

## Task 1: Design System — globals.css + layout.tsx + tailwind.config.ts

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Substituir globals.css completo**

Substitua TODO o conteúdo de `src/app/globals.css` por:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-bg: #ffffff;
    --color-bg-alt: #f9fafb;
    --color-card: #ffffff;
    --color-border: #e5e7eb;
    --color-border-strong: #d1d5db;
    --color-ink: #111827;
    --color-ink-soft: #374151;
    --color-ink-muted: #6b7280;
    --color-ink-disabled: #9ca3af;
    --color-blue: #2563eb;
    --color-blue-hover: #1d4ed8;
    --color-blue-light: #eff6ff;
    --color-blue-border: #bfdbfe;
    --color-success: #16a34a;
    --color-warning: #ca8a04;
    --color-danger: #dc2626;
    --color-admin-header: #111827;

    /* Aliases para compatibilidade com componentes existentes */
    --color-surface: var(--color-bg);
    --color-surface-alt: var(--color-bg-alt);
    --color-ink-muted: #6b7280;
    --color-border-strong: #d1d5db;
    --color-gold: #2563eb;
    --color-gold-light: #eff6ff;
    --color-cta: #2563eb;
    --color-cta-fg: #ffffff;
    --color-cta-fg-60: rgba(255,255,255,0.6);
    --color-accent: #111827;
    --color-success: #16a34a;

    --radius: 8px;
    --radius-sm: 6px;
    --radius-pill: 999px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.12);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.16);
    --transition: 0.15s ease;

    /* Shadcn/ui compat */
    --background: #ffffff;
    --foreground: #111827;
    --card: #ffffff;
    --card-foreground: #111827;
    --popover: #ffffff;
    --popover-foreground: #111827;
    --primary: #2563eb;
    --primary-foreground: #ffffff;
    --secondary: #f9fafb;
    --secondary-foreground: #111827;
    --muted: #f9fafb;
    --muted-foreground: #6b7280;
    --accent: #f9fafb;
    --accent-foreground: #111827;
    --destructive: #dc2626;
    --destructive-foreground: #ffffff;
    --border: #e5e7eb;
    --input: #d1d5db;
    --ring: #2563eb;
  }

  * { box-sizing: border-box; }

  body {
    font-family: 'Inter', system-ui, sans-serif;
    background-color: #ffffff;
    color: #111827;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: 'Inter', system-ui, sans-serif;
    font-weight: 600;
    color: #111827;
  }
}

@layer utilities {
  .font-display { font-family: 'Inter', system-ui, sans-serif; }
  .font-body { font-family: 'Inter', system-ui, sans-serif; }
  .text-ink { color: #111827; }
  .text-ink-soft { color: #374151; }
  .text-ink-muted { color: #6b7280; }
  .text-blue { color: #2563eb; }
  .bg-blue-light { background-color: #eff6ff; }
  .border-blue { border-color: #2563eb; }
}
```

- [ ] **Step 2: Atualizar layout.tsx — trocar fontes para Inter**

Substitua `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FotoSaaS',
  description: 'Plataforma de venda de fotos para fotógrafos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Atualizar tailwind.config.ts**

Substitua `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss"

const config = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "#e5e7eb",
        input: "#d1d5db",
        ring: "#2563eb",
        background: "#ffffff",
        foreground: "#111827",
        primary: { DEFAULT: "#2563eb", foreground: "#ffffff" },
        secondary: { DEFAULT: "#f9fafb", foreground: "#111827" },
        destructive: { DEFAULT: "#dc2626", foreground: "#ffffff" },
        muted: { DEFAULT: "#f9fafb", foreground: "#6b7280" },
        accent: { DEFAULT: "#f9fafb", foreground: "#111827" },
        popover: { DEFAULT: "#ffffff", foreground: "#111827" },
        card: { DEFAULT: "#ffffff", foreground: "#111827" },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.08)",
        md: "0 4px 12px rgba(0,0,0,0.12)",
        lg: "0 8px 24px rgba(0,0,0,0.16)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
```

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx tailwind.config.ts
git commit -m "feat: design system editorial limpo — Inter, branco, azul"
```

---

## Task 2: Navbar do Dashboard

**Files:**
- Modify: `src/components/navbar.tsx`

- [ ] **Step 1: Reescrever navbar.tsx**

Substitua `src/components/navbar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavbarProps {
  userName: string
  userRole: 'admin' | 'photographer' | 'sub_photographer' | 'viewer'
  pendingCount?: number
}

const navLinks = [
  { href: '/dashboard', label: 'Início', exact: true },
  { href: '/dashboard/eventos', label: 'Eventos' },
  { href: '/dashboard/financeiro', label: 'Financeiro' },
  { href: '/dashboard/clientes', label: 'Clientes' },
  { href: '/dashboard/equipe', label: 'Equipe' },
  { href: '/dashboard/configuracoes', label: 'Configurações' },
]

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function Navbar({ userName, userRole, pendingCount = 0 }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 h-14 flex items-center px-6 gap-6 border-b border-[#e5e7eb] bg-white">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
        <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5"/>
            <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="font-semibold text-sm text-[#111827]">FotoSaaS</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1 flex-1">
        {navLinks.map((link) => {
          const isActive = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(link.href + '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#eff6ff] text-[#2563eb]'
                  : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
        {userRole === 'photographer' && (
          <Link
            href="/dashboard/aprovacoes"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
              pathname.startsWith('/dashboard/aprovacoes')
                ? 'bg-[#eff6ff] text-[#2563eb]'
                : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]'
            }`}
          >
            Aprovações
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#2563eb] text-white text-[10px] font-bold">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </Link>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        {userRole === 'admin' && (
          <Link
            href="/admin"
            className="hidden sm:flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#111827] text-white hover:bg-[#1f2937] transition-colors"
          >
            Admin
          </Link>
        )}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#eff6ff] border border-[#bfdbfe] flex items-center justify-center text-[11px] font-semibold text-[#2563eb]">
            {getInitials(userName)}
          </div>
          <span className="hidden md:block text-sm text-[#374151] max-w-[120px] truncate">{userName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#dc2626] transition-colors"
        >
          Sair
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/navbar.tsx
git commit -m "feat: navbar dashboard com design editorial limpo"
```

---

## Task 3: Admin Layout — sidebar → top nav escuro

**Files:**
- Modify: `src/app/(admin)/admin/layout.tsx`

- [ ] **Step 1: Reescrever admin layout**

Substitua `src/app/(admin)/admin/layout.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .single() as { data: { role: string; name: string | null } | null }

  if (profile?.role !== 'admin') redirect('/dashboard')

  const navLinks = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/tenants', label: 'Fotógrafos' },
    { href: '/admin/repasses', label: 'Repasses' },
    { href: '/admin/configuracoes', label: 'Configurações' },
  ]

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      {/* Header escuro — diferencia admin do dashboard */}
      <header className="sticky top-0 z-50 h-14 bg-[#111827] border-b border-[#1f2937] flex items-center px-6 gap-6">
        <Link href="/admin" className="flex items-center gap-2 shrink-0 mr-2">
          <div className="w-6 h-6 rounded bg-[#2563eb] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5"/>
              <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-semibold text-sm text-white">FotoSaaS</span>
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white">
            Admin
          </span>
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-white/60">{profile?.name ?? user.email}</span>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            Dashboard →
          </Link>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(admin)/admin/layout.tsx
git commit -m "feat: admin com header escuro horizontal"
```

---

## Task 4: Dashboard Layout + Home (KPIs)

**Files:**
- Modify: `src/app/(dashboard)/dashboard/layout.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Atualizar dashboard layout**

Substitua `src/app/(dashboard)/dashboard/layout.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/navbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, name, tenant_id')
    .eq('id', user.id)
    .single()

  // @ts-expect-error: profile type
  if (!profile || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    redirect('/login')
  }

  const profileWithName = profile as { name?: string; role?: string; tenant_id?: string } | null
  const userName = profileWithName?.name || user.email?.split('@')[0] || 'Usuário'
  const userRole = (profileWithName?.role || 'photographer') as 'admin' | 'photographer' | 'sub_photographer' | 'viewer'

  const adminClient = createAdminClient()
  const pendingCount = userRole === 'photographer'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (((await (adminClient as any)
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', profileWithName?.tenant_id ?? '')
        .eq('status', 'pending_approval')).count) ?? 0)
    : 0

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <Navbar userName={userName} userRole={userRole} pendingCount={pendingCount} />
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Atualizar dashboard home (KPI cards)**

Substitua `src/app/(dashboard)/dashboard/page.tsx`:

```tsx
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <p className="text-xs font-medium text-[#6b7280] uppercase tracking-wide mb-3">{label}</p>
      <p className="text-3xl font-bold text-[#111827] leading-none mb-1">{value}</p>
      {sub && <p className="text-xs text-[#9ca3af] mt-1">{sub}</p>}
    </div>
  )
}

const totalEvents: number | null = null
const totalPhotos: number | null = null
const monthRevenue: number | null = null
const weekOrders: number | null = null
const recentEvents: Array<{ id: string; title: string; event_date?: string | null; status: string }> | null = null
const recentOrders: Array<{ id: string; customer_name?: string | null; created_at: string; total: number }> | null = null

export default function DashboardPage() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">{greeting}, fotógrafo</h1>
        <p className="text-sm text-[#6b7280] mt-0.5 capitalize">{dateStr}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de Eventos" value={totalEvents ?? 0} sub="todos os tempos" />
        <StatCard label="Total de Fotos" value={totalPhotos ?? 0} sub="enviadas" />
        <StatCard
          label="Receita do Mês"
          value={monthRevenue ? `R$ ${monthRevenue.toFixed(2)}` : 'R$ 0,00'}
          sub="mês atual"
        />
        <StatCard label="Pedidos (7 dias)" value={weekOrders ?? 0} sub="últimos 7 dias" />
      </div>

      {/* Tabelas */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Eventos recentes */}
        <div className="lg:col-span-3 bg-white border border-[#e5e7eb] rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div className="px-5 py-3.5 border-b border-[#e5e7eb] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Eventos Recentes</h2>
          </div>
          <div className="divide-y divide-[#f3f4f6]">
            {recentEvents?.map((event) => (
              <div key={event.id} className="px-5 py-3 flex items-center justify-between hover:bg-[#f9fafb] transition-colors">
                <div>
                  <p className="text-sm font-medium text-[#111827]">{event.title}</p>
                  <p className="text-xs text-[#6b7280]">
                    {event.event_date ? new Date(event.event_date).toLocaleDateString('pt-BR') : '—'}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  event.status === 'published'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {event.status === 'published' ? 'Publicado' : event.status === 'archived' ? 'Arquivado' : 'Rascunho'}
                </span>
              </div>
            ))}
            {(!recentEvents || recentEvents.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-[#6b7280]">Nenhum evento ainda.</div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-[#f3f4f6]">
            <a href="/dashboard/eventos" className="text-xs font-medium text-[#2563eb] hover:underline">
              Ver todos os eventos →
            </a>
          </div>
        </div>

        {/* Pedidos recentes */}
        <div className="lg:col-span-2 bg-white border border-[#e5e7eb] rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div className="px-5 py-3.5 border-b border-[#e5e7eb]">
            <h2 className="text-sm font-semibold text-[#111827]">Pedidos Recentes</h2>
          </div>
          <div className="divide-y divide-[#f3f4f6]">
            {recentOrders?.map((order) => (
              <div key={order.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#111827]">{order.customer_name || 'Cliente'}</p>
                  <p className="text-xs text-[#6b7280]">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <p className="text-sm font-semibold text-[#111827]">R$ {Number(order.total).toFixed(2)}</p>
              </div>
            ))}
            {(!recentOrders || recentOrders.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-[#6b7280]">Nenhum pedido ainda.</div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-[#f3f4f6]">
            <a href="/dashboard/financeiro" className="text-xs font-medium text-[#2563eb] hover:underline">
              Ver financeiro →
            </a>
          </div>
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: '＋', label: 'Novo Evento', href: '/dashboard/eventos/novo' },
          { icon: '↑', label: 'Enviar Fotos', href: '/dashboard/eventos' },
          { icon: '👥', label: 'Ver Clientes', href: '/dashboard/clientes' },
          { icon: '⚙', label: 'Configurações', href: '/dashboard/configuracoes' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="bg-white border border-[#e5e7eb] rounded-lg p-4 flex flex-col items-center gap-2 text-center hover:border-[#2563eb] hover:shadow-sm transition-all"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm font-medium text-[#374151]">{item.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/layout.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: dashboard layout e home com design editorial"
```

---

## Task 5: Login Page

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Reescrever login page**

Substitua `src/app/(auth)/login/page.tsx`:

```tsx
import { Suspense } from 'react'
import { LoginForm } from './_components/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left — imagem/branding */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-[#111827]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2563eb] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
              <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-semibold text-white">FotoSaaS</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Gestão de eventos &amp; ensaios fotográficos
          </h1>
          <p className="text-white/50 text-base">
            A plataforma completa para fotógrafos profissionais.
          </p>
        </div>
      </div>

      {/* Right — formulário */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6 md:hidden">
              <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5" />
                  <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="font-semibold text-[#111827]">FotoSaaS</span>
            </div>
            <h2 className="text-2xl font-bold text-[#111827] mb-1">Bem-vindo de volta</h2>
            <p className="text-sm text-[#6b7280]">Entre com suas credenciais para continuar</p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(auth)/login/page.tsx
git commit -m "feat: login page com design editorial"
```

---

## Task 6: Portal Público — Header + Layout

**Files:**
- Modify: `src/app/[tenant]/layout.tsx`

- [ ] **Step 1: Atualizar tenant layout**

Substitua `src/app/[tenant]/layout.tsx`:

```tsx
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CartButton } from '@/components/cart/cart-button'
import { CookieConsent } from '@/components/ui/cookie-consent'
import { TenantFooter } from '@/components/portal/tenant-footer'

const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  const headersList = await headers()
  const customDomain = headersList.get('x-custom-domain')

  const supabase = createAdminClient()
  const query = supabase.from('tenants').select('id, name, slug, status, logo_storage_path')
  const { data: tenant } = customDomain
    ? await query.eq('custom_domain', customDomain).single()
    : await query.eq('slug', slug).single()

  if (!tenant || (tenant as { status: string }).status !== 'active') notFound()

  const tenantBase = tenant as { id: string; name: string; slug: string; status: string; logo_storage_path: string | null }

  type FooterFields = { footer_text: string | null; footer_address: string | null; footer_phone: string | null; footer_whatsapp: string | null; footer_instagram: string | null; footer_facebook: string | null; footer_email: string | null }
  let footerData: FooterFields = { footer_text: null, footer_address: null, footer_phone: null, footer_whatsapp: null, footer_instagram: null, footer_facebook: null, footer_email: null }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: footerRow } = await (supabase as any)
      .from('tenants')
      .select('footer_text, footer_address, footer_phone, footer_whatsapp, footer_instagram, footer_facebook, footer_email')
      .eq('id', tenantBase.id)
      .single()
    if (footerRow) footerData = footerRow as FooterFields
  } catch { /* migration ainda não aplicada */ }

  const tenantRecord = { ...tenantBase, ...footerData }
  const logoUrl = tenantRecord.logo_storage_path
    ? `${STORAGE_URL}/${tenantRecord.logo_storage_path}`
    : null

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="sticky top-0 z-40 h-16 bg-white border-b border-[#e5e7eb] flex items-center px-6">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          <Link href={`/${tenantRecord.slug}`} className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={tenantRecord.name} className="h-9 w-auto object-contain" />
            ) : (
              <span className="text-base font-bold text-[#111827]">{tenantRecord.name}</span>
            )}
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={`/${tenantRecord.slug}/minha-conta`}
              className="text-sm text-[#6b7280] hover:text-[#111827] transition-colors hidden sm:block"
            >
              Minha Conta
            </Link>
            <CartButton tenantSlug={tenantRecord.slug} />
          </div>
        </div>
      </nav>
      <main>{children}</main>
      <TenantFooter data={tenantRecord} />
      <CookieConsent />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[tenant]/layout.tsx
git commit -m "feat: portal público header branco limpo"
```

---

## Task 7: Portal Público — Homepage do Tenant

**Files:**
- Modify: `src/app/[tenant]/page.tsx`

- [ ] **Step 1: Reescrever tenant homepage**

Substitua `src/app/[tenant]/page.tsx`:

```tsx
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { EventsSearchGrid } from './_components/events-search-grid'

type Props = { params: Promise<{ tenant: string }> }

export default async function TenantHomePage({ params }: Props) {
  const { tenant: slug } = await params
  const headersList = await headers()
  const customDomain = headersList.get('x-custom-domain')

  const adminClient = createAdminClient()
  const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

  const query = adminClient.from('tenants').select('id, name, slug, status, bio, banner_image_path, banner_title, banner_subtitle')
  const { data: tenant } = customDomain
    ? await query.eq('custom_domain', customDomain).single()
    : await query.eq('slug', slug).single()

  if (!tenant || (tenant as { status: string }).status !== 'active') notFound()

  const tenantData = tenant as { id: string; slug: string; name: string; bio: string | null; banner_image_path: string | null; banner_title: string | null; banner_subtitle: string | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events } = (await (adminClient as any)
    .from('events')
    .select('id, title, slug, type, event_date, created_at, cover_image_path')
    .eq('tenant_id', tenantData.id)
    .eq('status', 'published')
    .order('event_date', { ascending: false })
    .range(0, 49)) as {
    data: {
      id: string; title: string; slug: string; type: 'event' | 'session'
      event_date: string | null; created_at: string; cover_image_path?: string | null
    }[] | null
  }

  const bannerUrl = tenantData.banner_image_path
    ? `${STORAGE_URL}/${tenantData.banner_image_path}`
    : null

  return (
    <div className="min-h-screen bg-white">
      {/* Banner */}
      <div className="relative h-60 bg-[#111827] overflow-hidden">
        {bannerUrl && (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        )}
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-3xl font-bold text-white">{tenantData.name}</h1>
          {tenantData.bio && (
            <p className="text-white/70 text-sm mt-2 max-w-md">{tenantData.bio}</p>
          )}
        </div>
      </div>

      {/* Eventos */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-[#111827]">Eventos e Ensaios</h2>
        </div>
        <EventsSearchGrid events={events ?? []} tenantSlug={tenantData.slug} />
      </div>

      {/* Footer simples */}
      <footer className="border-t border-[#e5e7eb] py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          © {new Date().getFullYear()} {tenantData.name}
        </p>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[tenant]/page.tsx
git commit -m "feat: portal homepage com banner limpo e grid de eventos"
```

---

## Task 8: Event Card Component

**Files:**
- Modify: `src/components/events/event-card.tsx`

- [ ] **Step 1: Reescrever event card**

Substitua `src/components/events/event-card.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EventStatusBadge } from './event-status-badge'

type EventItem = {
  id: string; title: string; slug: string; type: 'event' | 'session'
  event_date: string | null; status: string; cover_image_path?: string | null
}

export function EventCard({ event, tenantSlug }: { event: EventItem; tenantSlug?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'publish' | 'delete' | null>(null)
  const typeLabel = event.type === 'event' ? 'Evento' : 'Ensaio'

  async function handlePublish() {
    setLoading('publish')
    const res = await fetch(`/api/events/${event.id}/publish`, { method: 'POST' })
    if (res.ok) { router.refresh() }
    else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(data.error ?? 'Erro ao publicar evento')
    }
    setLoading(null)
  }

  async function handleDelete() {
    if (!confirm(`Excluir "${event.title}"? Esta ação não pode ser desfeita.`)) return
    setLoading('delete')
    const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) { router.refresh() }
    else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(data.error ?? 'Erro ao excluir evento')
      setLoading(null)
    }
  }

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      {/* Capa */}
      <div className="h-36 bg-[#f9fafb] relative overflow-hidden">
        {event.cover_image_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public/${event.cover_image_path}`}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-semibold text-[#111827] text-sm leading-snug truncate">{event.title}</p>
            <p className="text-xs text-[#6b7280] mt-0.5">
              {typeLabel}
              {event.event_date && ` · ${new Date(event.event_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`}
            </p>
          </div>
          <EventStatusBadge status={event.status} />
        </div>

        {/* Link público */}
        {tenantSlug && event.status === 'published' && (
          <p className="text-xs text-[#6b7280] truncate mb-3">
            <a
              href={`/${tenantSlug}/evento/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2563eb] hover:underline"
            >
              Ver galeria pública →
            </a>
          </p>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Link
            href={`/dashboard/eventos/${event.id}/editar`}
            className="px-2.5 py-1 rounded text-xs font-medium border border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb] transition-colors"
          >
            Editar
          </Link>
          <Link
            href={`/dashboard/eventos/${event.id}/fotos`}
            className="px-2.5 py-1 rounded text-xs font-medium border border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb] transition-colors"
          >
            Fotos
          </Link>
          {event.status === 'published' && tenantSlug && (
            <Link
              href={`/${tenantSlug}/evento/${event.slug}/qr`}
              target="_blank"
              className="px-2.5 py-1 rounded text-xs font-medium border border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb] transition-colors"
            >
              QR Code
            </Link>
          )}
          {event.status === 'draft' && (
            <>
              <button
                onClick={handlePublish}
                disabled={loading === 'publish'}
                className="px-2.5 py-1 rounded text-xs font-medium bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
              >
                {loading === 'publish' ? 'Publicando...' : 'Publicar'}
              </button>
              <button
                onClick={handleDelete}
                disabled={loading === 'delete'}
                className="px-2.5 py-1 rounded text-xs font-medium bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-colors disabled:opacity-60"
              >
                {loading === 'delete' ? 'Excluindo...' : 'Excluir'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/events/event-card.tsx
git commit -m "feat: event card com design editorial limpo"
```

---

## Task 9: Portal — Página do Evento (Galeria)

**Files:**
- Modify: `src/app/[tenant]/evento/[slug]/page.tsx`

- [ ] **Step 1: Atualizar header imersivo → header limpo**

No arquivo `src/app/[tenant]/evento/[slug]/page.tsx`, localize o bloco `content` e substitua apenas a parte visual (mantendo toda a lógica de dados acima):

```tsx
  const content = (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb + info */}
      <div className="border-b border-[#e5e7eb] bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <a
            href={`/${tenantSlug}`}
            className="text-sm text-[#6b7280] hover:text-[#111827] transition-colors inline-flex items-center gap-1 mb-3"
          >
            ← Voltar
          </a>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">{event.title}</h1>
              {event.event_date && (
                <p className="text-sm text-[#6b7280] mt-0.5">
                  {new Date(event.event_date).toLocaleDateString('pt-BR', {
                    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
                  })}
                </p>
              )}
            </div>
            <p className="text-sm text-[#6b7280] shrink-0">{photoCount} fotos</p>
          </div>
          {event.description && (
            <p className="text-sm text-[#6b7280] mt-2">{event.description}</p>
          )}
        </div>
      </div>

      {/* Busca facial */}
      {event.facial_recognition_enabled && (
        <div className="bg-[#eff6ff] border-b border-[#bfdbfe] px-6 py-3">
          <div className="max-w-6xl mx-auto">
            <EventoPageClient
              eventId={event.id}
              initialPhotos={photos ?? []}
              total={photoCount}
              isManager={isManager}
            />
          </div>
        </div>
      )}

      {/* Grid de fotos */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {!event.facial_recognition_enabled && (
          <PhotoGrid
            initialPhotos={photos ?? []}
            eventId={event.id}
            total={photoCount}
            isManager={isManager}
          />
        )}
      </div>
    </div>
  )
```

> **Nota:** Mantenha todo o código de imports, tipos, funções `getEvent`, `generateMetadata`, e a lógica de `PasswordGate` inalterados. Apenas o bloco `const content = (...)` precisa ser substituído.

- [ ] **Step 2: Commit**

```bash
git add src/app/[tenant]/evento/[slug]/page.tsx
git commit -m "feat: página de evento com layout editorial limpo"
```

---

## Task 10: Verificação Final

- [ ] **Step 1: Rodar dev server e verificar páginas principais**

```bash
cd C:/Users/dougl/workspace5/fotosaas
npm run dev
```

Verificar visualmente:
- `http://localhost:3000/login` — formulário limpo
- `http://localhost:3000/dashboard` — KPI cards brancos
- `http://localhost:3000/dashboard/eventos` — grid de eventos
- `http://localhost:3000/admin` — header escuro
- `http://localhost:3000/[tenant]` — portal público (substituir [tenant] pelo slug)

- [ ] **Step 2: Verificar se há erros de compilação**

```bash
npm run build 2>&1 | tail -30
```

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat: redesign editorial limpo completo — white/Inter/blue"
```

---

## Checklist de Spec Coverage

| Requisito do Spec | Task |
|-------------------|------|
| Inter substituindo Playfair + DM Sans | Task 1 |
| Fundo branco #ffffff | Task 1 |
| Azul #2563eb como ação | Task 1, 2, 4, 8 |
| Sem dark mode | Task 1 (removido) |
| Border radius 8px | Task 1 |
| Navbar horizontal dashboard | Task 2 |
| KPI cards brancos sem dourado | Task 4 |
| Admin header escuro | Task 3 |
| Login page limpa | Task 5 |
| Portal header branco | Task 6 |
| Homepage banner + grid | Task 7 |
| Event card sem gold line | Task 8 |
| Página de evento clean | Task 9 |
