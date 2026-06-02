# F4 — Envio de Ensaio para Cliente Externo (Essay Client Review)

**Data:** 2026-06-02  
**Status:** Aprovado — pronto para implementação

---

## Visão Geral

Permite que o fotógrafo envie um ensaio (photo session) para o cliente que o contratou, mesmo que esse cliente não tenha conta no sistema. O cliente recebe um magic link por email, é autenticado automaticamente, seleciona as fotos desejadas, e opcionalmente realiza o pagamento. O fotógrafo recebe notificação por email e no dashboard.

---

## Fluxo Completo

1. Fotógrafo acessa a página do ensaio no dashboard → clica em **"Enviar para cliente"**
2. Modal abre com campo de busca por nome ou email
3. Se cliente não existir: formulário expande com campos nome, email, CPF → conta criada com senha `123456`
4. Fotógrafo confirma → backend:
   - Cria registro em `essay_reviews` com `status = pending_selection`
   - Gera magic link via `supabase.auth.admin.generateLink` com expiração de 72h
   - Envia email ao cliente via BullMQ
5. Cliente clica no link → logado automaticamente → página de seleção do ensaio
6. Cliente marca fotos, adiciona observação opcional, confirma envio
7. Sistema oferece **pagar agora** (Stripe / PIX) ou **"pagarei depois"**
8. Status atualiza para `submitted` → fotógrafo recebe email + notificação no dashboard

---

## Banco de Dados

### Nova tabela: `essay_reviews`

```sql
CREATE TABLE essay_reviews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id              uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  client_id             uuid NOT NULL REFERENCES users(id),
  status                text NOT NULL DEFAULT 'pending_selection'
                          CHECK (status IN ('pending_selection', 'submitted', 'in_progress', 'delivered')),
  selected_photo_ids    uuid[] DEFAULT '{}',
  notes                 text,
  payment_status        text NOT NULL DEFAULT 'pending'
                          CHECK (payment_status IN ('pending', 'paid', 'manual')),
  payment_intent_id     text,
  sent_at               timestamptz NOT NULL DEFAULT now(),
  submitted_at          timestamptz,
  magic_link_expires_at timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);
```

### RLS

- SELECT/UPDATE: `client_id = auth.uid()` (cliente acessa seu próprio review)
- INSERT/DELETE: apenas `service_role` (somente o backend cria e remove)
- Fotógrafo acessa via `service_role` através das APIs do dashboard

### Justificativa de design

O vínculo cliente↔ensaio fica em `essay_reviews`, não no evento. Isso permite reenviar um novo link se o anterior expirar (nova row, novo magic link) sem alterar o evento.

---

## APIs

### `POST /api/essay-reviews`

Fotógrafo inicia o envio do ensaio.

**Body:**
```ts
{
  event_id: string
  // cliente existente:
  client_id?: string
  // OU novo cliente:
  client?: { name: string; email: string; cpf: string }
}
```

**Lógica:**
1. Se `client` fornecido: cria usuário via `supabase.auth.admin.createUser` + insere em `users`/`clients`
2. Cria row em `essay_reviews` com `magic_link_expires_at = now() + 72h`
3. Chama `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: '/[tenant]/ensaio-review/[id]', expiresIn: 259200 } })`
4. Envia email com o link via BullMQ (worker de email existente)

**Resposta:** `{ review_id: string }`

---

### `GET /api/essay-reviews/[id]`

Retorna dados do review. Usado pelo fotógrafo (dashboard) e pelo cliente (página de seleção).

**Resposta:**
```ts
{
  id, event_id, client_id, status,
  event: { name, slug, photos: Photo[] },
  client: { name, email },
  selected_photo_ids, notes, payment_status,
  sent_at, submitted_at, magic_link_expires_at
}
```

---

### `POST /api/essay-reviews/[id]/submit`

Cliente envia a seleção de fotos.

**Body:**
```ts
{
  selected_photo_ids: string[]
  notes?: string
  payment_method?: 'stripe' | 'pix' | 'manual'
}
```

