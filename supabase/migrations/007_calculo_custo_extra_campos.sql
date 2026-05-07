-- Campos adicionais no calculo_custo para rastrear custo extra e número de placas
ALTER TABLE calculo_custo
  ADD COLUMN IF NOT EXISTS custo_extra    NUMERIC(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_placas     INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS custo_extra_id UUID;
