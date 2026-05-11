-- Rascunho do novo envio (1 linha por usuário, sincroniza entre dispositivos)
CREATE TABLE IF NOT EXISTS envio_draft (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_json  jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE envio_draft
  ADD CONSTRAINT envio_draft_user_unique UNIQUE (user_id);

ALTER TABLE envio_draft ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can manage own envio draft"
  ON envio_draft
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
