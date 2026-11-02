-- =============================================================
-- 024_reconcilia_schema_producao.sql
-- =============================================================
-- A conferência completa (supabase/consultas/conferir_producao_*.sql)
-- comparou as 20 tabelas de produção com o que as migrations produzem.
-- 16 batiam exatamente; `pedido`/`pedido_item` foram tratadas na 010b e na
-- 017b. Sobraram três diferenças fora delas, todas inofensivas hoje — mas
-- um banco criado a partir do repositório tem que ser igual ao de produção.
--
-- Este arquivo é idempotente e não muda nada que o app use.
-- =============================================================

-- ─── 1. modelo.is_coringa ────────────────────────────────────────────────
-- Existe em produção, criada à mão, e nenhum código lê ou escreve. Fica
-- declarada aqui para o banco novo ser igual; a "peça sob medida" que o app
-- usa hoje é `pedido_item.tipo = 'CORINGA'`, não esta coluna.

ALTER TABLE modelo
  ADD COLUMN IF NOT EXISTS is_coringa BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN modelo.is_coringa IS
  'Sem uso no código. Encontrada em produção (criada à mão) e declarada na '
  '024 para o schema do repositório ser igual ao de produção.';

-- ─── 2. membro_equipe.dono_id volta a ter default ────────────────────────
-- A 014 declara DEFAULT auth.uid(); em produção a coluna está sem default.
-- O app não depende dele (convidarMembro passa dono_id explicitamente), mas
-- vale o que a migration declara: quem convida é o dono.

ALTER TABLE membro_equipe
  ALTER COLUMN dono_id SET DEFAULT auth.uid();

-- ─── 3. Função de trigger feita à mão ────────────────────────────────────
-- `trigger_set_updated_at()` existe só em produção. A 017b já tirou o único
-- uso conhecido (o trigger duplicado em `pedido`). Se nada mais depender
-- dela, sai; se alguma tabela ainda a usar, o DROP falha, ela fica e o
-- NOTICE avisa — sem CASCADE, para nunca levar um trigger junto.

DO $$
BEGIN
  DROP FUNCTION IF EXISTS trigger_set_updated_at();
EXCEPTION
  WHEN dependent_objects_still_exist THEN
    RAISE NOTICE 'trigger_set_updated_at() mantida: ainda há trigger usando.';
END $$;
