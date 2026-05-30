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
- [ ] Criar rota API
- [ ] Testar no portal público de evento com BIB habilitado

### BUG-02 · Download entrega foto original sem watermark
- **Problema**: `src/lib/delivery.ts` usa bucket `photos-original` (foto bruta sem marca d'água). Cliente compra e baixa foto sem proteção.
- **Solução**: Alterar `delivery.ts` para usar bucket `photos-public` (fotos já processadas pelo worker com watermark)
  - Se `public_storage_path` existir na foto → gerar signed URL de `photos-public`
  - Fallback para `photos-original` apenas se watermark não processado ainda
- [ ] Atualizar `src/lib/delivery.ts`
- [ ] Atualizar `src/app/api/orders/[id]/download/route.ts`

### BUG-03 · Tabela `watermark_configs` não existe no banco
- **Problema**: `workers/watermark.ts:20` faz query em `watermark_configs` mas a tabela não está em `00-schema.sql` → worker falha silenciosamente ao processar fotos
- **Solução**: Criar a tabela e a UI de configuração (ver FEAT-01 abaixo)
- [ ] Adicionar tabela ao schema (ver FEAT-01)

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
- [ ] Criar migration `docker/db/02-watermark-config.sql`
  ```sql
  CREATE TABLE IF NOT EXISTS public.watermark_configs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    type          TEXT        NOT NULL DEFAULT 'text', -- 'text' | 'image'
    text_content  TEXT,
    font          TEXT        NOT NULL DEFAULT 'sans-serif',
    font_size     INTEGER     NOT NULL DEFAULT 24,
    color         TEXT        NOT NULL DEFAULT '#ffffff',
    opacity       REAL        NOT NULL DEFAULT 0.6,
    position      TEXT        NOT NULL DEFAULT 'bottom-right',
    image_storage_path TEXT,
    image_size_percent INTEGER NOT NULL DEFAULT 20,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- [ ] Criar `src/app/(dashboard)/dashboard/configuracoes/watermark/page.tsx`
- [ ] Criar `src/app/api/watermark-config/route.ts` (GET + PUT)
- [ ] Adicionar link "Marca d'água" ao nav de configurações
- [ ] Corrigir BUG-03 aplicando a migration na VPS

### FEAT-02 · Configurações do Tenant (perfil, logo, domínio)
- **Contexto**: Fotógrafo não tem como configurar nome do estúdio, logo, domínio customizado, etc.
- **Escopo**:
  - Adicionar colunas em `tenants`: `logo_storage_path`, `primary_color`, `bio`
  - Página `/dashboard/configuracoes/perfil-studio` 
  - Upload de logo
  - Configurar domínio customizado (informativo + instrução DNS)
- [ ] Migration: adicionar colunas em `tenants`
- [ ] Criar página de configurações do studio
- [ ] Criar API `PATCH /api/tenant/profile`
- [ ] Exibir logo do tenant no portal público (tenant layout)

### FEAT-03 · Lista de fotos na página de gerenciamento do evento
- **Contexto**: `/dashboard/eventos/[id]/fotos` mostra apenas o uploader, sem galeria das fotos já enviadas
- **Escopo**:
  - Grid de fotos com status (processing/ready/error)
  - Contagem total, breakdown por status
  - Botão para deletar foto individual
  - Indicação de progresso do worker
- [ ] Buscar fotos do evento na page (`SELECT id, public_storage_path, status FROM photos WHERE event_id = $1`)
- [ ] Criar `PhotoGrid` no contexto do dashboard (diferente do portal público)
- [ ] API `DELETE /api/events/[id]/photos/[photoId]`

### FEAT-04 · Confirmação de pagamento em tempo real
- **Contexto**: Após pagar, cliente precisa recarregar `/[tenant]/pedido/[id]` manualmente para ver downloads disponíveis
- **Solução mínima**: Polling a cada 3s por até 2 minutos até status='paid'
- **Solução ideal**: SSE (Server-Sent Events) ou WebSocket
- [ ] Criar client component com polling em `/[tenant]/pedido/[id]/page.tsx`
- [ ] Mostrar spinner "Aguardando confirmação do pagamento..." enquanto status=pending
- [ ] Atualizar UI automaticamente quando status mudar para paid

### FEAT-05 · Dashboard home com métricas reais
- **Contexto**: `/dashboard` mostra apenas cards de navegação (substituiu placeholder)
- **Escopo**: Quick stats no topo antes dos cards
  - Total de eventos publicados
  - Total de fotos processadas
  - Receita do mês atual
  - Pedidos dos últimos 7 dias
- [ ] Buscar stats na page server-side
- [ ] Mostrar KPI cards antes dos links de navegação

---

## 🟠 MÉDIO — Dashboard/Admin melhorias

### FEAT-06 · Filtros na lista de eventos
- [ ] Filtrar por status: draft / published / todos
- [ ] Filtrar por tipo: evento / ensaio / todos
- [ ] Busca por título

### FEAT-07 · Filtro de período no Financeiro
- [ ] Seletor de período: últimos 30 dias / 3 meses / 6 meses / personalizado
- [ ] Gráfico atualiza conforme período selecionado

### FEAT-08 · Paginação em tabelas do admin
- [ ] Paginação na lista de tenants (admin)
- [ ] Paginação na lista de clientes/pedidos (dashboard)

### FEAT-09 · Download em ZIP
- **Contexto**: Cliente baixa foto por foto via signed URL
- **Solução**: BullMQ job que gera ZIP, armazena temporariamente e envia link
- [ ] Criar `src/lib/queues/zip-queue.ts`
- [ ] Worker que agrupa fotos de um pedido em ZIP
- [ ] Endpoint `GET /api/orders/[id]/download-zip`
- [ ] UI no pedido: botão "Baixar todas (.zip)"

### FEAT-10 · Admin: criar outro administrador
- **Contexto**: Só é possível criar fotógrafos pelo admin. Para criar outro admin é necessário SQL manual.
- [ ] Adicionar opção de role "admin" no formulário de criação de usuário
- [ ] Proteger para que só admins possam criar outros admins

### FEAT-11 · Admin: excluir tenant
- **Contexto**: Admin só pode suspender. Não há opção de exclusão total.
- [ ] Botão "Excluir tenant" com confirmação dupla
- [ ] API `DELETE /api/admin/tenants/[id]` com cascade

### FEAT-12 · Portal público: verificar status do tenant
- **Contexto**: Eventos de tenant suspenso ainda ficam acessíveis publicamente
- [ ] Adicionar verificação em `[tenant]/layout.tsx`: se `tenant.status !== 'active'` → notFound()
- [ ] (Já está implementado: `if (!tenant || tenant.status !== 'active') notFound()` — verificar se suspension propaga)

---

## 🟢 BAIXO — Polimento e UX

### FEAT-13 · Slideshow: controles de teclado
- [ ] ← / → para navegação
- [ ] Espaço para play/pause
- [ ] Escape para fechar

### FEAT-14 · SEO do portal público
- [ ] `src/app/[tenant]/sitemap.ts` — gerar sitemap por tenant
- [ ] `src/app/robots.ts` — robots.txt
- [ ] og:image nas páginas de evento (primeira foto do evento)

### FEAT-15 · Paginação no portal público
- **Contexto**: Grade de fotos do evento carrega primeiros 48 fixos
- `src/app/[tenant]/evento/[slug]/_components/photo-grid.tsx` tem `loadMore` mas verificar se funciona
- [ ] Botão "Carregar mais" funcional

### FEAT-16 · Email: personalização por tenant
- [ ] Template de email com nome do estúdio, logo, cores (usar dados de FEAT-02)
- [ ] Pelo menos o nome do estúdio no assunto/corpo do email

### FEAT-17 · Retry de email com BullMQ
- [ ] Criar fila `email-queue` no BullMQ
- [ ] Worker com retry automático (3 tentativas, backoff exponencial)
- [ ] Substituir envio direto nos webhooks por enfileiramento

### FEAT-18 · Fotos: indicar quando worker falhou
- [ ] Foto com `status='error'` deve aparecer na página de fotos do dashboard
- [ ] Botão "Reprocessar" para re-enfileirar no watermark worker

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
