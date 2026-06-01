# FotoSaaS — Backlog de Desenvolvimento

> Gerado em 2026-05-30 após auditoria completa do projeto.
> Planos 5–9 foram implementados (~85%). Este documento registra o que falta.

---

## Como usar este documento

- **Status**: `[ ]` pendente · `[x]` concluído · `[-]` cancelado/descartado
- **Prioridade**: 🔴 Crítico · 🟡 Importante · 🟠 Médio · 🟢 Baixo
- Ao iniciar um item, crie um plano detalhado em `docs/superpowers/plans/` seguindo o padrão dos planos 5–9.

---

## 🔴 CRÍTICO — Quebrado ou bloqueia uso em produção

### BUG-01 · Endpoint de busca por número de dorsal (BIB) não existe
- **Problema**: `face-search-island.tsx:49` faz `fetch('/api/events/${eventId}/search-bib')` mas a rota não existe → erro 404
- **Solução**: Criar `src/app/api/events/[id]/search-bib/route.ts`
  - POST com body `{ bib_number: string }`
  - Query: `SELECT id FROM photos WHERE event_id = $1 AND bib_number = $2 AND status = 'ready'`
  - Retorna `{ photo_ids: string[], count: number }`
- [x] Criar rota API
- [ ] Testar no portal público de evento com BIB habilitado

