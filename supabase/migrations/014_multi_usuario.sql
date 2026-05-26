-- =============================================================
-- 014_multi_usuario.sql — acesso compartilhado por workspace
-- =============================================================
-- Permite que o dono do sistema convide membros (ex: sócios,
-- colaboradores) que passam a ver e criar os mesmos dados.
-- A lógica: workspace_owner_id() devolve o dono do workspace
-- para o usuário atual. Membros enxergam dados do dono.
-- =============================================================

-- 1. Tabela de membros do time
CREATE TABLE IF NOT EXISTS membro_equipe (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dono_id         UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  membro_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  email_convidado TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dono_id, email_convidado)
);

ALTER TABLE membro_equipe ENABLE ROW LEVEL SECURITY;

-- Dono gerencia o time
DROP POLICY IF EXISTS "Owner manages team" ON membro_equipe;
CREATE POLICY "Owner manages team" ON membro_equipe
  FOR ALL TO authenticated
  USING  (dono_id  = auth.uid())
  WITH CHECK (dono_id = auth.uid());

-- Membro pode ler seu próprio vínculo
DROP POLICY IF EXISTS "Member reads own link" ON membro_equipe;
CREATE POLICY "Member reads own link" ON membro_equipe
  FOR SELECT TO authenticated
  USING (membro_id = auth.uid());

-- 2. Função que resolve o owner do workspace
--    Se o usuário for membro de algum time, retorna o dono.
--    Caso contrário, retorna o próprio uid.
CREATE OR REPLACE FUNCTION workspace_owner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT dono_id FROM membro_equipe WHERE membro_id = auth.uid() LIMIT 1),
    auth.uid()
  );
$$;

-- 3. Atualiza DEFAULT e RLS de todas as tabelas de dados
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'modelo','modelo_preco','revendedor','revendedor_modelo_preco',
      'envio','envio_item','acerto','producao',
      'venda_direta','venda_direta_item',
      'config_equipamento','config_materia_prima','config_energia','calculo_custo',
      'config_custo_extra',
      'pedido','pedido_item',
      'cliente'
    ])
  LOOP
    -- O DEFAULT agora chama workspace_owner_id() para que inserts de
    -- membros sejam gravados sob o user_id do dono do workspace.
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN user_id SET DEFAULT workspace_owner_id()',
      t
    );

    -- A política permite acesso a todos que pertencem ao mesmo workspace.
    EXECUTE format('DROP POLICY IF EXISTS "Users manage own data" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "Users manage own data" ON %I
       FOR ALL TO authenticated
       USING  (user_id = workspace_owner_id())
       WITH CHECK (user_id = workspace_owner_id())',
      t
    );
  END LOOP;
END;
$$;

-- Nota: envio_draft NÃO é atualizado — cada usuário tem seu próprio
-- rascunho de envio; não faz sentido compartilhar.
