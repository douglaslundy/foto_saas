import Link from 'next/link'

const sections = [
  {
    href: '/dashboard/eventos',
    title: 'Eventos e Ensaios',
    description: 'Crie e gerencie seus eventos, faça upload de fotos e configure preços.',
    icon: '📸',
  },
  {
    href: '/dashboard/financeiro',
    title: 'Financeiro',
    description: 'Acompanhe sua receita, pedidos pagos e gráfico mensal de vendas.',
    icon: '💰',
  },
  {
    href: '/dashboard/clientes',
    title: 'Clientes e Pedidos',
    description: 'Visualize todos os pedidos e dados dos clientes.',
    icon: '👥',
  },
  {
    href: '/dashboard/equipe',
    title: 'Equipe',
    description: 'Gerencie colaboradores e convide sub-fotógrafos.',
    icon: '🤝',
  },
  {
    href: '/dashboard/configuracoes',
    title: 'Configurações',
    description: 'Altere seu nome de exibição e senha de acesso.',
    icon: '⚙️',
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bem-vindo ao FotoSaaS</h1>
        <p className="text-muted-foreground mt-1">
          Escolha uma seção para começar.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="border rounded-lg p-5 hover:border-primary hover:shadow-sm transition-all space-y-2 block"
          >
            <div className="text-2xl">{s.icon}</div>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="text-sm text-muted-foreground">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
