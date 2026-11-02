-- =============================================================
-- 010b_pedido_tables.sql — cria pedido e pedido_item
-- =============================================================
-- POR QUE O NÚMERO "010b":
--   As tabelas `pedido` e `pedido_item` foram criadas à mão no painel do
--   Supabase e nunca tiveram migration. A partir da 011 várias migrations
--   fazem ALTER TABLE nelas (011 RLS, 012 custos, 013 cliente_id, 014 RLS de
--   workspace, 017 datas), então o CREATE precisa rodar ANTES da 011 — daí o
--   sufixo, que ordena entre "010_" e "011_".
--   Sem este arquivo, um banco novo criado a partir deste repositório quebra
--   na 011 e de novo na 014.
--
-- ATENÇÃO — schema reconstruído:
--   O DDL abaixo foi inferido do código (tipos em src/app/(app)/pedidos/
--   actions.ts + colunas usadas nas queries) e das migrations 011/012/013/017.
--   Pode divergir em detalhes da tabela que existe hoje em produção. Como
--   tudo aqui é IF NOT EXISTS, aplicar em produção é inofensivo — mas vale
--   conferir uma vez, comparando com:
--
--     SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--     WHERE table_name IN ('pedido','pedido_item')
--     ORDER BY table_name, ordinal_position;
--
--   Divergências encontradas devem ser corrigidas AQUI, não em produção.
-- =============================================================

-- ─── Enums ───────────────────────────────────────────────────────────────
-- `canal_pedido_enum` é separado de `canal_venda_enum` (001) de propósito:
-- venda direta usa FEIRA/EVENTO/OUTRO, pedido usa SHOPEE.

DO $$
BEGIN
  CREATE TYPE pedido_status_enum AS ENUM (
    'NOVO', 'EM_MODELAGEM', 'AGUARDANDO_IMPRESSAO', 'IMPRIMINDO',
    'EM_ACABAMENTO', 'PRONTO', 'ENVIADO', 'ENTREGUE', 'CANCELADO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE canal_pedido_enum AS ENUM (
    'PRESENCIAL', 'WHATSAPP', 'INSTAGRAM', 'SHOPEE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE status_pagamento_enum AS ENUM (
    'PENDENTE', 'SINAL_RECEBIDO', 'PAGO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE prioridade_enum AS ENUM ('NORMAL', 'ALTA', 'URGENTE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE pedido_item_tipo_enum AS ENUM ('PRODUTO', 'CORINGA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── pedido ──────────────────────────────────────────────────────────────
-- Colunas opcionais já nascem NULL-áveis, o que torna os DROP NOT NULL da
-- migration 011 no-ops idempotentes.
-- Cliente fica desnormalizado aqui (nome/telefone/email) por decisão de
-- produto: não há cadastro de cliente. `cliente_id` é adicionado pela 013 e
-- permanece sem uso.

CREATE TABLE IF NOT EXISTS pedido (
  pedido_id          UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_pedido      TEXT                  NOT NULL,
  data_pedido        DATE                  NOT NULL DEFAULT CURRENT_DATE,
  canal              canal_pedido_enum     NOT NULL DEFAULT 'PRESENCIAL',
  status             pedido_status_enum    NOT NULL DEFAULT 'NOVO',
  prioridade         prioridade_enum       NOT NULL DEFAULT 'NORMAL',

  cliente_nome       TEXT,
  cliente_telefone   TEXT,
  cliente_email      TEXT,
  cliente_referencia TEXT,

  data_prazo         DATE,
  forma_pagamento    forma_pagamento_enum,
  status_pagamento   status_pagamento_enum NOT NULL DEFAULT 'PENDENTE',
  valor_sinal        NUMERIC(10,2),
  desconto_valor     NUMERIC(10,2),

  observacao         TEXT,

  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_status      ON pedido(status);
CREATE INDEX IF NOT EXISTS idx_pedido_data_pedido ON pedido(data_pedido);
CREATE INDEX IF NOT EXISTS idx_pedido_data_prazo  ON pedido(data_prazo);

CREATE OR REPLACE TRIGGER trg_pedido_updated_at
  BEFORE UPDATE ON pedido
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── pedido_item ─────────────────────────────────────────────────────────
-- `tipo = 'CORINGA'` é a peça sob medida, sem produto de catálogo: leva
-- descricao_custom e os dados de impressão direto no item.

CREATE TABLE IF NOT EXISTS pedido_item (
  item_id             UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id           UUID                  NOT NULL REFERENCES pedido(pedido_id) ON DELETE CASCADE,
  tipo                pedido_item_tipo_enum NOT NULL DEFAULT 'PRODUTO',

  modelo_id           UUID                  REFERENCES modelo(modelo_id),
  descricao_custom    TEXT,

  tempo_impressao_min NUMERIC(10,2),
  peso_g              NUMERIC(10,2),
  num_placas          INTEGER,

  quantidade          INTEGER               NOT NULL DEFAULT 1,
  preco_venda_unit    NUMERIC(10,2),
  custo_unit          NUMERIC(10,2),

  observacao          TEXT,

  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_item_pedido_id ON pedido_item(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_item_modelo_id ON pedido_item(modelo_id);

CREATE OR REPLACE TRIGGER trg_pedido_item_updated_at
  BEFORE UPDATE ON pedido_item
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
