-- =============================================================
-- 011_pedido_rls.sql — RLS para pedido e pedido_item + fix constraints
-- =============================================================

-- Permite NULL nas colunas opcionais de pedido
ALTER TABLE pedido ALTER COLUMN desconto_valor DROP NOT NULL;
ALTER TABLE pedido ALTER COLUMN valor_sinal    DROP NOT NULL;
ALTER TABLE pedido ALTER COLUMN data_prazo     DROP NOT NULL;
ALTER TABLE pedido ALTER COLUMN forma_pagamento DROP NOT NULL;
ALTER TABLE pedido ALTER COLUMN cliente_nome   DROP NOT NULL;
ALTER TABLE pedido ALTER COLUMN cliente_telefone DROP NOT NULL;
ALTER TABLE pedido ALTER COLUMN cliente_email  DROP NOT NULL;
ALTER TABLE pedido ALTER COLUMN cliente_referencia DROP NOT NULL;
ALTER TABLE pedido ALTER COLUMN observacao     DROP NOT NULL;

-- Permite NULL nas colunas opcionais de pedido_item
ALTER TABLE pedido_item ALTER COLUMN modelo_id         DROP NOT NULL;
ALTER TABLE pedido_item ALTER COLUMN descricao_custom   DROP NOT NULL;
ALTER TABLE pedido_item ALTER COLUMN tempo_impressao_min DROP NOT NULL;
ALTER TABLE pedido_item ALTER COLUMN peso_g             DROP NOT NULL;
ALTER TABLE pedido_item ALTER COLUMN num_placas         DROP NOT NULL;
ALTER TABLE pedido_item ALTER COLUMN preco_venda_unit   DROP NOT NULL;
ALTER TABLE pedido_item ALTER COLUMN custo_unit         DROP NOT NULL;
ALTER TABLE pedido_item ALTER COLUMN observacao         DROP NOT NULL;

-- Adiciona user_id às tabelas de pedido
ALTER TABLE pedido
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE pedido
  ALTER COLUMN user_id SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_pedido_user_id ON pedido(user_id);

ALTER TABLE pedido_item
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE pedido_item
  ALTER COLUMN user_id SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_pedido_item_user_id ON pedido_item(user_id);

-- Preenche user_id para registros existentes (se houver)
UPDATE pedido SET user_id = auth.uid() WHERE user_id IS NULL;
UPDATE pedido_item SET user_id = auth.uid() WHERE user_id IS NULL;

-- Habilita RLS
ALTER TABLE pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_item ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Users manage own data" ON pedido;
CREATE POLICY "Users manage own data" ON pedido
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own data" ON pedido_item;
CREATE POLICY "Users manage own data" ON pedido_item
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
