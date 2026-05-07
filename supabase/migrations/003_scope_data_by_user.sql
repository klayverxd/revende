-- =============================================================
-- 002_scope_data_by_user.sql — isolamento por usuário autenticado
-- =============================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'modelo','modelo_preco','revendedor','revendedor_modelo_preco',
      'envio','envio_item','acerto','producao',
      'venda_direta','venda_direta_item',
      'config_equipamento','config_materia_prima','config_energia','calculo_custo'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN user_id SET DEFAULT auth.uid()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(user_id)', 'idx_' || t || '_user_id', t);

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated full access" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Users manage own data" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "Users manage own data" ON %I
       FOR ALL TO authenticated
       USING (user_id = auth.uid())
       WITH CHECK (user_id = auth.uid())',
      t
    );
  END LOOP;
END;
$$;