**Lógica:**
1. Valida `session.user.id === review.client_id`
2. Atualiza `selected_photo_ids`, `notes`, `submitted_at`, `status = submitted`
3. Se `payment_method !== 'manual'`: cria payment intent via Stripe ou MercadoPago existentes, salva `payment_intent_id`
4. Dispara email para o fotógrafo via BullMQ
5. Cria notificação no dashboard (via polling)

---

### `POST /api/essay-reviews/[id]/resend`

Reenvio de link expirado. Apenas o fotógrafo do tenant pode chamar.

**Lógica:** Gera novo magic link, atualiza `magic_link_expires_at = now() + 72h`, reenvia email.

---

## Frontend

### Dashboard — Página do ensaio (`/dashboard/eventos/[id]/fotos`)

- Novo botão **"Enviar para cliente"** no header
- Modal:
  - Campo de busca (nome/email) com autocomplete contra `/api/clients`
  - Se não encontrar: formulário inline expande com campos nome, email, CPF
  - Botão "Enviar link" com loading state e confirmação
- Badge de status no header do ensaio: `Aguardando seleção` | `Seleção recebida` | `Em tratamento` | `Entregue`
- Botão **"Reenviar link"** visível quando `status = pending_selection` e `magic_link_expires_at < now()`

### Dashboard — Lista de ensaios

- Badge numérico em "Ensaios" no menu lateral quando há reviews com `status = submitted`
- Coluna de status na tabela, linha destacada para reviews novos

### Página pública — `/[tenant]/ensaio-review/[reviewId]`

Rota nova. Server component valida `session.user.id === review.client_id` — retorna 404 caso contrário.

**Conteúdo:**
- Header: logo do tenant + nome do ensaio
- Grid de fotos (reutiliza `PhotoGrid` existente) com checkbox de seleção em cada foto
- Contador fixo no rodapé: `X fotos selecionadas`
- Campo de texto opcional: "Observações para o fotógrafo"
- Botão **"Confirmar seleção"**

### Tela de pagamento/confirmação

- Resumo: número de fotos selecionadas + valor (baseado no pacote configurado no ensaio)
- Opção **Pagar agora**: exibe Stripe cartão e/ou PIX MercadoPago conforme configuração do tenant
- Opção **"Pagarei depois"**: confirma envio sem pagamento (`payment_status = manual`)
- Após confirmação: tela de sucesso — "Sua seleção foi enviada! O fotógrafo entrará em contato."

### Estados de erro

| Situação | Comportamento |
|----------|---------------|
| Link expirado (>72h) | Página explicativa: "Solicite um novo link ao fotógrafo" |
| Review já submetido | Página informativa: "Você já enviou sua seleção" |
| Usuário sem permissão no review | 404 |

---

## Auth — Magic Link

- Abordagem: **Supabase `generateLink` nativo** (Approach A)
- O magic link redireciona para `/auth/callback?next=/[tenant]/ensaio-review/[reviewId]`
- O callback `/auth/callback` já existe no projeto — apenas garantir parâmetro `next` correto
- O token Supabase é de uso único: após o primeiro clique é invalidado automaticamente
- Conta criada com senha `123456` — fraca por design para acesso simples, mitigada pelo magic link como método primário. Cliente pode trocar em `/[tenant]/minha-conta`

---

## Notificações

### Email para o cliente (disparado no envio)

- **Assunto:** `[Nome do estúdio] — Selecione suas fotos`
- **Corpo:** nome do ensaio, prazo de 72h, botão com magic link

### Email para o fotógrafo (disparado no submit do cliente)

- **Assunto:** `[Nome do cliente] selecionou as fotos do ensaio [Nome]`
- **Corpo:** número de fotos selecionadas, link para o dashboard

### Notificação no dashboard

- Polling a cada 30s na página `/dashboard/ensaios` (padrão já usado em `/pedido/[id]`)
- Badge numérico some após o fotógrafo abrir o review

---

## Segurança

- RLS garante que cliente só acessa seu próprio review
- HTTPS obrigatório (Traefik disponível na VPS)
- Magic link de uso único com expiração de 72h
- Reenvio de link disponível apenas para o fotógrafo owner do tenant
- Conta com senha fraca mitigada: acesso real ao ensaio é via magic link, não senha direta
