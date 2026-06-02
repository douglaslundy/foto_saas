# F1 — Auto-Cadastro do Fotógrafo com Aprovação do Super Admin

**Data:** 2026-06-02  
**Status:** Aprovado — pronto para implementação

---

## Visão Geral

Permite que fotógrafos gerentes se auto-cadastrem na plataforma diretamente pela homepage. O cadastro cria um tenant com `status='pending'` e fica aguardando aprovação do super admin. O fotógrafo pode fazer login mas vê uma página de bloqueio. Ao aprovar ou rejeitar, o sistema envia email ao fotógrafo com o resultado.

---

## Abordagem Arquitetural

Tenant + usuário criados imediatamente no ato do cadastro com `status='pending'`. O middleware intercepta logins de fotógrafos com tenant pendente ou rejeitado e redireciona para páginas de status. Na aprovação: `tenant.status = 'active'` → acesso liberado.

---

## Banco de Dados

### Alteração em `tenants`

A coluna `status` já existe. Adicionar dois novos valores válidos:

```sql
-- Adicionar ao CHECK constraint ou documentar os valores aceitos:
-- 'active'   → tenant ativo (existente)
-- 'inactive' → tenant desativado (existente)
-- 'pending'  → aguardando aprovação do super admin (NOVO)
-- 'rejected' → cadastro rejeitado (NOVO)
```

Migration: verificar se há CHECK constraint no status e adicionar os novos valores.

### Nova tabela `tenant_registrations`

Armazena dados extras do formulário de cadastro que não pertencem ao tenant padrão:

```sql
CREATE TABLE tenant_registrations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  cpf_cnpj    text NOT NULL,
  city        text NOT NULL,
  notes       text,           -- motivo de rejeição (preenchido pelo admin)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tenant_registrations_tenant_id_idx ON tenant_registrations(tenant_id);

ALTER TABLE tenant_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON tenant_registrations
  FOR ALL USING (auth.role() = 'service_role');
```

---

## Fluxo Completo

### Cadastro

1. Visitante acessa `/` → clica em **"Cadastre seu estúdio"**
2. Formulário em `/cadastro`:
   - **Dados pessoais:** Nome completo, Email, Senha (mín. 8 chars), Telefone, CPF/CNPJ
   - **Dados do estúdio:** Nome do estúdio, Cidade
3. Submit → backend (`POST /api/auth/register`):
   - Gera slug único do nome do estúdio (ex: "Studio Silva" → `studio-silva`, com sufixo numérico se conflito)
   - Cria auth user via `supabase.auth.admin.createUser` (email_confirm: true)
   - Cria tenant com `status='pending'`
   - Cria row em `users` com `role='photographer'`, `tenant_id`
   - Cria row em `tenant_registrations` com phone, cpf_cnpj, city
   - Envia email de notificação ao super admin (SUPER_ADMIN_EMAIL env var)
4. Redirect para `/conta-em-analise`

### Login de fotógrafo pendente

1. Fotógrafo faz login normalmente
2. Middleware verifica `tenant.status`:
   - `pending` → redirect `/conta-em-analise`
   - `rejected` → redirect `/conta-rejeitada`
   - `active` → acesso normal ao `/dashboard`

### Aprovação pelo super admin

1. Admin acessa `/admin/cadastros` → vê lista de pedidos pendentes
2. Clica **"Aprovar"** → `PATCH /api/admin/registrations/[id]/approve`:
   - Atualiza `tenant.status = 'active'`
   - Envia email ao fotógrafo: "Cadastro aprovado — acesse seu painel"
3. Fotógrafo recebe email, faz login → acesso completo ao dashboard

### Rejeição pelo super admin

1. Admin clica **"Rejeitar"** → modal com campo "Motivo (opcional)"
2. Confirma → `PATCH /api/admin/registrations/[id]/reject`:
   - Atualiza `tenant.status = 'rejected'`
   - Salva motivo em `tenant_registrations.notes`
   - Envia email ao fotógrafo com motivo (se preenchido)
3. Fotógrafo ao tentar logar vê `/conta-rejeitada` com o motivo

---

## APIs

### `POST /api/auth/register`

Rota pública. Cria o cadastro completo.

**Body:**
```ts
{
  name: string        // nome completo
  email: string
  password: string    // mín. 8 chars
  phone: string
  cpf_cnpj: string
  studio_name: string
  city: string
}
```

