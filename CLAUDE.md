# Imprimimos — contexto do projeto para o Claude Code

## O que é este projeto

Sistema de gestão de uma **empresa de impressão 3D**. Cobre a cadeia inteira:
orçamento → cálculo de custo → produção → acabamento → entrega → financeiro,
mais o módulo de **consignação** (revendedores, envios, conferências, acertos).

O projeto nasceu como "Revendê", focado só em consignação, e está em
refatoração modular para o escopo maior. O `package.json` e a interface já se
chamam Imprimimos; o diretório e o repositório no GitHub ainda são `revende`.

> **Plano da refatoração:** `~/.claude/plans/ideias-quero-novo-nome-ancient-panda.md`
> Fases: 0 fundação · 1 esteira · 2 catálogo/calculadora · 3 insumos ·
> 4 consignado · 5 painéis.

---

## Stack (versões reais, verificadas)

- **Next.js 15.5** com App Router e TypeScript 5.9 (`strict: true`)
- **React 19.2** (versão exata fixada, sem `^`)
- **Tailwind CSS 4.2** via `@tailwindcss/postcss` — **não existe `tailwind.config`**;
  a configuração vive em `src/app/globals.css`
- **Supabase** (PostgreSQL) com `@supabase/ssr` 0.10 — nunca `auth-helpers`
- **zod 4** + `react-hook-form` 7
- **recharts** 3 para gráficos
- **Playwright** para E2E, `node --test` para unitários
- Hospedagem: Vercel + Supabase Cloud
- PWA: manifest existe; **não há service worker** — não há suporte offline real

