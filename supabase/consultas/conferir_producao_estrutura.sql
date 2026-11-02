-- =============================================================
-- conferir_producao_estrutura.sql — retrato do schema (parte 1 de 2)
-- =============================================================
-- NÃO é migration: só lê, não altera nada. Fica fora de
-- supabase/migrations/ de propósito, para nunca ser aplicada.
--
-- POR QUE EXISTE:
--   Parte do banco de produção foi criada à mão no painel. A conferência
--   mostrou divergências reais (TEXT onde o repo dizia enum, TIMESTAMPTZ
--   onde dizia DATE, colunas a mais e a menos). Esta consulta cobre TODAS
--   as tabelas do schema public, e a mesma consulta roda localmente contra
--   as migrations para comparar as duas saídas.
--
--   `format_type` mostra o tipo completo — `numeric(10,2)`, não só
--   `numeric` — e o nome real do enum, que o `information_schema` esconde.
--
-- DUAS PARTES, UMA LINHA POR TABELA: o retrato completo, uma linha por
--   coluna, passa de 50 mil caracteres em JSON e é cortado ao ser colado no
--   chat. Por isso os itens vêm agregados por tabela e a consulta é dividida:
--     conferir_producao_estrutura.sql — colunas, constraints, enums, funções
--     conferir_producao_regras.sql    — índices, políticas, RLS, triggers
--
--   Constraints NOT NULL ficam de fora (contype 'n'): o PostgreSQL 18
--   passou a catalogá-las como constraint e as versões anteriores não, o
--   que geraria diferença falsa. A nulidade já aparece na linha da coluna.
--
-- USO: cole no SQL Editor do Supabase, rode e copie o resultado como JSON.
-- =============================================================

WITH tabelas AS (
  SELECT c.oid, c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),

itens AS (
  SELECT
    'coluna'::text      AS tipo,
    t.relname::text     AS tabela,
    a.attname::text     AS nome,
    format_type(a.atttypid, a.atttypmod)
      || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
      || COALESCE(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '') AS detalhe
  FROM tabelas t
  JOIN pg_attribute a
    ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef d
    ON d.adrelid = a.attrelid AND d.adnum = a.attnum

  UNION ALL

  SELECT 'constraint', t.relname::text, c.conname::text, pg_get_constraintdef(c.oid)
  FROM pg_constraint c
  JOIN tabelas t ON t.oid = c.conrelid
  WHERE c.contype IN ('p', 'u', 'f', 'c', 'x')

  UNION ALL

  SELECT 'enum', '-', ty.typname::text,
         string_agg(e.enumlabel::text, ', ' ORDER BY e.enumsortorder)
  FROM pg_type ty
  JOIN pg_namespace n ON n.oid = ty.typnamespace
  JOIN pg_enum e ON e.enumtypid = ty.oid
  WHERE n.nspname = 'public'
  GROUP BY ty.typname

  UNION ALL

  -- Funções do schema public, exceto as que vêm de extensão (uuid-ossp etc.)
  SELECT 'funcao', '-', p.proname::text,
         pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend dep
      WHERE dep.objid = p.oid AND dep.deptype = 'e'
    )
)

SELECT
  tipo,
  tabela,
  string_agg(nome || ' :: ' || COALESCE(detalhe, ''), E'\n' ORDER BY nome) AS itens
FROM itens
GROUP BY tipo, tabela
ORDER BY tipo, tabela;
