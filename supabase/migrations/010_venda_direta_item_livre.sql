-- Permite itens de venda direta sem produto do catálogo (ex: item personalizado)
ALTER TABLE venda_direta_item
  ALTER COLUMN modelo_id DROP NOT NULL;

ALTER TABLE venda_direta_item
  ADD COLUMN IF NOT EXISTS descricao_livre text;

-- Garante que sempre haja modelo_id OU descricao_livre
ALTER TABLE venda_direta_item
  ADD CONSTRAINT vda_item_produto_ou_livre
  CHECK (
    (modelo_id IS NOT NULL AND descricao_livre IS NULL)
    OR
    (modelo_id IS NULL AND descricao_livre IS NOT NULL)
  );
