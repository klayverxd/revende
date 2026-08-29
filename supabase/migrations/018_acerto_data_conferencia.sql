-- =============================================================
-- 018_acerto_data_conferencia.sql
-- =============================================================
-- A coluna `acerto.data_conferencia` é escrita e lida pelo código desde a
-- conferência por revendedor:
--   - src/app/(app)/conferencias/actions.ts (salvarAcertoPorEnvio, editarDataConferencia)
--   - src/app/(app)/conferencias/revendedor/[revendedor_id]/page.tsx
-- …mas nunca existiu em migration nenhuma — foi criada à mão no painel.
-- Sem ela, a conferência quebra num banco novo.
-- =============================================================

ALTER TABLE acerto
  ADD COLUMN IF NOT EXISTS data_conferencia DATE;

COMMENT ON COLUMN acerto.data_conferencia IS
  'Data em que a conferência foi feita. Editável depois do fato, porque a '
  'conferência costuma ser lançada dias após a contagem real.';
