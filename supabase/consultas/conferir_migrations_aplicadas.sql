-- =============================================================
-- conferir_migrations_aplicadas.sql — o que já rodou em produção
-- =============================================================
-- NÃO é migration: só lê. Fica fora de supabase/migrations/.
--
-- POR QUE EXISTE: as migrations deste projeto são aplicadas à mão no SQL
--   Editor, e a produção não tem histórico confiável — a tabela
--   supabase_migrations.schema_migrations existe, mas foi criada por uma
--   tentativa da integração com o GitHub que falhou e não reflete o que
--   está aplicado. Esta consulta verifica a "impressão digital" de cada
--   migration: um objeto que só ela cria.
--
-- Validada localmente: sem as migrations pendentes marca 2 de 12; com
--   todas, 12 de 12. Em produção, em 2026-11-02, deu 12 de 12.
--
-- `019` e `022` têm trava de segurança: com dado sujo, rodam mas pulam o
--   índice/CHECK e só avisam por WARNING. Um `false` nelas não significa
--   "não rodou", e sim "achou duplicata ou valor inválido".
--
-- AO CRIAR UMA MIGRATION NOVA, acrescente aqui a impressão digital dela.
-- =============================================================

SELECT m.migration, m.verificacao, m.ok
FROM (VALUES
  ('018', 'acerto.data_conferencia',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'acerto' AND column_name = 'data_conferencia')),
  ('019', 'indice unico: preco por revendedor', to_regclass('public.idx_rmp_revendedor_modelo_qtd_unique') IS NOT NULL),
  ('019', 'indice unico: config_energia',       to_regclass('public.idx_config_energia_user_unique') IS NOT NULL),
  ('019', 'indice unico: numero do pedido',     to_regclass('public.idx_pedido_numero_user_unique') IS NOT NULL),
  ('020', 'revendedor.extrato_token',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'revendedor' AND column_name = 'extrato_token')),
  ('021', 'criado_por nas 9 tabelas',
    (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'criado_por'
       AND table_name IN ('pedido','pedido_item','envio','envio_item','acerto','producao','venda_direta','venda_direta_item','calculo_custo')) = 9),
  ('022', 'CHECK do status do pedido',
    EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedido_status_check')),
  ('022', 'demais CHECKs (5)',
    (SELECT count(*) FROM pg_constraint WHERE conname IN ('pedido_canal_check','pedido_prioridade_check','pedido_status_pagamento_check','pedido_forma_pagamento_check','pedido_item_tipo_check')) = 5),
  ('023', 'pedido.ordem_esteira',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pedido' AND column_name = 'ordem_esteira')),
  ('023', 'tabelas do card (6)',
    (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'
       AND table_name IN ('pedido_checklist','pedido_checklist_item','etiqueta','pedido_etiqueta','pedido_comentario','pedido_anexo')) = 6),
  ('024', 'modelo.is_coringa',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'modelo' AND column_name = 'is_coringa')),
  ('024', 'funcao feita a mao removida', to_regproc('public.trigger_set_updated_at') IS NULL)
) AS m(migration, verificacao, ok)
ORDER BY 1, 2;
