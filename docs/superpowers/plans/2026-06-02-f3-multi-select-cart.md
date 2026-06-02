# F3 — Seleção Múltipla por Ícone Circular na Galeria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ícone circular de seleção no canto top-right de cada foto na galeria pública, permitindo ao usuário clicar diretamente na foto para selecioná-la sem precisar do botão "Selecionar" da toolbar.

**Architecture:** Mudança puramente de UI no componente `PhotoGrid` do portal público. A lógica de estado (`selectMode`, `selected`, `handleBulkAddToCart`) já existe — só falta adicionar o ícone circular que aciona `setSelectMode(true)` + `toggleSelect(id)` ao ser clicado.

**Tech Stack:** React, Tailwind CSS, Next.js 14 App Router

---

## Arquivos

- Modify: `src/app/[tenant]/evento/[slug]/_components/photo-grid.tsx` — adicionar ícone circular top-right no grid view e no list view
- Modify: `src/app/[tenant]/ensaio/[slug]/_components/photo-grid.tsx` — mesma mudança (verificar se tem lógica de seleção)

---

### Task 1: Adicionar ícone circular de seleção no grid view do evento

**Arquivo:** `src/app/[tenant]/evento/[slug]/_components/photo-grid.tsx`

O grid view (linhas 234–273 do arquivo atual) renderiza cada foto como um `<div>` com `group`. Dentro desse div, existe:
- A `<img>`
- Checkbox top-left (aparece apenas quando `selectMode`)
- Botão carrinho bottom-right (aparece no hover, fora do select mode)

Precisamos adicionar o **ícone circular top-right** que ativa seleção.

- [ ] **Step 1: Localizar o bloco do grid view**

No arquivo `src/app/[tenant]/evento/[slug]/_components/photo-grid.tsx`, encontre o bloco que começa com:
```tsx
{viewMode === 'grid' && (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
    {displayed.map((photo, idx) => {
```

- [ ] **Step 2: Adicionar ícone circular de seleção**

Dentro do card da foto (após a `<img>` e antes do botão de carrinho), adicione o ícone circular. O trecho a substituir é o bloco `{photo.status === 'ready' && photo.public_storage_path ? (<> ... </>)}`:

```tsx
{photo.status === 'ready' && photo.public_storage_path ? (
  <>
    <img
      src={getPhotoUrl(photo.public_storage_path) ?? ''}
      alt=""
      className="w-full h-full object-cover hover:opacity-90 transition-opacity"
      draggable="false"
      onContextMenu={(e) => e.preventDefault()}
    />
    {/* Ícone circular de seleção — top-right */}
    {!isManager && (
      <button
        onClick={(e) => {
          e.stopPropagation()
          setSelectMode(true)
          toggleSelect(photo.id)
        }}
        aria-label={isSelected ? 'Desmarcar foto' : 'Selecionar foto'}
        className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-all
          ${isSelected
            ? 'bg-[#2563eb] border-[#2563eb] text-white opacity-100'
            : selectMode
              ? 'bg-white/80 border-gray-400 opacity-100'
              : 'bg-white/80 border-gray-400 opacity-0 group-hover:opacity-100'
          }`}
      >
        {isSelected && <span className="text-[10px] leading-none font-bold">✓</span>}
      </button>
    )}
    {/* Checkbox top-left para manager */}
    {selectMode && isManager && (
      <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center z-10 pointer-events-none ${isSelected ? `${checkboxSelected} text-white` : 'bg-white/80 border-gray-400'}`}>
        {isSelected && <span className="text-[10px] leading-none font-bold">✓</span>}
      </div>
    )}
    {!selectMode && (
      <button
        onClick={(e) => { e.stopPropagation(); addToCart(photo.id) }}
        disabled={cartWorking.has(photo.id)}
        className={`absolute bottom-2 right-2 flex items-center gap-1 text-xs px-2 py-1 rounded transition-all disabled:opacity-60 ${addedToCart.has(photo.id) ? 'bg-green-600 text-white opacity-100' : 'bg-primary text-primary-foreground opacity-0 group-hover:opacity-100'}`}
        aria-label="Adicionar ao carrinho"
      >
        <ShoppingCart className="h-3 w-3" />
        {cartWorking.has(photo.id) ? '…' : addedToCart.has(photo.id) ? '✓' : '+'}
      </button>
    )}
  </>
) : (
  <div className="w-full h-full flex items-center justify-center">
    <span className="text-xs text-muted-foreground">Processando…</span>
  </div>
)}
```

> **Nota:** O checkbox top-left original (linha ~248) para `!isManager` é **removido** — substituído pelo ícone circular top-right. O checkbox do manager (esquerda) permanece.

- [ ] **Step 3: Verificar no browser**

Acesse `http://2.25.150.248:8080/[tenant-slug]/evento/[slug]` e confirme:
- Hover numa foto mostra o ícone circular top-right
- Clique no ícone seleciona a foto (anel azul + check)
- Toolbar mostra "1 selecionada" + botão "Adicionar (1)"
- Clicar em mais fotos acumula a seleção
- "Adicionar (N)" envia todas ao carrinho
- "Cancelar" sai do select mode e limpa seleção

- [ ] **Step 4: Commit**

```bash
git add src/app/\[tenant\]/evento/\[slug\]/_components/photo-grid.tsx
git commit -m "feat(gallery): add circular select icon top-right on photo cards"
```

---

### Task 2: Verificar e aplicar mesma mudança no photo-grid do ensaio

**Arquivo:** `src/app/[tenant]/ensaio/[slug]/_components/photo-grid.tsx`

- [ ] **Step 1: Verificar se o ensaio tem lógica de carrinho**

Abra o arquivo e verifique se existe `addToCart` / `handleBulkAddToCart`. Se sim, aplicar a mesma mudança do Task 1. Se não tem carrinho (ensaio é apenas seleção para aprovação), avaliar se o ícone circular de seleção faz sentido no contexto.

- [ ] **Step 2: Aplicar mudança se aplicável**

Se o ensaio tem carrinho: aplicar exatamente o mesmo ícone circular top-right descrito no Task 1.

Se o ensaio não tem carrinho mas tem seleção: adaptar o ícone circular para ativar seleção sem carrinho (mesmo visual, mas sem o botão "Adicionar ao carrinho").

- [ ] **Step 3: Commit (se houve mudança)**

```bash
git add src/app/\[tenant\]/ensaio/\[slug\]/_components/photo-grid.tsx
git commit -m "feat(gallery): add circular select icon on ensaio photo grid"
```

---

## Self-Review

**Spec coverage:**
- [x] Ícone circular top-right → Task 1 Step 2
- [x] Clique seleciona sem precisar do botão "Selecionar" → `setSelectMode(true)` + `toggleSelect` no onClick
- [x] Múltiplas fotos selecionadas → state `selected` já acumula
- [x] Envio de todas ao carrinho → `handleBulkAddToCart` já existe, toolbar já mostra o botão
- [x] Ensaio → Task 2

**Placeholders:** nenhum.

**Consistência de tipos:** `selected: Set<string>`, `toggleSelect(id: string)`, `setSelectMode(boolean)` — todos já existem no componente, sem mudança de assinatura.