Paleta primária azul (#0C447C, #185FA5, #378ADD) e branco.

---

## Arquitetura — a regra que importa

**Regra de ouro: `src/modules/**` não importa Supabase, React nem Next.**
Recebe dados, devolve números. É o que torna o cálculo testável e impede que a
mesma fórmula reapareça em cinco telas (foi exatamente o que aconteceu com o
estoque).

```
src/
  app/
    (auth)/          login, register
    (app)/           rotas autenticadas (+ error.tsx, loading.tsx)
    (public)/
      r/[token]/     extrato do revendedor — única rota sem sessão
    auth/callback/   OAuth
  modules/           DOMÍNIO PURO, com testes
    acerto/          calcular.ts — COMISSAO e VALOR_MINIMO
    envio/           fechamento.ts — quando um envio encerra
    estoque/         calcular.ts — disponibilidade canônica
    pedido/          status.ts — estados e colunas da esteira
                     financeiro.ts — receita, custo e lucro do pedido
  lib/
    format.ts        fmtBRL, fmtData, parseNum, parseTempo, clamp, arredondar
    validacao.ts     primitivas zod + validar() para Server Actions
    tokens.ts        links públicos e rotas públicas
    db/
      types.ts       GERADO das migrations — não editar (npm run db:types)
      contrato.ts    asserções de tipo: schema × payloads do código
    queries/         I/O que alimenta os modules (estoque, modelo,
                     esteira, card, hoje)
    supabase/        client.ts, server.ts, admin.ts
    utils/preco.ts   resolverPreco — hierarquia de preços
  components/
    ui/              Button, Input, Select, SearchableSelect, Modal, Badge,
                     Toast, BulkActionBar, RowActionsMenu, FotoUpload
    layout/          AppShell, Sidebar, Topbar, BottomNav, nav-config
middleware.ts        proteção de rotas — raiz do projeto
```

**Não existem** (apesar de versões antigas deste arquivo afirmarem que sim):
`components/forms/`, `components/tables/`, `DataTable`. O `DataTable` é da
Fase 1 — hoje há 28 `<table>` montadas à mão.

### Fontes únicas — não recrie estas coisas

| Precisa de | Use | Nunca |
|---|---|---|
| Formatar moeda/data/percentual | `@/lib/format` | escrever `fmtCurrency` local (havia 24) |
| Ler texto numérico do usuário | `parseNum`, `parseTempo` | `parseFloat(x.replace(",", "."))` |
| Arredondar dinheiro | `arredondar(v, 2)` | `Number(v.toFixed(2))` |
| Estoque disponível | `@/lib/queries/estoque` | reimplementar a fórmula (havia 5 cópias) |
| Saber se um envio encerrou | `@/modules/envio/fechamento` | repetir o `every(...)` (havia 4 cópias) |
| Calcular acerto | `@/modules/acerto/calcular` | inline na action |
| Código de produto novo | `gerarCodigoModelo()` | `.order("codigo").limit(1)` (havia 3 cópias) |
| Validar input de action | `@/lib/validacao` | confiar no formulário do cliente |
| Rota pública / link por token | `@/lib/tokens` | lista inline no middleware |

---

## Banco de dados

Migrations em `supabase/migrations/`, aplicadas **à mão, uma por vez, no SQL
Editor do Supabase**, em ordem de nome de arquivo. Não há tabela de controle
de migrations: saber o que já rodou em produção exige conferir.

### O repositório descreve a produção — conferido, não suposto

Parte do banco de produção foi criada à mão no painel. Em 2026-11 a produção
foi comparada coluna a coluna com o que as migrations produzem, e as
divergências foram levadas **para o repositório** (nunca o contrário):

- **`010b_pedido_tables.sql`** cria `pedido`/`pedido_item` *como existem em
  produção*: `status`, `canal`, `prioridade`, `status_pagamento`,
  `forma_pagamento` e `tipo` são **TEXT** (não enum), `data_pedido` e as datas
  de produção são **TIMESTAMPTZ**, `numero_pedido` tem `UNIQUE` global. O "b"
  é para rodar entre a 010 e a 011, que já fazem `ALTER TABLE` nelas.
- **`017b`** e **`024`** reconciliam o resto: colunas que faltavam,
  trigger duplicado, enums órfãos, uma coluna feita à mão (`modelo.is_coringa`,
  sem uso no código) e uma função feita à mão.
- **`022`** valida os valores de pedido com **CHECK**, que produção nunca
  teve. A lista é a de `src/modules/pedido/status.ts`, e o teste confere que
  as duas são idênticas.

Para conferir de novo: `supabase/consultas/conferir_producao_estrutura.sql` e
`conferir_producao_regras.sql` (só leem; uma linha por tabela, para caber
numa colagem). Rode as mesmas consultas localmente contra as migrations e
compare.

**Migrations com trava de segurança** (`019`, `022`): se encontram dado sujo,
não criam o índice/CHECK e emitem `WARNING` — que o editor do Supabase pode
não exibir. Depois de rodar, confira pela consulta se foram criados.

### Estado da produção

Aplicadas: até a `017b`, mais a `024`. **Pendentes: `018` a `023`.** O código
desta branch depende delas (extrato por token, `criado_por`, esteira, card):
aplicar as migrations **antes** de fazer deploy.

### Entidades

```sql
-- Catálogo
modelo (modelo_id, codigo, nome, descricao, custo_producao,
        estoque_minimo, foto_url, ativo)
modelo_preco (preco_id, modelo_id, rotulo, quantidade_minima, preco,
              eh_promocao, ativo)

-- Consignação
revendedor (revendedor_id, nome, telefone, email, endereco,
            modelo_acerto,          -- COMISSAO | VALOR_MINIMO
            comissao_fixa, comissao_pct, valor_minimo_padrao,
            extrato_token,          -- endereço do link público /r/<token>
            extrato_ativo, ativo)
revendedor_modelo_preco (rev_preco_id, revendedor_id, modelo_id, rotulo,
                         quantidade_minima, preco, valor_minimo,
                         eh_promocao, ativo)
envio (envio_id, revendedor_id, data_envio, status, observacao)
envio_item (envio_item_id, envio_id, modelo_id, modelo_acerto, qtd_enviada,
            preco_unitario, preco_2mais, valor_minimo_unit, preco_origem,
            qtd_vendida, qtd_devolvida, valor_total_venda, valor_a_receber,
            preco_cliente, modo_valor)
acerto (acerto_id, revendedor_id, envio_id, modelo_acerto,
        comissao_calculada, valor_liquido, valor_a_receber, valor_repassado,
        status, data_conferencia, data_recebimento, observacao)
envio_draft (rascunho de envio, 1 por usuário, jsonb)

-- Produção e vendas
producao (producao_id, modelo_id, quantidade, custo_unitario,
          data_producao, observacao)
pedido (pedido_id, numero_pedido, data_pedido, canal, status, prioridade,
        cliente_nome, cliente_telefone, cliente_email, cliente_referencia,
        data_prazo, forma_pagamento, status_pagamento, valor_sinal,
        desconto_valor, taxa_marketplace_pct, custo_envio, outros_encargos,
        data_inicio_producao, data_conclusao_producao, data_entrega,
        cliente_id,
        -- card da esteira (023):
        titulo, descricao_md, responsavel_id, capa_url, prazo_concluido,
        ordem_esteira,
        observacao)   -- DEPRECIADO: a 023 copia para descricao_md
pedido_item (item_id, pedido_id, tipo, modelo_id, descricao_custom,
             tempo_impressao_min, peso_g, num_placas, quantidade,
             preco_venda_unit, custo_unit, observacao,
             produto_*_snapshot, custo_unit_snapshot,   -- de produção, sem uso
             equipamento_id, materia_prima_id)          -- de produção, sem uso

-- Card da esteira (023)
pedido_checklist (+ pedido_checklist_item), etiqueta (+ pedido_etiqueta),
pedido_comentario, pedido_anexo
venda_direta (+ venda_direta_item, com descricao_livre para item sem catálogo)

-- Calculadora
config_equipamento (nome, potencia_watts, depreciacao_hora,
                    valor_maquina, tempo_meses, horas_por_dia, dias_por_mes)
config_materia_prima (nome, preco_por_unidade, unidade_medida)
config_energia (preco_kwh, pct_falhas)   -- um registro por workspace
config_custo_extra (nome, valor)
calculo_custo (snapshot completo de um cálculo, salvo_em_modelo_id)

-- Equipe
membro_equipe (dono_id, membro_id, email_convidado)
cliente (existe desde a migration 013 e está DORMENTE — decisão de produto:
         cliente fica desnormalizado no pedido, sem cadastro separado)
```

**Convenções:**
- `created_at` / `updated_at` com trigger `set_updated_at()`
- **Soft delete** via `deleted_at` — nunca `DELETE` em movimentação
- Snapshots em `envio_item` são imutáveis: mudança de preço não retroage
- `user_id` guarda o **dono do workspace** (`DEFAULT workspace_owner_id()`),
  não a pessoa; `criado_por` guarda quem lançou (`DEFAULT auth.uid()`)

### Multi-usuário — está no escopo

`membro_equipe` + `workspace_owner_id()` (migration 014) fazem todos os
membros de um workspace verem os mesmos dados. **Não há papéis nem telas de
permissão, por decisão de produto:** todos veem tudo, e `criado_por` registra
a autoria.

---

## Regras de negócio

### Hierarquia de preços

```typescript
// src/lib/utils/preco.ts
resolverPreco(modeloId, revendedorId)   // NÃO recebe quantidade
// 1) revendedor_modelo_preco  (quantidade_minima = 1)
// 2) modelo_preco             (quantidade_minima = 1)
// 3) null → entrada manual
```

Só a faixa `quantidade_minima = 1` é lida. As outras faixas de `modelo_preco`
hoje servem apenas para exibição no catálogo.

### Acerto

```typescript
// src/modules/acerto/calcular.ts — comissaoPct é FRAÇÃO (0,3 = 30%)
comissao      = comissao_fixa + valor_total_venda * comissao_pct
valor_liquido = valor_total_venda - comissao

valor_a_receber = valor_minimo_unit * qtd_vendida   // VALOR_MINIMO
```

### Estoque disponível

```
disponivel = SUM(producao.quantidade)
           − saídas de envio
           − SUM(venda_direta_item.quantidade)

saídas de envio, por status:
  ABERTO                 → qtd_enviada
  CONFERIDO / ENCERRADO  → qtd_enviada − qtd_devolvida
```

Só a **devolução física** volta ao estoque: o que continua com o revendedor
segue fora. Alertas: `<= 0` SEM_ESTOQUE · `< minimo` REPOR ·
`<= minimo * 1.5` ATENCAO.

### Status

```
envio:   ABERTO → CONFERIDO → ENCERRADO
pedido:  IDEIA → ORCAMENTO → NOVO → EM_MODELAGEM → AGUARDANDO_IMPRESSAO
         → IMPRIMINDO → EM_ACABAMENTO → MIDIA → PRONTO → ENVIADO → ENTREGUE
         (ou CANCELADO). Fonte: src/modules/pedido/status.ts, que também
         define as colunas da esteira (várias por status).
```

---

## Autenticação

- Supabase Auth: e-mail/senha + Google OAuth
- `createClient()` de `@/lib/supabase/server` em Server Components e Actions
- `createBrowserClient` só em login, register e upload de foto
- `createAdminClient()` **bypassa RLS** — usar exclusivamente na rota pública
  `/r/[token]`, com query de escopo estrito
- `middleware.ts` protege tudo; as rotas públicas vêm de `ehRotaPublica()`

### Links públicos

Endereçar por **token opaco**, nunca pela chave primária. O extrato do
revendedor usa `revendedor.extrato_token`, validado como UUID **antes** de
tocar o banco, e falha sempre em `notFound()` — nunca `redirect`, porque um
redirect para o login já confirmaria que o token existe.

---

## Padrões de código

### Server Actions

```typescript
'use server'
import { validar, zUuid } from "@/lib/validacao";

const schema = z.object({ id: zUuid, /* ... */ });

export async function minhaAction(input: MeuInput) {
  validar(schema, input, "Não foi possível salvar");   // primeira linha
  const supabase = await createClient();
  // ...
  revalidatePath("/rota");
}
```

Server Action é **endpoint HTTP**: validação no navegador não protege nada.

Arquivos `"use server"` só podem exportar **funções async**. Constantes e
enums vão para `@/modules/...` (foi por isso que `PEDIDO_STATUS` mora em
`src/modules/pedido/status.ts`).

### Leitura

Preferir Server Components. Query pesada e reutilizada vai para
`src/lib/queries/`, que carrega os dados e delega o cálculo a `src/modules/`.

### Formulários

`react-hook-form` + `zod` no cliente, `validar()` no servidor. Toast de
sucesso/erro via `useToast()`.

### Seleção múltipla

Estado local `Set<string>`; `BulkActionBar` aparece quando há seleção; modal
de confirmação antes de excluir; soft delete.

---

## Layout

- **Desktop (≥768px):** sidebar fixa de 196px + área principal
- **Mobile (<768px):** bottom nav com 5 ícones + botão "Mais"
- **Topbar:** título (não breadcrumb) + ação principal, via
  `page-header-context`
- Navegação em `src/components/layout/nav-config.ts` — fonte única

---

## Comandos

```bash
npm run dev             # localhost:3000
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run test            # unitários (node --test, com resolução do alias @/)
npm run test:db         # migrations num Postgres real (PGlite/WASM, sem Docker),
                        # num banco limpo E no caminho da produção
npm run test:e2e        # Playwright (precisa TEST_USER_EMAIL / TEST_USER_PASSWORD)
npm run db:types        # regera src/lib/db/types.ts das migrations
npm run db:types:check  # falha se os tipos divergirem das migrations
npm run build
npm run verify          # tudo acima — rode antes de commitar
```

Os testes **importam do fonte** via `tests/alias-hook.mjs`, que resolve `@/`.
Nunca copie lógica para dentro do teste: a suíte antiga fazia isso e passava
enquanto a produção divergia.

### Tipos do banco

`src/lib/db/types.ts` é gerado aplicando as migrations num PostgreSQL real
(PGlite, WASM, dentro do npm) e introspeccionando o catálogo. **Não precisa de
conta Supabase, Docker ou rede.** Vantagem sobre o `supabase gen types
--linked`: os tipos refletem as migrations do repositório, não o estado de um
banco que alguém pode ter editado à mão no painel.

Mexeu numa migration? Rode `npm run db:types`. O CI roda `db:types:check` e
falha se você esquecer.

`src/lib/db/contrato.ts` confronta o schema com os payloads que as Server
Actions escrevem, em tempo de compilação. **Ao mexer nele, cuidado:** a
primeira versão usava só `A extends B ? true : false`, que é vacuoso — a
tipagem estrutural aceita propriedades a mais, então uma coluna inexistente
passava batido. `tests/integration/contrato.test.ts` sabota o payload de
propósito para garantir que as asserções ainda quebram.

---

## Estado atual e pendências conhecidas

**Fase 0 concluída e validada.** Migrations completas, extrato público seguro
por token, domínio em `src/modules/`, formatação e validação centralizadas,
tipos do banco gerados das migrations com detecção de drift, lint e CI.

**Banco conferido contra produção** (2026-11): o repositório reproduz o
schema real. `tests/integration/producao.test.ts` simula o caminho que a
produção percorreu — inclusive a versão antiga da 010b que chegou a rodar lá
(`tests/integration/fixtures/`) — e prova que as migrations seguintes aplicam
por cima.

**Fase 1 em andamento.** Feitos, com typecheck e testes, mas **nunca abertos
no navegador**: esteira kanban (`/producao`), card estilo Trello
(`/producao/[id]`, com Markdown, checklists, etiquetas, comentários) e a tela
"Hoje" (`/hoje`). Faltam: raiz do site abrir em `/hoje` (ainda abre em
`/dashboard`), upload de anexos e capa, mensagens de WhatsApp, `DataTable` e
busca Ctrl+K.

**Pendente:**
- **Wire do `Database` nos clients Supabase.** O arquivo de tipos existe, mas
  `createClient()` ainda não recebe o genérico — ligar isso faz o construtor de
  query inferir os tipos dos `select("a, rel:tabela(...)")`, e as ~200
  conversões `as string` viram erros a resolver. É trabalho incremental, feito
  módulo a módulo conforme cada fase toca os arquivos, não num big bang.
- **Nada foi verificado contra o banco de produção.** As migrations foram
  validadas contra um Postgres limpo e o DDL confere com o que o código
  escreve; se a tabela em produção divergiu do código em algum detalhe, só
  comparar com produção revela. A query de conferência está no cabeçalho de
  `010b_pedido_tables.sql`.
- Bugs mapeados e agendados para a Fase 4: botão de devolução com condição
  invertida (`envios/[id]/page.tsx`), `modo_valor` sempre `"MANUAL"`,
  `/envios/novo?revendedor=` ignorado.
- Calculadora tem **dois motores de custo** divergentes e `custo_extra` com
  semântica contraditória (Fase 2).
- `DataTable` não existe; 28 tabelas montadas à mão.
- Sem service worker: o app é instalável mas não funciona offline.

---

## Fora de escopo

- Controle de saldo de filamento por bobina (só as compras serão registradas)
- Cadastro de cliente separado (fica desnormalizado no pedido)
- Papéis e permissões por módulo (todos veem tudo)
- Importar G-code/3MF para preencher a calculadora — avaliado e descartado:
  para dois números que já se digitam rápido, subir arquivo é mais trabalho
- Integração com PIX
- Notificações por WhatsApp (há apenas mensagens prontas para copiar)
