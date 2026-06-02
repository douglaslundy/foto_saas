# Redesign FotoSaaS — Abordagem A: Editorial Limpo

**Data:** 2026-06-01  
**Status:** Aprovado pelo usuário

---

## Objetivo

Substituir o design atual (creme + dourado + Playfair Display) por um design limpo, minimalista e moderno inspirado no fotop.com.

---

## Design System

### Cores
| Token | Valor |
|-------|-------|
| Background | `#ffffff` |
| Background alt | `#f9fafb` |
| Card | `#ffffff` + borda `#e5e7eb` |
| Texto principal | `#111827` |
| Texto secundário | `#6b7280` |
| Texto desabilitado | `#9ca3af` |
| Ação primária | `#2563eb` |
| Ação hover | `#1d4ed8` |
| Badge verde | `#16a34a` |
| Badge amarelo | `#ca8a04` |
| Badge cinza | `#6b7280` |
| Borda padrão | `#e5e7eb` |
| Borda forte | `#d1d5db` |
| Perigo | `#dc2626` |
| Header admin | `#111827` |

### Tipografia
- **Fonte:** Inter (substituir Playfair Display e DM Sans)
- H1: 30px bold
- H2: 24px semibold
- H3: 18px semibold
- Body: 14px regular
- Small: 12px medium

### Forma
- Border radius: `8px`
- Sombra card: `0 1px 3px rgba(0,0,0,0.08)`
- Sombra dropdown: `0 4px 12px rgba(0,0,0,0.12)`
- Max width: `1200px`

---

## Portal Público (`/[tenant]`)

### Header
- Fundo branco, borda-bottom `#e5e7eb`, altura 64px, sticky
- Nome do studio bold 18px à esquerda
- "Minha Conta" + ícone carrinho com badge à direita
- Mobile: só logo + carrinho

### Homepage do Tenant
- Banner full-width 280px com overlay escuro + nome centralizado
- Input de busca de eventos
- Grid 3 col (desktop) / 2 (tablet) / 1 (mobile) de event cards
- Card: foto 4:3, título bold, data, badge tipo (Evento/Ensaio)

### Página de Evento
- Breadcrumb "← Voltar"
- Título + data + contagem de fotos
- Card azul claro com busca facial (não modal)
- Grid de fotos quadradas 4 col / hover = overlay + botão carrinho
- Botão "Carregar mais" centralizado

### Carrinho
- Lista de fotos com thumb, evento, preço
- Subtotal + botão azul "Finalizar Compra"

### Checkout / Confirmação
- Formulário centrado max-width 520px
- Confirmação: check verde + número do pedido

---

## Dashboard do Fotógrafo (`/dashboard`)

### Layout
- Header branco horizontal com nav: Eventos | Financeiro | Clientes | Equipe | Configurações
- Link ativo: borda-bottom azul
- Dropdown usuário: Meu perfil | Ver meu site | Sair

### Home (KPIs)
- Saudação + data
- 4 cards KPI brancos: Eventos, Fotos, Receita do mês, Pedidos 7 dias
- Tabelas: Eventos Recentes + Pedidos Recentes

### Eventos
- Header com botão "+ Novo Evento"
- Filtros: busca + tipo + status
- Grid 3 col com capa, título, data, nº fotos, badge status, botão Gerenciar
- Detalhe do evento: abas Fotos | Configurações | Link público

### Upload
- Drop zone tracejada
- Grid de fotos enviadas

### Financeiro
- Tabela com filtros de data, exportar CSV

### Clientes
- Tabela: e-mail, pedidos, total, último pedido

### Configurações
- Scroll contínuo com âncoras: Perfil | Watermark | Domínio | Pacotes

---

## Admin (`/admin`)

### Layout
- Header **escuro** `#111827` com texto branco (diferencia da área do fotógrafo)
- Nav: Fotógrafos | Repasses | Configurações

### Home
- 3 KPIs: fotógrafos, eventos, receita total
- Tabela de fotógrafos: nome, slug, status, eventos, ação

### Detalhe do Fotógrafo
- Info: slug, status, toggle suspender
- KPIs: eventos, fotos, receita, repasse pendente
- Lista de eventos

### Repasses
- Tabela: fotógrafo, período, vendas, repasse, status
- Exportar CSV

### Configurações
- Comissão padrão, SMTP, integrações de pagamento

---

## O que Muda vs. Design Atual

| Antes | Depois |
|-------|--------|
| Playfair Display (serif) | Inter (sans-serif) |
| Fundo creme `#f5f4f0` | Branco `#ffffff` |
| Dourado `#c8a96e` | Azul `#2563eb` |
| Dark mode | Removido |
| Gradientes | Removidos |
| Border radius 14px | 8px |
| Sidebar (inexistente) | Nav horizontal |
