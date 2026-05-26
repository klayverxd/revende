-- =============================================================
-- 016_vincular_convite_fn.sql
-- Função SECURITY DEFINER para vincular um convite pendente ao
-- usuário atual. Usada no callback OAuth e no loginAction para
-- contornar o problema de RLS em Route Handlers onde a sessão
-- recém-criada ainda não está nas cookies da request.
-- =============================================================

CREATE OR REPLACE FUNCTION vincular_convite_pendente()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE membro_equipe
  SET membro_id = auth.uid()
  WHERE email_convidado = lower(auth.jwt() ->> 'email')
    AND membro_id IS NULL;
END;
$$;
