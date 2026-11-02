-- =============================================================
-- conferir_producao_regras.sql — retrato do schema (parte 2 de 2)
-- =============================================================
-- NÃO é migration: só lê, não altera nada. Fica fora de
-- supabase/migrations/ de propósito, para nunca ser aplicada.
--
-- Complemento de conferir_producao_estrutura.sql: índices, triggers, RLS
-- e políticas de todas as tabelas do schema public.
--
-- O ponto mais importante aqui é segurança. A migration 001 criava em toda
-- tabela a política "Authenticated full access" (USING true — qualquer
-- usuário logado vê os dados de qualquer workspace), e a 003/014 a trocam
-- por "Users manage own data". Se alguma tabela de produção pulou essa
-- troca, a política aberta continua lá — e é nesta consulta que aparece.
--
-- Uma linha por tabela, com os itens agregados, para caber numa colagem no
-- chat (o retrato completo, uma linha por item, passa de 50 mil caracteres).
--
-- USO: cole no SQL Editor do Supabase, rode e copie o resultado como JSON.
-- =============================================================

WITH tabelas AS (
  SELECT c.oid, c.relname, c.relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),

itens AS (
  SELECT
    'rls'::text     AS tipo,
    t.relname::text AS tabela,
    'rls'::text     AS nome,
    CASE WHEN t.relrowsecurity THEN 'ligada' ELSE 'DESLIGADA' END AS detalhe
  FROM tabelas t

  UNION ALL

  SELECT 'politica', p.tablename::text, p.policyname::text,
         p.cmd || ' para ' || array_to_string(p.roles, ',')
           || ' | USING ' || COALESCE(p.qual, '-')
           || ' | CHECK ' || COALESCE(p.with_check, '-')
  FROM pg_policies p
  WHERE p.schemaname = 'public'

  UNION ALL

  SELECT 'trigger', t.relname::text, g.tgname::text, pg_get_triggerdef(g.oid)
  FROM pg_trigger g
  JOIN tabelas t ON t.oid = g.tgrelid
  WHERE NOT g.tgisinternal

  UNION ALL

  -- Só a parte depois de "USING": o resto da definição repete o nome do
  -- índice e da tabela, que já estão nas outras colunas.
  SELECT 'indice', t.relname::text, i.relname::text,
         CASE WHEN x.indisunique THEN 'UNIQUE ' ELSE '' END
           || substring(pg_get_indexdef(i.oid) FROM 'USING .*$')
  FROM pg_index x
  JOIN tabelas t ON t.oid = x.indrelid
  JOIN pg_class i ON i.oid = x.indexrelid
)

SELECT
  tipo,
  tabela,
  string_agg(nome || ' :: ' || COALESCE(detalhe, ''), E'\n' ORDER BY nome) AS itens
FROM itens
GROUP BY tipo, tabela
ORDER BY tipo, tabela;
