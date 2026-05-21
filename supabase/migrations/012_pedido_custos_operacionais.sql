-- Adiciona colunas de custos operacionais ao pedido
ALTER TABLE pedido
  ADD COLUMN IF NOT EXISTS taxa_marketplace_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS custo_envio          numeric(10,2),
  ADD COLUMN IF NOT EXISTS outros_encargos      numeric(10,2);
