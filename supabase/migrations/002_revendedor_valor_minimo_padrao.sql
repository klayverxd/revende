-- 002_revendedor_valor_minimo_padrao.sql
-- Adiciona campo de valor mínimo padrão na tabela revendedor.
-- Quando preenchido, é aplicado automaticamente a todos os produtos
-- que ainda não possuem preço personalizado para este revendedor.

ALTER TABLE revendedor
  ADD COLUMN IF NOT EXISTS valor_minimo_padrao NUMERIC(10,2);
