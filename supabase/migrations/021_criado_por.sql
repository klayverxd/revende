-- =============================================================
-- 021_criado_por.sql — quem criou cada registro
-- =============================================================
-- DECISÃO DE PRODUTO: todos os membros do workspace veem tudo. Não há papéis
-- nem telas de permissão — a RLS de workspace da migration 014
-- (`user_id = workspace_owner_id()`) já entrega exatamente isso.
--
-- O que faltava era AUTORIA. `user_id` guarda o dono do workspace (é o que
-- faz o compartilhamento funcionar), então ele não diz quem lançou o
-- registro. `criado_por` guarda o auth.uid() de quem realmente inseriu.
--
-- Note a diferença de DEFAULT:
--   user_id     DEFAULT workspace_owner_id()  → o dono, para a RLS
--   criado_por  DEFAULT auth.uid()            → a pessoa, para auditoria
-- =============================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'pedido', 'pedido_item',
      'envio', 'envio_item', 'acerto',
      'producao',
      'venda_direta', 'venda_direta_item',
      'calculo_custo'
    ])
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS criado_por UUID
         REFERENCES auth.users(id) ON DELETE SET NULL',
      t
    );
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN criado_por SET DEFAULT auth.uid()',
      t
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_criado_por ON %I(criado_por)',
      t, t
    );
  END LOOP;
END;
$$;

-- Registros anteriores ficam com criado_por NULL: não há como descobrir o
-- autor retroativamente, e inventar o dono do workspace como autor seria
-- pior que admitir que não se sabe. A UI mostra "—" nesses casos.

COMMENT ON COLUMN pedido.criado_por IS
  'auth.uid() de quem lançou o registro. Diferente de user_id, que guarda o '
  'dono do workspace para efeito de RLS. NULL em registros anteriores a esta '
  'migration.';