**Lógica:**
1. Validar todos os campos (obrigatórios, email formato, senha >= 8 chars)
2. Verificar email não existe em auth.users
3. Gerar slug único do studio_name
4. `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
5. Inserir tenant (`status='pending'`, `slug`, `name=studio_name`)
6. Inserir users row (`id=userId`, `tenant_id`, `role='photographer'`, `name`, `email`)
7. Inserir tenant_registrations (`tenant_id`, `phone`, `cpf_cnpj`, `city`)
8. `sendRegistrationNotification` ao super admin
9. Return `{ success: true }`

**Erros:**
- 400: campos faltando ou inválidos
- 409: email já cadastrado
- 500: erro interno

---

### `GET /api/admin/registrations`

Protegida (super_admin). Lista tenants com `status='pending'`, join com `tenant_registrations` e `users`.

**Resposta:**
```ts
{
  registrations: Array<{
    tenant_id: string
    studio_name: string
    slug: string
    created_at: string
    photographer: { name: string; email: string }
    registration: { phone: string; cpf_cnpj: string; city: string }
  }>
}
```

---

### `PATCH /api/admin/registrations/[tenantId]/approve`

Protegida (super_admin).

**Lógica:**
1. Verificar tenant existe e tem `status='pending'`
2. Atualizar `tenant.status = 'active'`
3. Buscar email/nome do fotógrafo
4. `sendRegistrationApproved` ao fotógrafo

---

### `PATCH /api/admin/registrations/[tenantId]/reject`

Protegida (super_admin).

**Body:** `{ notes?: string }`

**Lógica:**
1. Verificar tenant existe e tem `status='pending'`
2. Atualizar `tenant.status = 'rejected'`
3. Salvar `notes` em `tenant_registrations.notes`
4. `sendRegistrationRejected` ao fotógrafo com motivo

---

## Páginas Frontend

### Homepage (`/`) — mudança mínima

Adicionar botão **"Cadastre seu estúdio"** ao lado do botão "Entrar" já existente. Link para `/cadastro`.

### `/cadastro` — página pública

Formulário com dois blocos:

**Dados pessoais:** Nome completo, Email, Senha, Telefone, CPF/CNPJ  
**Dados do estúdio:** Nome do estúdio, Cidade

- Validação inline (client-side + server)
- Loading state no botão submit
- Erro geral exibido abaixo do formulário
- Sucesso: redirect para `/conta-em-analise`
- Link "Já tenho conta → Entrar"

### `/conta-em-analise` — página pública

Exibida automaticamente para fotógrafos logados com tenant `pending`. Conteúdo:
- "Seu cadastro está em análise."
- "Você receberá um email quando for aprovado."
- Botão "Sair" (signOut → redirect para `/`)

### `/conta-rejeitada` — página pública

Exibida para fotógrafos com tenant `rejected`. Conteúdo:
- "Seu cadastro não foi aprovado."
- Motivo da rejeição (se preenchido, buscado da API)
- Botão "Sair"

### `/admin/cadastros` — painel do super admin

Lista de pedidos pendentes em tabela:
- Colunas: Estúdio, Fotógrafo, Email, Cidade, CPF/CNPJ, Telefone, Data
- Ações por linha: botão **Aprovar** (verde) + botão **Rejeitar** (vermelho)
- Rejeitar abre modal com textarea "Motivo (opcional)" + botão confirmar
- Badge numérico no menu lateral admin quando há pendências

---

## Middleware — Mudanças

Arquivo: `src/middleware.ts`

Adicionar verificação após autenticação para rotas `/dashboard`:

```typescript
// Se fotógrafo logado mas tenant não está ativo
if (routeType === 'dashboard' && user) {
  // Buscar status do tenant (via cookie ou header — detalhe de implementação)
  // Se pending → redirect /conta-em-analise
  // Se rejected → redirect /conta-rejeitada
}
```

**Importante:** A verificação de status no middleware deve ser leve (sem query extra se possível). Abordagem: ao fazer login, o status do tenant é incluído no JWT claims ou verificado uma vez na página de dashboard com redirect server-side. A implementação mais simples é verificar no layout do dashboard (server component) em vez do middleware — evita query extra no middleware para cada request.

**Decisão de implementação:** verificar `tenant.status` no layout do dashboard (`src/app/(dashboard)/layout.tsx`) em vez do middleware. Isso é mais simples e o padrão já é fazer queries no layout server component.

**Escopo do bloqueio:** aplica-se apenas a usuários com `role='photographer'` cujo tenant tem status `pending` ou `rejected`. Admins e sub-fotógrafos de tenants ativos não são afetados.

---

## Emails

### `sendRegistrationNotification` — para o super admin

- **Para:** `process.env.SUPER_ADMIN_EMAIL`
- **Assunto:** `Novo pedido de cadastro — [Nome do estúdio]`
- **Corpo:** Nome, email, estúdio, cidade, CPF/CNPJ, telefone. Link para `/admin/cadastros`.

### `sendRegistrationApproved` — para o fotógrafo

- **Assunto:** `Seu cadastro foi aprovado — [Nome da plataforma]`
- **Corpo:** Parabéns, link para fazer login no painel: `[SITE_URL]/login`

### `sendRegistrationRejected` — para o fotógrafo

- **Assunto:** `Atualização sobre seu cadastro — [Nome da plataforma]`
- **Corpo:** Infelizmente não foi possível aprovar. Motivo: `[notes]` (se preenchido).

---

## Variável de Ambiente

```
SUPER_ADMIN_EMAIL=email@do.admin.com
```

---

## Segurança

- `POST /api/auth/register` é pública mas com validação de todos os campos
- Rate limiting não implementado neste MVP (pode ser adicionado via Nginx/middleware depois)
- Slug gerado server-side (não vem do cliente)
- Senha enviada diretamente ao Supabase auth — não armazenada em texto plano
- Tenants `pending` e `rejected` não têm acesso ao dashboard (verificado no layout)
