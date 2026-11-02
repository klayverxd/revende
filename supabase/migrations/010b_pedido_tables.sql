-- =============================================================
-- 010b_pedido_tables.sql — cria pedido e pedido_item
-- =============================================================
-- POR QUE O NÚMERO "010b":
--   As tabelas `pedido` e `pedido_item` foram criadas à mão no painel do
--   Supabase e nunca tiveram migration. A partir da 011 várias migrations
--   fazem ALTER TABLE nelas (011 RLS, 012 custos, 013 cliente_id, 014 RLS de
--   workspace, 017 datas), então o CREATE precisa rodar ANTES da 011 — daí o
--   sufixo, que ordena entre "010_" e "011_".
--
-- ESTE DDL DESCREVE A PRODUÇÃO — conferido, não inferido:
--   A primeira versão deste arquivo foi reconstruída a partir do código e
--   usava enums e DATE. A conferência contra o banco de produção
--   (supabase/consultas/conferir_producao_estrutura.sql) mostrou outra coisa, típica
--   de tabela criada pelo Table Editor do Supabase:
--     - status, canal, prioridade, status_pagamento, forma_pagamento e tipo
--       são TEXT, sem CHECK (a validação de valores vem na 022);
--     - data_pedido e as datas de produção são TIMESTAMPTZ;
--     - dinheiro em NUMERIC(10,2), peso em NUMERIC(8,2);
--       tempo_impressao_min é INTEGER;
--     - numero_pedido tem UNIQUE global;
--     - pedido_item tem colunas de snapshot e de calculadora que o código
--       nunca usou, e nasceu sem updated_at/deleted_at (a 017b acrescenta).
--
--   As datas de produção já vêm aqui como TIMESTAMPTZ para que a 017, que
--   as adicionaria como DATE, seja no-op — igual ao que aconteceu em
--   produção, onde elas já existiam quando a 017 rodou.
--
--   O que vier das migrations seguintes (user_id na 011, custos na 012,
--   cliente_id na 013) fica fora daqui de propósito.
--
--   Triggers de updated_at ficam na 017b, que também limpa o que a versão
--   antiga deste arquivo deixou em produção.
-- =============================================================

-- ─── pedido ──────────────────────────────────────────────────────────────
-- Cliente fica desnormalizado (nome/telefone/email) por decisão de produto:
-- não há cadastro de cliente. `cliente_id` vem da 013 e permanece sem uso.

CREATE TABLE IF NOT EXISTS pedido (
  pedido_id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_pedido           TEXT        NOT NULL UNIQUE,
  data_pedido             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canal                   TEXT        NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'NOVO',
  prioridade              TEXT        NOT NULL DEFAULT 'NORMAL',

  cliente_nome            TEXT,
  cliente_telefone        TEXT,
  cliente_email           TEXT,
  cliente_referencia      TEXT,

  data_prazo              DATE,
  forma_pagamento         TEXT,
  status_pagamento        TEXT        NOT NULL DEFAULT 'PENDENTE',
  valor_sinal             NUMERIC(10,2) DEFAULT 0,
  desconto_valor          NUMERIC(10,2) DEFAULT 0,

  data_inicio_producao    TIMESTAMPTZ,
  data_conclusao_producao TIMESTAMPTZ,
  data_entrega            TIMESTAMPTZ,

  observacao              TEXT,

  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS ligado já na criação. Sem política ainda, isto nega tudo — que é o
-- padrão seguro: as políticas chegam na 011 (por usuário) e na 014 (por
-- workspace). Em produção, onde a tabela já existe com RLS, é no-op.
ALTER TABLE pedido ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pedido_status      ON pedido(status);
CREATE INDEX IF NOT EXISTS idx_pedido_data_pedido ON pedido(data_pedido);
CREATE INDEX IF NOT EXISTS idx_pedido_data_prazo  ON pedido(data_prazo);

-- ─── pedido_item ─────────────────────────────────────────────────────────
-- `tipo = 'CORINGA'` é a peça sob medida, sem produto de catálogo: leva
-- descricao_custom e os dados de impressão direto no item.
--
-- As colunas *_snapshot, equipamento_id e materia_prima_id existem em
-- produção mas o código nunca as leu nem escreveu. Ficam aqui para o banco
-- novo ser igual ao de produção; podem ganhar uso na Fase 2 (calculadora
-- integrada ao pedido) ou ser removidas depois.

CREATE TABLE IF NOT EXISTS pedido_item (
  item_id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id               UUID        NOT NULL REFERENCES pedido(pedido_id) ON DELETE CASCADE,
  tipo                    TEXT        NOT NULL,

  modelo_id               UUID        REFERENCES modelo(modelo_id),
  descricao_custom        TEXT,

  tempo_impressao_min     INTEGER,
  peso_g                  NUMERIC(8,2),
  num_placas              INTEGER     DEFAULT 1,

  quantidade              INTEGER     NOT NULL DEFAULT 1,
  preco_venda_unit        NUMERIC(10,2),
  custo_unit              NUMERIC(10,2),

  observacao              TEXT,

  produto_codigo_snapshot TEXT,
  produto_nome_snapshot   TEXT,
  custo_unit_snapshot     NUMERIC(10,2),
  equipamento_id          UUID        REFERENCES config_equipamento(equipamento_id),
  materia_prima_id        UUID        REFERENCES config_materia_prima(materia_prima_id),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pedido_item ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pedido_item_pedido_id ON pedido_item(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_item_modelo_id ON pedido_item(modelo_id);
