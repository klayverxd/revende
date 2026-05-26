-- 017_pedido_datas.sql — adiciona colunas de datas de produção e entrega ao pedido

ALTER TABLE pedido
  ADD COLUMN IF NOT EXISTS data_inicio_producao    DATE,
  ADD COLUMN IF NOT EXISTS data_conclusao_producao DATE,
  ADD COLUMN IF NOT EXISTS data_entrega            DATE;
