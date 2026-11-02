-- =============================================================
-- 017b_reconcilia_pedido_producao.sql
-- =============================================================
-- POR QUE EXISTE:
--   A conferência de produção (supabase/consultas/) mostrou que as tabelas
--   `pedido` e `pedido_item`, criadas à mão no painel, eram diferentes do que
--   a 010b reconstruiu a partir do código. E a primeira versão da 010b,
--   quando aplicada em produção, deixou três efeitos colaterais:
--
--   1. URGENTE — criou em `pedido_item` um trigger que faz
--      `NEW.updated_at = NOW()`, mas o `pedido_item` de produção NÃO TEM a
--      coluna `updated_at`. Resultado: todo UPDATE nessa tabela falha com
--      "record new has no field updated_at". O app não chegou a quebrar
--      porque nunca faz UPDATE em pedido_item (apaga e reinsere os itens),
--      mas editar uma linha pelo Table Editor do Supabase já dava erro.
--
--   2. Criou cinco enums (pedido_status_enum e cia.) que nenhuma coluna usa:
--      em produção essas colunas são TEXT.
--
--   3. Deixou `pedido` com DOIS triggers de updated_at — o novo e o
--      `set_updated_at_pedido`, que alguém criou à mão no painel.
--
-- Este arquivo é idempotente e funciona nos dois caminhos: em produção
-- (onde a 010b antiga já rodou) e num banco novo criado a partir do
-- repositório (onde a 010b nova não cria nada disso).
--
-- O "b" no nome é para rodar logo depois da 017 e antes da 018 — é a
-- próxima migration que produção precisa receber.
-- =============================================================

-- ─── 1. pedido_item ganha as colunas que a convenção do projeto exige ────
-- Toda tabela tem updated_at (com trigger) e deleted_at (soft delete).
-- Acrescentar colunas com DEFAULT é seguro com a tabela em uso.

ALTER TABLE pedido_item
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Com a coluna existindo, o trigger passa a ser válido.
CREATE OR REPLACE TRIGGER trg_pedido_item_updated_at
  BEFORE UPDATE ON pedido_item
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 2. pedido fica com um trigger de updated_at só ───────────────────────
-- Mantém o do padrão do projeto (set_updated_at, usado em todas as
-- tabelas) e remove o criado à mão. A função `trigger_set_updated_at()`
-- NÃO é removida: outras tabelas de produção podem depender dela.

CREATE OR REPLACE TRIGGER trg_pedido_updated_at
  BEFORE UPDATE ON pedido
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_pedido ON pedido;

-- ─── 3. Remove os enums órfãos ───────────────────────────────────────────
-- Sem CASCADE de propósito: se alguma coluna usar o tipo, o DROP falha e o
-- tipo fica — em vez de levar a coluna junto. A falha vira NOTICE para não
-- abortar o resto do arquivo.

DO $$
DECLARE
  tipo TEXT;
BEGIN
  FOREACH tipo IN ARRAY ARRAY[
    'pedido_status_enum',
    'canal_pedido_enum',
    'status_pagamento_enum',
    'prioridade_enum',
    'pedido_item_tipo_enum'
  ] LOOP
    BEGIN
      EXECUTE format('DROP TYPE IF EXISTS %I', tipo);
    EXCEPTION
      WHEN dependent_objects_still_exist THEN
        RAISE NOTICE 'Tipo % mantido: ainda há coluna usando.', tipo;
    END;
  END LOOP;
END $$;
