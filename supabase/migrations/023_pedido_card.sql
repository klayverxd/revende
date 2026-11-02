-- =============================================================
-- 023_pedido_card.sql — o card da esteira, no padrão Trello
-- =============================================================
-- O pedido deixa de ser linha de tabela e passa a ser o objeto de trabalho:
-- título próprio, descrição em Markdown, prazo que pode ser marcado como
-- cumprido, responsável, capa, várias checklists, etiquetas coloridas,
-- comentários e anexos.
--
-- O que o Trello NÃO tem e entra aqui: os itens do pedido com preço, custo e
-- subtotal. É justamente onde o controle de faturamento se perdia — o card
-- ficava no Trello e o dinheiro não ficava em lugar nenhum.
--
-- Deliberadamente FORA: múltiplos membros por card (equipe pequena, um
-- responsável basta), power-ups, automações e data de início.
-- =============================================================

-- ─── Campos do card no próprio pedido ────────────────────────────────────

ALTER TABLE pedido
  ADD COLUMN IF NOT EXISTS titulo          TEXT,
  ADD COLUMN IF NOT EXISTS descricao_md    TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS capa_url        TEXT,
  ADD COLUMN IF NOT EXISTS prazo_concluido BOOLEAN NOT NULL DEFAULT FALSE,
  -- Ordem dentro da coluna do kanban. DOUBLE PRECISION de propósito: para
  -- inserir um card entre dois outros basta usar o ponto médio, sem
  -- renumerar a coluna inteira a cada arrasto.
  ADD COLUMN IF NOT EXISTS ordem_esteira   DOUBLE PRECISION;

-- Migra a observação existente para a descrição em Markdown.
UPDATE pedido
SET descricao_md = observacao
WHERE descricao_md IS NULL AND observacao IS NOT NULL;

-- Semeia a ordem da esteira pela data de criação, para os cards existentes
-- não aparecerem todos empilhados no fim da coluna.
UPDATE pedido
SET ordem_esteira = EXTRACT(EPOCH FROM created_at)
WHERE ordem_esteira IS NULL;

COMMENT ON COLUMN pedido.observacao IS
  'DEPRECIADO — substituído por descricao_md. Mantido nesta migration para '
  'não perder dado antes da conferência; o código não escreve mais aqui. '
  'O DROP fica para uma migration futura.';

COMMENT ON COLUMN pedido.prazo_concluido IS
  'Marca o prazo como cumprido, como a caixinha da data no Trello. Separado '
  'do status porque um pedido pode ter entregue no prazo e ainda estar '
  'aguardando pagamento.';

CREATE INDEX IF NOT EXISTS idx_pedido_ordem_esteira
  ON pedido(status, ordem_esteira);
CREATE INDEX IF NOT EXISTS idx_pedido_responsavel
  ON pedido(responsavel_id);

-- ─── Checklists ──────────────────────────────────────────────────────────
-- Várias por card: "Impressão", "Acabamento", "Envio" — cada uma com sua
-- barra de progresso na frente do card.

CREATE TABLE IF NOT EXISTS pedido_checklist (
  checklist_id UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id    UUID             NOT NULL REFERENCES pedido(pedido_id) ON DELETE CASCADE,
  titulo       TEXT             NOT NULL,
  ordem        DOUBLE PRECISION NOT NULL DEFAULT 0,
  user_id      UUID             REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_por   UUID             REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedido_checklist_item (
  item_id      UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID             NOT NULL REFERENCES pedido_checklist(checklist_id) ON DELETE CASCADE,
  texto        TEXT             NOT NULL,
  concluido    BOOLEAN          NOT NULL DEFAULT FALSE,
  concluido_em TIMESTAMPTZ,
  ordem        DOUBLE PRECISION NOT NULL DEFAULT 0,
  user_id      UUID             REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_por   UUID             REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_pedido
  ON pedido_checklist(pedido_id);
CREATE INDEX IF NOT EXISTS idx_checklist_item_checklist
  ON pedido_checklist_item(checklist_id);

-- ─── Etiquetas ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS etiqueta (
  etiqueta_id UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT             NOT NULL,
  -- Hex da paleta, validado aqui para a UI não precisar tratar lixo.
  cor         TEXT             NOT NULL DEFAULT '#185FA5'
                               CHECK (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ordem       DOUBLE PRECISION NOT NULL DEFAULT 0,
  user_id     UUID             REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_etiqueta_nome_unique
  ON etiqueta (user_id, nome)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pedido_etiqueta (
  pedido_id   UUID        NOT NULL REFERENCES pedido(pedido_id) ON DELETE CASCADE,
  etiqueta_id UUID        NOT NULL REFERENCES etiqueta(etiqueta_id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pedido_id, etiqueta_id)
);

-- ─── Comentários ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pedido_comentario (
  comentario_id UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id     UUID        NOT NULL REFERENCES pedido(pedido_id) ON DELETE CASCADE,
  texto_md      TEXT        NOT NULL,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comentario_pedido
  ON pedido_comentario(pedido_id, created_at);

-- ─── Anexos ──────────────────────────────────────────────────────────────
-- Foto de referência que o cliente mandou, STL, print de conversa.

CREATE TABLE IF NOT EXISTS pedido_anexo (
  anexo_id      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id     UUID        NOT NULL REFERENCES pedido(pedido_id) ON DELETE CASCADE,
  url           TEXT        NOT NULL,
  nome          TEXT        NOT NULL,
  tipo          TEXT,
  tamanho_bytes BIGINT,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anexo_pedido ON pedido_anexo(pedido_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────
-- Uma linha por tabela, fora de qualquer EXECUTE format(): o editor SQL do
-- Supabase procura este comando no texto do script e, se não acha, avisa que
-- as tabelas ficariam abertas. As políticas vêm logo abaixo.

ALTER TABLE pedido_checklist      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_checklist_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE etiqueta              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_etiqueta       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_comentario     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_anexo          ENABLE ROW LEVEL SECURITY;

-- ─── Triggers, políticas e defaults de workspace ─────────────────────────
-- Mesmo padrão da migration 014: `user_id` recebe o dono do workspace (é o
-- que faz o compartilhamento entre membros funcionar) e `criado_por` recebe a
-- pessoa (auditoria).

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'pedido_checklist', 'pedido_checklist_item', 'etiqueta',
      'pedido_etiqueta', 'pedido_comentario', 'pedido_anexo'
    ])
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN user_id SET DEFAULT workspace_owner_id()', t
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_user_id ON %I(user_id)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users manage own data" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "Users manage own data" ON %I
       FOR ALL TO authenticated
       USING  (user_id = workspace_owner_id())
       WITH CHECK (user_id = workspace_owner_id())', t
    );
  END LOOP;

  -- Autoria só onde há autoria de fato. `etiqueta` é configuração do
  -- workspace (como uma categoria), não movimentação, e `pedido_etiqueta` é
  -- tabela de ligação — nenhuma das duas tem `criado_por`.
  FOR t IN
    SELECT unnest(ARRAY[
      'pedido_checklist', 'pedido_checklist_item',
      'pedido_comentario', 'pedido_anexo'
    ])
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN criado_por SET DEFAULT auth.uid()', t
    );
  END LOOP;

  -- pedido_etiqueta não tem updated_at: uma ligação existe ou não existe.
  FOR t IN
    SELECT unnest(ARRAY[
      'pedido_checklist', 'pedido_checklist_item', 'etiqueta',
      'pedido_comentario', 'pedido_anexo'
    ])
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t
    );
  END LOOP;
END;
$$;
