# F2 — Whitelabeling: Nome da Plataforma e Favicon por Nível

**Data:** 2026-06-02  
**Status:** Aprovado — pronto para implementação

---

## Visão Geral

Permite que o super admin configure o nome global da plataforma (substituindo "FotoSaaS" em todos os headers) e um favicon global. Cada tenant pode configurar seu próprio favicon para o portal público. Se o tenant não configurar favicon, usa o favicon global como fallback; se o global também não estiver configurado, usa o ícone SVG padrão.

---

## Abordagem

Estender a tabela `system_settings` existente com duas novas chaves: `platform_name` e `platform_favicon_url`. Adicionar coluna `favicon_url` na tabela `tenants`. Uma função helper `getPlatformConfig()` centraliza a busca das configurações globais. Favicon servido via Next.js metadata API (`generateMetadata`).

---

## Banco de Dados

### Novas chaves em `system_settings`

| Chave | Valor padrão | Descrição |
|-------|-------------|-----------|
| `platform_name` | vazio (exibe "FotoSaaS") | Nome global da plataforma |
| `platform_favicon_url` | vazio (usa ícone padrão) | URL do favicon global |

Nenhuma migration necessária — `system_settings` aceita qualquer chave/valor.

### Nova coluna em `tenants`

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS favicon_url text;
```

Nullable — se null, o portal do tenant usa o favicon global como fallback.

### Storage

Novo bucket `platform-assets` (público):
- Favicon global: `platform-assets/favicon/global.[ext]`
- Favicon de tenant: `platform-assets/favicon/[tenantId].[ext]`

Tipos aceitos: `image/png`, `image/x-icon`, `image/svg+xml`, `image/jpeg`. Tamanho máximo: 512 KB.

---

## Helper: `getPlatformConfig()`

```typescript
// src/lib/platform-config.ts
export async function getPlatformConfig(): Promise<{
  platformName: string
  faviconUrl: string | null
}> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('system_settings')
    .select('key, value')
    .in('key', ['platform_name', 'platform_favicon_url'])

  const map: Record<string, string> = {}
  for (const row of rows ?? []) {
    map[row.key] = row.value ?? ''
  }

  return {
    platformName: map['platform_name']?.trim() || 'FotoSaaS',
    faviconUrl: map['platform_favicon_url'] || null,
  }
}
```

---

## APIs

### `POST /api/admin/platform/favicon`

Upload de favicon global. Protegida (role='admin'). Recebe `multipart/form-data` com campo `file`.

**Lógica:**
1. Verificar auth + role='admin'
2. Verificar tipo de arquivo e tamanho (≤ 512 KB)
3. Upload para `platform-assets/favicon/global.[ext]` via Supabase Storage
4. Salvar URL pública em `system_settings.platform_favicon_url`
5. Retornar `{ url: string }`

### `POST /api/tenant/favicon`

Upload de favicon do tenant. Protegida (role='photographer' ou 'admin' do tenant).

**Lógica:**
1. Verificar auth + tenant_id
2. Verificar tipo e tamanho
3. Upload para `platform-assets/favicon/[tenantId].[ext]`
4. Atualizar `tenants.favicon_url`
5. Retornar `{ url: string }`

### API existente: settings do admin

O `AdminSettingsForm` já usa a API existente de system_settings. Apenas adicionar os campos `platform_name` e `platform_favicon_url` ao payload de save.

### API existente: perfil do tenant

`PATCH /api/tenant/profile` já existe e salva campos do tenant. Adicionar `favicon_url` ao payload aceito.

---

## Frontend — Admin (`/admin/configuracoes`)

Adicionar seção **"Identidade da Plataforma"** ao `AdminSettingsForm` existente, antes das seções de pagamento:

**Campo: Nome da plataforma**
- Input de texto com placeholder "FotoSaaS"
- Salvo como `platform_name` via a API de settings existente

**Campo: Favicon global**
- Preview do favicon atual (imagem 32×32 ou ícone padrão)
- Duas opções alternativas:
  - **Upload de arquivo**: `<input type="file" accept=".png,.ico,.svg,.jpg">` → chama `POST /api/admin/platform/favicon`
  - **URL externa**: input de texto → salvo diretamente em `platform_favicon_url` via API de settings
- Loading state durante upload
- Mensagem de sucesso/erro inline

---

## Frontend — Tenant (`/dashboard/configuracoes/perfil-studio`)

Adicionar campo **"Favicon do portal"** ao formulário `PerfilStudioForm` existente:

- Preview do favicon atual do tenant (ou fallback para favicon global)
- Duas opções alternativas:
  - **Upload de arquivo**: chama `POST /api/tenant/favicon`
  - **URL externa**: campo de texto → salvo em `favicon_url` via `PATCH /api/tenant/profile`

---

## Aplicação do nome e favicon

### Onde `platform_name` substitui "FotoSaaS"

Todos são server components — chamam `getPlatformConfig()` no render:

| Arquivo | Elemento |
|---------|----------|
| `src/app/page.tsx` | Logo + título no branding e header mobile |
| `src/app/(auth)/login/page.tsx` | Logo no header |
| `src/app/(admin)/admin/layout.tsx` | Nome no header nav |
| `src/app/cadastro/page.tsx` | Logo no header |

### Favicon via `generateMetadata`

Cada layout relevante exporta `generateMetadata` que chama `getPlatformConfig()`:

```typescript
// Nos layouts: admin layout, root layout, cadastro page
export async function generateMetadata() {
  const config = await getPlatformConfig()
  return {
    title: config.platformName,
    icons: config.faviconUrl ? { icon: config.faviconUrl } : undefined
  }
}
```

**Portal do tenant** (`src/app/[tenant]/layout.tsx`):
```typescript
export async function generateMetadata({ params }) {
  const { tenant: tenantSlug } = await params
  // Busca favicon do tenant; fallback para favicon global
  const tenantFavicon = await getTenantFavicon(tenantSlug) // queries tenants.favicon_url
  const globalConfig = await getPlatformConfig()
  return {
    icons: (tenantFavicon ?? globalConfig.faviconUrl) ? { icon: tenantFavicon ?? globalConfig.faviconUrl! } : undefined
  }
}
```

---

## Favicon padrão

Quando nenhum favicon está configurado, `generateMetadata` retorna `icons: undefined` — o Next.js usa automaticamente o arquivo `src/app/favicon.ico` (ou `public/favicon.ico`) já existente no projeto como fallback.

## Helper: `getTenantFavicon(tenantSlug)`

```typescript
// src/lib/platform-config.ts (mesmo arquivo de getPlatformConfig)
export async function getTenantFavicon(tenantSlug: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await (admin as any)
    .from('tenants')
    .select('favicon_url')
    .eq('slug', tenantSlug)
    .single() as { data: { favicon_url: string | null } | null }
  return data?.favicon_url ?? null
}
```

---

## Segurança

- Upload de arquivo: verificar MIME type e tamanho server-side (não confiar no client)
- Bucket `platform-assets`: público para leitura, escrita apenas via `service_role`
- URL externa: aceita qualquer URL HTTPS — não há necessidade de sanitização extra para favicons (são apenas URLs em `<link>`)

---

## Sem impacto nos portais dos tenants

O nome do estúdio (`tenant.name`) já é exibido nos portais públicos (`/[tenant]/...`). Não é necessário nenhuma mudança para essa funcionalidade — ela já existe e funciona.
