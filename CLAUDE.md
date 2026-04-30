# Revendê — contexto do projeto para o Claude Code

## O que é este projeto

Sistema web de controle de vendas e consignação de produtos artesanais ou físicos.
Permite gerenciar revendedores, estoque, envios, conferências, acertos financeiros
e vendas diretas. Desenvolvido para uso pessoal por um único usuário autenticado.

---

## Stack

- **Framework**: Next.js 14+ com App Router e TypeScript
- **Estilização**: Tailwind CSS — paleta primária azul (#0C447C, #185FA5, #378ADD) e branco
- **Banco de dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth — e-mail e senha, sessão persistente
- **Hospedagem**: Vercel (frontend) + Supabase Cloud (banco)
- **PWA**: Sim — instalável no celular

---

## Estrutura de pastas

```
src/
  app/                    # App Router — páginas e layouts
    (auth)/               # Grupo de rotas públicas
      login/
    (app)/                # Grupo de rotas protegidas
      dashboard/
      produtos/
      revendedores/
      envios/
      conferencias/
      venda-direta/
      estoque/
      financeiro/
      calculadora/
  components/
    ui/                   # Componentes base (Button, Input, Badge, Modal...)
    layout/               # Sidebar, Topbar, BottomNav
    forms/                # Formulários reutilizáveis
    tables/               # Tabelas com seleção múltipla
  lib/
    supabase/
      client.ts           # createBrowserClient
      server.ts           # createServerClient
      middleware.ts       # helper para middleware
    utils/
      preco.ts            # resolverPreco() — hierarquia de preços
      acerto.ts           # calcularAcerto() — comissão e valor mínimo
      estoque.ts          # calcularEstoque()
  middleware.ts           # proteção de rotas — raiz do projeto
```

---

## Banco de dados — entidades principais

```sql
-- Produtos/modelos
modelo (modelo_id, codigo, nome, descricao, custo_producao, estoque_minimo, ativo)

-- Faixas de preço padrão do modelo
modelo_preco (preco_id, modelo_id, rotulo, quantidade_minima, preco, eh_promocao, ativo)

-- Revendedores
revendedor (revendedor_id, nome, telefone, email, endereco,
            modelo_acerto,        -- enum: COMISSAO | VALOR_MINIMO
            comissao_fixa,        -- usado em COMISSAO
            comissao_pct,         -- usado em COMISSAO
            ativo)

-- Preços por revendedor (sobrepõe o padrão do modelo)
revendedor_modelo_preco (rev_preco_id, revendedor_id, modelo_id,
                         rotulo, quantidade_minima,
                         preco,         -- usado em COMISSAO
                         valor_minimo,  -- usado em VALOR_MINIMO
                         eh_promocao, ativo)

-- Envios
envio (envio_id, revendedor_id, data_envio,
       status,  -- enum: ABERTO | CONFERIDO | ENCERRADO
       observacao)

-- Itens de cada envio
envio_item (envio_item_id, envio_id, modelo_id,
            modelo_acerto,       -- snapshot do modelo no momento
            qtd_enviada,
            preco_unitario,      -- snapshot para COMISSAO
            preco_2mais,         -- snapshot para COMISSAO
            valor_minimo_unit,   -- snapshot para VALOR_MINIMO
            preco_origem,        -- enum: MODELO | REVENDEDOR | MANUAL
            qtd_vendida,         -- preenchido na conferência
            qtd_devolvida,
            valor_total_venda,   -- para COMISSAO
            valor_a_receber,     -- para VALOR_MINIMO (calculado)
            preco_cliente,       -- opcional — quanto o revendedor cobrou
            modo_valor)          -- enum: CALCULADO | MANUAL

-- Acerto financeiro por envio
acerto (acerto_id, revendedor_id, envio_id,
        modelo_acerto,
        comissao_calculada,   -- para COMISSAO
        valor_liquido,        -- para COMISSAO
        valor_a_receber,      -- para VALOR_MINIMO
        valor_repassado,      -- quanto o revendedor pagou de fato
        status,               -- enum: PENDENTE | RECEBIDO
        data_recebimento, observacao)

-- Produções (entradas de estoque)
producao (producao_id, modelo_id, quantidade, custo_unitario, data_producao, observacao)

-- Vendas diretas
venda_direta (venda_id, data_venda,
              canal,            -- enum: PRESENCIAL | WHATSAPP | FEIRA | EVENTO | INSTAGRAM | OUTRO
              forma_pagamento,  -- enum: PIX | DINHEIRO | CARTAO | OUTRO
              desconto, valor_total, observacao, cliente_nome, cliente_contato)

venda_direta_item (item_id, venda_id, modelo_id,
                   quantidade, preco_unitario, preco_origem, subtotal)

-- Calculadora de custo
config_equipamento (equipamento_id, nome, potencia_watts, depreciacao_hora, ativa)
config_materia_prima (materia_prima_id, nome, preco_por_unidade, unidade_medida, ativo)
config_energia (id, preco_kwh, atualizado_em)  -- registro único
calculo_custo (calculo_id, equipamento_id, tempo_impressao_min,
               materias_primas,  -- JSON: [{materia_prima_id, quantidade}]
               pct_falhas, custo_energia, custo_materias_primas,
               custo_depreciacao, custo_falhas, custo_total,
               quantidade, custo_unitario, salvo_em_modelo_id)
```

**Regras de integridade:**
- Todas as tabelas têm `created_at` e `updated_at` com trigger automático
- Soft delete via campo `deleted_at` (nunca deletar registros de movimentações)
- Snapshots em `envio_item` são imutáveis — alterações de preço não retroagem

---

## Regras de negócio críticas

### Hierarquia de preços (modelo COMISSAO)

```typescript
// src/lib/utils/preco.ts
async function resolverPreco(modeloId, revendedorId, quantidade) {
  // 1. Busca REVENDEDOR_MODELO_PRECO (mais específico)
  // 2. Se não encontrar, busca MODELO_PRECO
  // 3. Se não encontrar, retorna null (manual)
  // Retorna: { preco, preco2mais, origem: 'REVENDEDOR' | 'MODELO' | null }
}
```

### Cálculo de acerto

```typescript
// Modelo COMISSAO
comissao = comissao_fixa + (valor_total_venda * comissao_pct)
valor_liquido = valor_total_venda - comissao

// Modelo VALOR_MINIMO
valor_a_receber = valor_minimo_unit * qtd_vendida
// O revendedor cobra o que quiser do cliente — não afeta o valor_a_receber
```

### Estoque disponível

```typescript
estoque_disponivel(modeloId) =
  SUM(producao.quantidade WHERE modelo_id = modeloId)
  - SUM(envio_item.qtd_enviada WHERE modelo_id = modeloId AND envio.status = 'ABERTO')
  - SUM(envio_item.qtd_vendida WHERE modelo_id = modeloId AND envio.status IN ['CONFERIDO','ENCERRADO'])
```

### Status dos envios

```
ABERTO     → enviado, aguardando conferência
CONFERIDO  → conferência feita, acerto pendente
ENCERRADO  → acerto recebido, ciclo fechado
```

### Alertas automáticos

```
estoque_disponivel = 0                    → SEM ESTOQUE
estoque_disponivel <= estoque_minimo      → REPOR
estoque_disponivel <= estoque_minimo*1.5  → ATENÇÃO
```

---

## Autenticação

- Provider: Supabase Auth e-mail + senha
- Usar **@supabase/ssr** (não @supabase/auth-helpers — depreciado)
- `createBrowserClient` para componentes client
- `createServerClient` para Server Components e Server Actions
- Middleware em `/middleware.ts` protege todas as rotas exceto `/login`
- Sessão persistida via cookies — usuário não precisa logar novamente

```typescript
// middleware.ts (raiz do projeto)
// Verificar sessão Supabase em todas as rotas
// Redirecionar para /login se não autenticado
// Redirecionar para /dashboard se autenticado tentar acessar /login
```

---

## Paleta de cores (Tailwind)

Usar estas classes consistentemente:

```
Sidebar:         bg-[#0C447C]
Header/botões:   bg-[#185FA5]
Links/destaques: text-[#378ADD]
Fundo claro:     bg-[#E6F1FB]
Bordas:          border-[#B5D4F4]
Fundo da página: bg-[#F4F8FD]
Branco:          bg-white
```

Badges de status:
```
OK/Ativo:    bg-green-50  text-green-800
Atenção:     bg-amber-50  text-amber-800
Crítico:     bg-red-50    text-red-800
Pendente:    bg-blue-50   text-blue-800
```

---

## Padrões de código

### Server Actions para mutações

```typescript
// Sempre usar Server Actions para insert/update/delete
'use server'
import { createServerClient } from '@/lib/supabase/server'

export async function criarProduto(data: FormData) {
  const supabase = createServerClient()
  const { error } = await supabase.from('modelo').insert({...})
  if (error) throw error
  revalidatePath('/produtos')
}
```

### Queries no servidor

```typescript
// Preferir Server Components para leitura de dados
// Nunca fazer queries sensíveis no cliente
const supabase = createServerClient()
const { data } = await supabase.from('modelo').select('*').eq('ativo', true)
```

### Seleção múltipla e ações em massa

```typescript
// Padrão para tabelas com checkbox
// Estado local: Set<string> de IDs selecionados
// Barra de ações aparece quando selecionados.size > 0
// Modal de confirmação antes de deletar
// Soft delete: atualizar deleted_at, não deletar o registro
```

### Formulários

```typescript
// Usar react-hook-form + zod para validação
// Nunca usar <form action> com dados sensíveis sem validação server-side
// Toast de sucesso/erro após cada ação
```

---

## Componentes base esperados

Criar em `src/components/ui/`:

- `Button` — variantes: primary, secondary, ghost, danger
- `Input` — com label e mensagem de erro inline
- `Select` — dropdown com opções
- `Modal` — overlay com confirmação
- `Badge` — status com cores semânticas
- `Toast` — notificação temporária (sucesso/erro)
- `DataTable` — tabela com checkbox, ordenação e paginação
- `BulkActionBar` — barra que aparece ao selecionar itens

---

## Layout

**Desktop (≥768px):** sidebar fixa à esquerda (196px) + área principal

**Mobile (<768px):** sidebar oculta + bottom navigation com 5 ícones:
Dashboard | Enviar | Conferir | Estoque | Financeiro

**Topbar:** breadcrumb à esquerda + botão de ação principal à direita

---

## Convenções de nomenclatura

- Arquivos de página: `page.tsx`
- Componentes: PascalCase (`ProdutoForm.tsx`)
- Funções utilitárias: camelCase (`resolverPreco`)
- Variáveis de ambiente: `NEXT_PUBLIC_` para client, sem prefixo para server
- Nomes de tabelas no banco: snake_case singular (`modelo`, `envio_item`)
- IDs: UUID gerado pelo Supabase (`uuid_generate_v4()`)

---

## Comandos úteis

```bash
npm run dev          # servidor local em localhost:3000
npm run build        # build de produção
npm run lint         # checar erros de lint
git add . && git commit -m "feat: descrição" && git push  # deploy automático no Vercel
```

---

## O que NÃO está no escopo da V1

- Upload de fotos de produtos
- Portal do revendedor (acesso externo)
- Múltiplos usuários / permissões
- Notificações por WhatsApp
- Integração com PIX
- Modo offline completo