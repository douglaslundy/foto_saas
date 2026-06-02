# F3 — Seleção Múltipla por Ícone Circular na Galeria

**Data:** 2026-06-02  
**Status:** Aprovado — pronto para implementação

---

## Visão Geral

No portal público, cada foto na grade deve exibir um ícone circular no canto superior direito que, ao ser clicado, seleciona a foto. Quando uma ou mais fotos estão selecionadas, aparece o botão "Adicionar X ao carrinho" na toolbar. Clicar no ícone de qualquer foto entra automaticamente em select mode sem precisar clicar no botão "Selecionar" da toolbar.

---

## Diagnóstico do Estado Atual

O componente `src/app/[tenant]/evento/[slug]/_components/photo-grid.tsx` **já possui** toda a lógica de estado:

- `selectMode` / `selected` / `toggleSelect` / `exitSelectMode`
- `handleBulkAddToCart` que chama `POST /api/cart` em paralelo para todos os selecionados
- Botão "Selecionar" na toolbar que ativa `selectMode`
- Checkbox top-left que aparece **somente quando `selectMode === true`**

**O que falta:** ícone circular persistente no canto top-right de cada card que:
1. Aparece no hover (ou sempre visível com baixa opacidade)
2. Ao clicar, chama `toggleSelect(photo.id)` E define `setSelectMode(true)`
3. Dispensa a necessidade de clicar "Selecionar" primeiro

---

## Comportamento Esperado

### Ícone circular de seleção (por foto)
- **Posição:** `top-2 right-2` (canto superior direito)
- **Tamanho:** `w-6 h-6` circular
- **Estado desmarcado (idle):** anel branco/semitransparente com baixa opacidade, aparece no hover do card
- **Estado desmarcado (select mode ativo):** anel visível mesmo sem hover
- **Estado marcado:** fundo azul (#2563eb) com checkmark branco, sempre visível
- **Clique:** `e.stopPropagation()` → `setSelectMode(true)` → `toggleSelect(photo.id)`

### Toolbar (sem mudança de lógica, apenas de rótulo)
- Fora do select mode: botão "Selecionar" continua existindo como alternativa
- No select mode: exibe `{selected.size} selecionadas` + `Adicionar (N)` + `Cancelar`

### Botão "Adicionar ao carrinho" individual (bottom-right, hover)
- Quando em select mode: **esconde** o botão individual (evita confusão)
- Fora do select mode: comportamento atual sem mudança

---

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/app/[tenant]/evento/[slug]/_components/photo-grid.tsx` | Adicionar ícone circular top-right em cada card no grid view |
| `src/app/[tenant]/ensaio/[slug]/_components/photo-grid.tsx` | Mesma mudança (se aplicável ao ensaio) |

---

## Comportamento Ensaio vs Evento

- No **ensaio** (`isManager=false`): mesmo ícone circular, mesma lógica de bulk add to cart
- No **ensaio** (`isManager=true`): ícone circular ativa seleção para **bulk delete** (mesma lógica já existente no manager)

---

## Sem Mudanças de API

Nenhuma mudança de backend necessária. A API `POST /api/cart` já existe e o `handleBulkAddToCart` já a chama corretamente.

---

## Design do Ícone

```
Estado idle (hover no card):
  Círculo branco/80 com borda cinza, opacidade-0 → group-hover:opacity-100

Estado select mode (sem marcar):
  Círculo branco/80 com borda cinza, sempre visível (opacity-100)

Estado marcado:
  Círculo azul (#2563eb) com ✓ branco, sempre visível
```
