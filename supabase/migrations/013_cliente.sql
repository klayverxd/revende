-- =============================================================
-- 013_cliente.sql — tabela de clientes e vínculo com pedido
-- =============================================================

CREATE TABLE IF NOT EXISTS cliente (
  cliente_id UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT        NOT NULL,
  telefone   TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cliente ALTER COLUMN user_id SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_cliente_user_id ON cliente(user_id);

CREATE OR REPLACE TRIGGER trg_cliente_updated_at
  BEFORE UPDATE ON cliente
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own data" ON cliente;
CREATE POLICY "Users manage own data" ON cliente
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Adiciona FK de pedido → cliente
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES cliente(cliente_id);
