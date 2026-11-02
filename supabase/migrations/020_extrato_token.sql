-- =============================================================
-- 020_extrato_token.sql — token para o extrato público do revendedor
-- =============================================================
-- PROBLEMA QUE ISTO CORRIGE:
--   A rota /r/[revendedor_id] usa o client de service role
--   (createAdminClient), que ignora o RLS por completo, e identificava o
--   revendedor pelo próprio UUID da linha — sem token e sem checar dono.
--   Qualquer pessoa com um revendedor_id leria o extrato daquele revendedor,
--   de qualquer workspace.
--
--   Hoje isso não vazou por acidente: o middleware não liberava /r/, então o
--   link mandava o revendedor para /login e a funcionalidade simplesmente
--   não funcionava. Liberar o middleware sem trocar o identificador por um
--   token abriria o vazamento de verdade.
--
-- DECISÃO:
--   Identificador dedicado (`extrato_token`), separado da chave primária, e
--   revogável sem mexer no cadastro. `extrato_ativo` permite desligar o
--   compartilhamento sem perder o token.
-- =============================================================

ALTER TABLE revendedor
  ADD COLUMN IF NOT EXISTS extrato_token UUID    NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS extrato_ativo BOOLEAN NOT NULL DEFAULT TRUE;

-- Token é global: a busca pública não tem workspace para filtrar, então a
-- unicidade tem que valer para a base inteira.
CREATE UNIQUE INDEX IF NOT EXISTS idx_revendedor_extrato_token_unique
  ON revendedor (extrato_token);

COMMENT ON COLUMN revendedor.extrato_token IS
  'Identificador do link público /r/<token>. Trocar este valor revoga o link '
  'anterior na hora. Nunca use revendedor_id numa URL pública.';

COMMENT ON COLUMN revendedor.extrato_ativo IS
  'Desliga o extrato público sem trocar o token. FALSE faz /r/<token> '
  'responder 404.';
