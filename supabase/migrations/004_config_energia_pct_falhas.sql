-- Adiciona coluna pct_falhas na tabela config_energia
-- Valor padrão: 5% (0.05)
ALTER TABLE config_energia
  ADD COLUMN IF NOT EXISTS pct_falhas numeric(5,4) NOT NULL DEFAULT 0.05;