### BUG-02 · Download entrega foto original sem watermark
- **Problema**: `src/lib/delivery.ts` usa bucket `photos-original` (foto bruta sem marca d'água). Cliente compra e baixa foto sem proteção.
- **Solução**: Alterar `delivery.ts` para usar bucket `photos-public` (fotos já processadas pelo worker com watermark)
  - Se `public_storage_path` existir na foto → gerar signed URL de `photos-public`
  - Fallback para `photos-original` apenas se watermark não processado ainda
- [x] Atualizar `src/lib/delivery.ts`
- [x] Atualizar `src/app/api/orders/[id]/download/route.ts` (não necessário — já usa generateDownloadUrls)

### BUG-03 · Tabela `watermark_configs` não existe no banco
- **Problema**: `workers/watermark.ts:20` faz query em `watermark_configs` mas a tabela não está em `00-schema.sql` → worker falha silenciosamente ao processar fotos
- **Solução**: Criar a tabela e a UI de configuração (ver FEAT-01 abaixo)
- [x] Adicionar tabela ao schema (migration `docker/db/02-watermark-config.sql` aplicada na VPS)

---

## 🟡 IMPORTANTE — Features prometidas não implementadas

### FEAT-01 · Configuração de marca d'água (Watermark) por tenant
- **Contexto**: `workers/watermark.ts` já lê `watermark_configs` mas a tabela e a UI não existem
- **Escopo**:
  - Tabela `watermark_configs` (tenant_id, type: text|image, text_content, font, font_size, color, opacity, position, image_storage_path, image_size_percent)
  - Migration SQL
  - Página `/dashboard/configuracoes/watermark` com formulário
  - Upload de imagem de watermark para storage
  - Preview em tempo real (opcional MVP)
- [x] Criar migration `docker/db/02-watermark-config.sql` — aplicada na VPS
- [x] Criar `src/app/(dashboard)/dashboard/configuracoes/watermark/page.tsx`
- [x] Criar `src/app/api/watermark-config/route.ts` (GET + PUT)
- [x] Adicionar link "Marca d'água" ao nav de configurações
- [x] Corrigir BUG-03 aplicando a migration na VPS

### FEAT-02 · Configurações do Tenant (perfil, logo, domínio)
- **Contexto**: Fotógrafo não tem como configurar nome do estúdio, logo, domínio customizado, etc.
- **Escopo**:
  - Adicionar colunas em `tenants`: `logo_storage_path`, `primary_color`, `bio`
  - Página `/dashboard/configuracoes/perfil-studio` 
  - Upload de logo
  - Configurar domínio customizado (informativo + instrução DNS)
- [x] Migration: adicionar colunas em `tenants` (`docker/db/03-tenant-profile.sql`) — aplicada na VPS
- [x] Criar página de configurações do studio (`/dashboard/configuracoes/perfil-studio`)
- [x] Criar API `PATCH /api/tenant/profile`
- [ ] Exibir logo do tenant no portal público (tenant layout)

### FEAT-03 · Lista de fotos na página de gerenciamento do evento
- **Contexto**: `/dashboard/eventos/[id]/fotos` mostra apenas o uploader, sem galeria das fotos já enviadas
- **Escopo**:
  - Grid de fotos com status (processing/ready/error)
  - Contagem total, breakdown por status
  - Botão para deletar foto individual
  - Indicação de progresso do worker
- [x] Buscar fotos do evento na page — já implementado
- [x] Criar `PhotoGrid` no contexto do dashboard — já implementado (`src/components/photos/photo-grid.tsx`)
- [x] API `DELETE /api/photos/[photoId]` — já implementado

### FEAT-04 · Confirmação de pagamento em tempo real
- **Contexto**: Após pagar, cliente precisa recarregar `/[tenant]/pedido/[id]` manualmente para ver downloads disponíveis
- **Solução mínima**: Polling a cada 3s por até 2 minutos até status='paid'
- **Solução ideal**: SSE (Server-Sent Events) ou WebSocket
- [x] Criar client component com polling em `/[tenant]/pedido/[id]/_components/order-status.tsx`
- [x] Mostrar spinner "Aguardando confirmação do pagamento..." enquanto status=pending
- [x] Atualizar UI automaticamente quando status mudar para paid

### FEAT-05 · Dashboard home com métricas reais
- **Contexto**: `/dashboard` mostra apenas cards de navegação (substituiu placeholder)
- **Escopo**: Quick stats no topo antes dos cards
  - Total de eventos publicados
  - Total de fotos processadas
  - Receita do mês atual
  - Pedidos dos últimos 7 dias
- [x] Buscar stats na page server-side
- [x] Mostrar KPI cards antes dos links de navegação

---

## 🟠 MÉDIO — Dashboard/Admin melhorias

### FEAT-06 · Filtros na lista de eventos
- [x] Filtrar por status: draft / published / todos
- [x] Filtrar por tipo: evento / ensaio / todos
- [x] Busca por título

### FEAT-07 · Filtro de período no Financeiro
- [x] Seletor de período: últimos 30 dias / 3 meses / 6 meses / este ano / tudo
- [x] Gráfico atualiza conforme período selecionado

### FEAT-08 · Paginação em tabelas do admin
- [x] Paginação na lista de tenants (admin) — `tenants-table.tsx`
- [x] Paginação na lista de clientes/pedidos (dashboard) — `clientes-table.tsx`

### FEAT-09 · Download em ZIP
- **Solução**: ZIP construído manualmente com `zlib.deflateRawSync` (sem dependências extras)
- [x] Endpoint `GET /api/orders/[id]/download-zip`
- [x] UI no pedido: botão "Baixar todas (.zip)"

### FEAT-10 · Admin: criar outro administrador
- [x] Adicionar opção de role "admin" no formulário de criação de usuário
- [x] Proteger para que só admins possam criar outros admins

### FEAT-11 · Admin: excluir tenant
- [x] Botão "Excluir tenant" com confirmação dupla (`delete-tenant-button.tsx`)
- [x] API `DELETE /api/admin/tenants/[id]` com cascade

### FEAT-12 · Portal público: verificar status do tenant
- [x] Verificação já implementada em `[tenant]/layout.tsx` — `if (!tenant || tenant.status !== 'active') notFound()`

---

## 🟢 BAIXO — Polimento e UX

### FEAT-13 · Slideshow: controles de teclado
- [x] ← / → para navegação
- [x] Espaço para play/pause
- [x] Escape para fechar

### FEAT-14 · SEO do portal público
- [x] `src/app/[tenant]/sitemap.ts` — gerar sitemap por tenant
- [x] `src/app/robots.ts` — robots.txt
- [x] og:image nas páginas de evento (primeira foto do evento)

### FEAT-15 · Paginação no portal público
- [x] Botão "Carregar mais" já implementado e funcional

### FEAT-16 · Email: personalização por tenant
- [x] Nome do estúdio no assunto/corpo do email — `email.ts` + webhooks stripe/mercadopago atualizados

### FEAT-17 · Retry de email com BullMQ
- [x] Criar fila `src/lib/queues/email-queue.ts`
- [x] Worker `workers/email.ts` com 3 tentativas + backoff exponencial 10s — container `fotosaas-email-worker` rodando na VPS
- [x] Webhooks stripe e mercadopago enfileiram via `emailQueue.add()` em vez de enviar diretamente

### FEAT-18 · Fotos: indicar quando worker falhou
- [x] Foto com `status='error'` aparece com overlay vermelho no dashboard
- [x] Botão "Reprocessar" (↻) re-enfileira no watermark worker via `/api/photos/[id]/reprocess`

---

## 📋 Configurações pendentes (não são código, são dados/env)

| Item | O que fazer |
|------|------------|
| **Stripe** | Substituir `pk_test_placeholder` / `sk_test_placeholder` por chaves reais em `/opt/fotosaas/.env` |
| **MercadoPago** | Substituir `TEST-fotosaas-mercadopago-token-2024` por token real |
| **SMTP** | Configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Resend, SendGrid, ou SMTP próprio) |
| **Domínio** | Configurar domínio real + HTTPS via Traefik (já instalado no VPS) |
| **Senha SSH** | Trocar `CH@7NZPqJtC@a5nP` (exposta nesta sessão) |
| **Senhas Supabase** | Trocar `fotosaas_dev_pass_2024` nas roles do banco (supabase_auth_admin, authenticator, etc.) |

---

## 📊 Progresso geral

| Plano | Título | % Completo |
|-------|--------|-----------|
| Plan 5 | E-commerce (Cart, Checkout, Payments, Delivery) | 90% |
| Plan 6 | Dashboard do Fotógrafo | 88% |
| Plan 7 | Admin SaaS Panel | 85% |
| Plan 8 | Notificações por Email | 88% |
| Plan 9 | Features Adicionais (QR, Slideshow, LGPD) | 82% |
| **Backlog** | **Items deste documento** | **0%** |

**Total do projeto: ~87% do escopo original + backlog identificado**

---

## 🗂 Referências

- Planos detalhados: `docs/superpowers/plans/2026-05-27-plan-*.md`
- Schema do banco: `docker/db/00-init.sql`, `docker/db/00-schema.sql`
- Workers: `workers/watermark.ts`, `face-service/`
- Deploy: `docker-compose.prod.yml`, VPS `root@2.25.150.248` em `/opt/fotosaas`
