-- =============================================================
-- 015_membro_equipe_self_link.sql
-- Permite que um usuário vincule sua própria conta a um convite
-- pendente cujo email_convidado corresponda ao seu e-mail JWT.
-- Sem essa política o UPDATE no loginAction era bloqueado pela RLS.
-- =============================================================

DROP POLICY IF EXISTS "Link own account to invite" ON membro_equipe;
CREATE POLICY "Link own account to invite" ON membro_equipe
  FOR UPDATE TO authenticated
  USING  (email_convidado = (auth.jwt() ->> 'email') AND membro_id IS NULL)
  WITH CHECK (membro_id = auth.uid());
