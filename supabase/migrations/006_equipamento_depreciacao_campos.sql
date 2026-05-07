-- Campos para cálculo de depreciação por hora do equipamento
ALTER TABLE config_equipamento
  ADD COLUMN IF NOT EXISTS valor_maquina  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tempo_meses    INTEGER,
  ADD COLUMN IF NOT EXISTS horas_por_dia  NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS dias_por_mes   INTEGER;
