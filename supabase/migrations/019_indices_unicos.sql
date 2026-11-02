-- =============================================================
-- 019_indices_unicos.sql — impede duplicatas que hoje falham em silêncio
-- =============================================================
-- Três unicidades que o schema assume mas nunca declarou. Sem elas:
--
-- 1) revendedor_modelo_preco — QUATRO telas diferentes gravam nesta tabela
--    (preços em massa, faixas por produto, padrão do revendedor, e o
--    checkbox "salvar preço" da conferência), com filtros e `rotulo`
--    divergentes. Duas linhas para o mesmo (revendedor, modelo, qtd) fazem
--    `resolverPreco` cair no `.maybeSingle()`, cujo erro é descartado sem
--    checagem — o preço do revendedor simplesmente DESAPARECE e o sistema
--    usa o preço padrão do modelo, sem nenhum aviso.
--
-- 2) config_energia — a migration 001 diz no comentário "registro único —
--    usar upsert", mas não há constraint. Cada leitor faz
--    `.order(...).limit(1)` e os leitores discordam da coluna de ordenação
--    (`updated_at` na calculadora, `atualizado_em` na venda direta), então
--    duas linhas dão preço de kWh diferente em telas diferentes.
--
-- 3) pedido.numero_pedido — `gerarNumeroPedido()` faz MAX+1 sob RLS, então
--    dois workspaces geram "PED-2026-0001" independentemente. A unicidade
--    correta é por workspace (user_id), não global.
--
--    ATENÇÃO: a conferência mostrou que produção JÁ TEM um UNIQUE global em
--    numero_pedido (criado à mão, agora descrito na 010b). Enquanto ele
--    existir, este índice por workspace não acrescenta proteção — e um
--    segundo workspace que gere "PED-2026-0001" vai falhar ao criar pedido.
--    Com um workspace só (o caso hoje), isso não acontece. Trocar o global
--    pelo por-workspace fica para quando houver um segundo workspace.
--
-- SEGURANÇA: cada índice só é criado se a tabela já estiver limpa. Havendo
-- duplicatas, a migration emite WARNING com a contagem e NÃO cria o índice —
-- em vez de abortar a migration inteira ou apagar dados de negócio por conta
-- própria. Os blocos de limpeza estão comentados ao final, para você rodar
-- deliberadamente depois de conferir.
-- =============================================================

-- ─── 1. Preço por revendedor ─────────────────────────────────────────────
DO $$
DECLARE
  dups INTEGER;
BEGIN
  SELECT COUNT(*) INTO dups FROM (
    SELECT 1
    FROM revendedor_modelo_preco
    WHERE deleted_at IS NULL
    GROUP BY revendedor_id, modelo_id, quantidade_minima
    HAVING COUNT(*) > 1
  ) d;

  IF dups > 0 THEN
    RAISE WARNING
      'revendedor_modelo_preco: % combinações duplicadas — índice único NÃO criado. Rode a limpeza no fim desta migration.',
      dups;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rmp_revendedor_modelo_qtd_unique
      ON revendedor_modelo_preco (revendedor_id, modelo_id, quantidade_minima)
      WHERE deleted_at IS NULL;
    RAISE NOTICE 'revendedor_modelo_preco: índice único criado.';
  END IF;
END $$;

-- ─── 2. Configuração de energia (um registro por workspace) ──────────────
-- ATENÇÃO: `config_energia` é a ÚNICA tabela de dados do schema SEM a coluna
-- `deleted_at` (ver 001). É por isso que o índice aqui não é parcial, e
-- também por isso que o "reset calculadora" em configuracoes/actions.ts faz
-- DELETE físico nela em vez de soft delete. A inconsistência é conhecida;
-- unificar isso é assunto da Fase 2, junto com a calculadora.
DO $$
DECLARE
  dups INTEGER;
BEGIN
  SELECT COUNT(*) INTO dups FROM (
    SELECT 1
    FROM config_energia
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) d;

  IF dups > 0 THEN
    RAISE WARNING
      'config_energia: % workspaces com mais de um registro — índice único NÃO criado.',
      dups;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_config_energia_user_unique
      ON config_energia (user_id);
    RAISE NOTICE 'config_energia: índice único criado.';
  END IF;
END $$;

-- ─── 3. Número do pedido, único por workspace ────────────────────────────
DO $$
DECLARE
  dups INTEGER;
BEGIN
  SELECT COUNT(*) INTO dups FROM (
    SELECT 1
    FROM pedido
    WHERE deleted_at IS NULL
    GROUP BY user_id, numero_pedido
    HAVING COUNT(*) > 1
  ) d;

  IF dups > 0 THEN
    RAISE WARNING
      'pedido: % números repetidos no mesmo workspace — índice único NÃO criado. Renumere os pedidos afetados à mão (são dados de negócio).',
      dups;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pedido_numero_user_unique
      ON pedido (user_id, numero_pedido)
      WHERE deleted_at IS NULL;
    RAISE NOTICE 'pedido: índice único criado.';
  END IF;
END $$;

-- =============================================================
-- LIMPEZA MANUAL — descomente e rode SÓ depois de inspecionar
-- =============================================================
--
-- Inspecionar duplicatas de preço por revendedor:
--
--   SELECT r.nome AS revendedor, m.nome AS produto,
--          rmp.quantidade_minima, COUNT(*) AS linhas,
--          array_agg(rmp.rotulo)      AS rotulos,
--          array_agg(rmp.preco)       AS precos,
--          array_agg(rmp.valor_minimo) AS valores_minimos
--   FROM revendedor_modelo_preco rmp
--   JOIN revendedor r USING (revendedor_id)
--   JOIN modelo m     USING (modelo_id)
--   WHERE rmp.deleted_at IS NULL
--   GROUP BY r.nome, m.nome, rmp.quantidade_minima
--   HAVING COUNT(*) > 1
--   ORDER BY r.nome, m.nome;
--
-- Manter a linha mais recente e arquivar as outras (soft delete):
--
--   WITH ranqueado AS (
--     SELECT rev_preco_id,
--            ROW_NUMBER() OVER (
--              PARTITION BY revendedor_id, modelo_id, quantidade_minima
--              ORDER BY updated_at DESC, created_at DESC
--            ) AS pos
--     FROM revendedor_modelo_preco
--     WHERE deleted_at IS NULL
--   )
--   UPDATE revendedor_modelo_preco
--   SET deleted_at = NOW()
--   WHERE rev_preco_id IN (SELECT rev_preco_id FROM ranqueado WHERE pos > 1);
--
-- Para config_energia a limpeza é DELETE, não soft delete, porque a tabela
-- não tem `deleted_at`. Mantém o registro mais recente:
--
--   WITH ranqueado AS (
--     SELECT id, ROW_NUMBER() OVER (
--              PARTITION BY user_id ORDER BY atualizado_em DESC, created_at DESC
--            ) AS pos
--     FROM config_energia
--   )
--   DELETE FROM config_energia
--   WHERE id IN (SELECT id FROM ranqueado WHERE pos > 1);
--
-- Depois da limpeza, rode esta migration de novo para criar os índices.
-- =============================================================
