-- Tabela de custos extras cadastrados (ex: argola, embalagem, chaveiro)
CREATE TABLE IF NOT EXISTS config_custo_extra (
  custo_extra_id UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome           TEXT          NOT NULL,
  valor          NUMERIC(10,4) NOT NULL,
  ativo          BOOLEAN       NOT NULL DEFAULT true,
  user_id        UUID          REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

ALTER TABLE config_custo_extra ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_config_custo_extra_user_id ON config_custo_extra(user_id);

CREATE OR REPLACE TRIGGER trg_config_custo_extra_updated_at
  BEFORE UPDATE ON config_custo_extra
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE config_custo_extra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own data" ON config_custo_extra;
CREATE POLICY "Users manage own data" ON config_custo_extra
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
