-- =============================================================
-- 001_initial_schema.sql — Revendê
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- Enums
-- =============================================================

DO $$
BEGIN
  CREATE TYPE modelo_acerto_enum AS ENUM ('COMISSAO', 'VALOR_MINIMO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE envio_status_enum AS ENUM ('ABERTO', 'CONFERIDO', 'ENCERRADO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE preco_origem_enum AS ENUM ('MODELO', 'REVENDEDOR', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE modo_valor_enum AS ENUM ('CALCULADO', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE acerto_status_enum AS ENUM ('PENDENTE', 'RECEBIDO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE canal_venda_enum AS ENUM ('PRESENCIAL', 'WHATSAPP', 'FEIRA', 'EVENTO', 'INSTAGRAM', 'OUTRO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE forma_pagamento_enum AS ENUM ('PIX', 'DINHEIRO', 'CARTAO', 'OUTRO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================
-- Trigger function — auto-update updated_at
-- =============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- modelo
-- =============================================================

CREATE TABLE IF NOT EXISTS modelo (
  modelo_id        UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo           TEXT,
  nome             TEXT          NOT NULL,
  descricao        TEXT,
  custo_producao   NUMERIC(10,2),
  estoque_minimo   INTEGER       NOT NULL DEFAULT 0,
  ativo            BOOLEAN       NOT NULL DEFAULT TRUE,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_modelo_updated_at
  BEFORE UPDATE ON modelo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- modelo_preco
-- =============================================================

CREATE TABLE IF NOT EXISTS modelo_preco (
  preco_id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  modelo_id         UUID          NOT NULL REFERENCES modelo(modelo_id),
  rotulo            TEXT          NOT NULL,
  quantidade_minima INTEGER       NOT NULL DEFAULT 1,
  preco             NUMERIC(10,2) NOT NULL,
  eh_promocao       BOOLEAN       NOT NULL DEFAULT FALSE,
  ativo             BOOLEAN       NOT NULL DEFAULT TRUE,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modelo_preco_modelo_id ON modelo_preco(modelo_id);

CREATE OR REPLACE TRIGGER trg_modelo_preco_updated_at
  BEFORE UPDATE ON modelo_preco
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- revendedor
-- =============================================================

CREATE TABLE IF NOT EXISTS revendedor (
  revendedor_id  UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome           TEXT                  NOT NULL,
  telefone       TEXT,
  email          TEXT,
  endereco       TEXT,
  modelo_acerto  modelo_acerto_enum    NOT NULL DEFAULT 'COMISSAO',
  comissao_fixa  NUMERIC(10,2)         NOT NULL DEFAULT 0,
  comissao_pct   NUMERIC(5,4)          NOT NULL DEFAULT 0,  -- ex: 0.30 = 30%
  ativo          BOOLEAN               NOT NULL DEFAULT TRUE,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_revendedor_updated_at
  BEFORE UPDATE ON revendedor
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- revendedor_modelo_preco
-- =============================================================

CREATE TABLE IF NOT EXISTS revendedor_modelo_preco (
  rev_preco_id      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  revendedor_id     UUID          NOT NULL REFERENCES revendedor(revendedor_id),
  modelo_id         UUID          NOT NULL REFERENCES modelo(modelo_id),
  rotulo            TEXT          NOT NULL,
  quantidade_minima INTEGER       NOT NULL DEFAULT 1,
  preco             NUMERIC(10,2),           -- usado em COMISSAO
  valor_minimo      NUMERIC(10,2),           -- usado em VALOR_MINIMO
  eh_promocao       BOOLEAN       NOT NULL DEFAULT FALSE,
  ativo             BOOLEAN       NOT NULL DEFAULT TRUE,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rev_modelo_preco_revendedor ON revendedor_modelo_preco(revendedor_id);
CREATE INDEX IF NOT EXISTS idx_rev_modelo_preco_modelo     ON revendedor_modelo_preco(modelo_id);

CREATE OR REPLACE TRIGGER trg_rev_modelo_preco_updated_at
  BEFORE UPDATE ON revendedor_modelo_preco
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- envio
-- =============================================================

CREATE TABLE IF NOT EXISTS envio (
  envio_id       UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  revendedor_id  UUID                NOT NULL REFERENCES revendedor(revendedor_id),
  data_envio     DATE                NOT NULL DEFAULT CURRENT_DATE,
  status         envio_status_enum   NOT NULL DEFAULT 'ABERTO',
  observacao     TEXT,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_envio_revendedor_id ON envio(revendedor_id);
CREATE INDEX IF NOT EXISTS idx_envio_status        ON envio(status);

CREATE OR REPLACE TRIGGER trg_envio_updated_at
  BEFORE UPDATE ON envio
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- envio_item
-- Snapshots são imutáveis — alterações de preço não retroagem.
-- =============================================================

CREATE TABLE IF NOT EXISTS envio_item (
  envio_item_id      UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  envio_id           UUID                  NOT NULL REFERENCES envio(envio_id),
  modelo_id          UUID                  NOT NULL REFERENCES modelo(modelo_id),
  modelo_acerto      modelo_acerto_enum    NOT NULL,           -- snapshot
  qtd_enviada        INTEGER               NOT NULL,
  preco_unitario     NUMERIC(10,2),                            -- snapshot COMISSAO (1 unidade)
  preco_2mais        NUMERIC(10,2),                            -- snapshot COMISSAO (2+)
  valor_minimo_unit  NUMERIC(10,2),                            -- snapshot VALOR_MINIMO
  preco_origem       preco_origem_enum     NOT NULL,
  qtd_vendida        INTEGER,
  qtd_devolvida      INTEGER,
  valor_total_venda  NUMERIC(10,2),                            -- para COMISSAO
  valor_a_receber    NUMERIC(10,2),                            -- para VALOR_MINIMO
  preco_cliente      NUMERIC(10,2),                            -- quanto o revendedor cobrou (opcional)
  modo_valor         modo_valor_enum       NOT NULL DEFAULT 'CALCULADO',
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_envio_item_envio_id  ON envio_item(envio_id);
CREATE INDEX IF NOT EXISTS idx_envio_item_modelo_id ON envio_item(modelo_id);

CREATE OR REPLACE TRIGGER trg_envio_item_updated_at
  BEFORE UPDATE ON envio_item
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- acerto
-- =============================================================

CREATE TABLE IF NOT EXISTS acerto (
  acerto_id            UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  revendedor_id        UUID                  NOT NULL REFERENCES revendedor(revendedor_id),
  envio_id             UUID                  NOT NULL REFERENCES envio(envio_id),
  modelo_acerto        modelo_acerto_enum    NOT NULL,
  comissao_calculada   NUMERIC(10,2),        -- para COMISSAO
  valor_liquido        NUMERIC(10,2),        -- para COMISSAO (valor_total_venda - comissao)
  valor_a_receber      NUMERIC(10,2),        -- para VALOR_MINIMO
  valor_repassado      NUMERIC(10,2),        -- quanto o revendedor efetivamente pagou
  status               acerto_status_enum    NOT NULL DEFAULT 'PENDENTE',
  data_recebimento     DATE,
  observacao           TEXT,
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_acerto_envio_id_unique ON acerto(envio_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_acerto_revendedor_id ON acerto(revendedor_id);
CREATE INDEX IF NOT EXISTS idx_acerto_status        ON acerto(status);

CREATE OR REPLACE TRIGGER trg_acerto_updated_at
  BEFORE UPDATE ON acerto
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- producao
-- =============================================================

CREATE TABLE IF NOT EXISTS producao (
  producao_id    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  modelo_id      UUID          NOT NULL REFERENCES modelo(modelo_id),
  quantidade     INTEGER       NOT NULL,
  custo_unitario NUMERIC(10,2),
  data_producao  DATE          NOT NULL DEFAULT CURRENT_DATE,
  observacao     TEXT,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_producao_modelo_id ON producao(modelo_id);

CREATE OR REPLACE TRIGGER trg_producao_updated_at
  BEFORE UPDATE ON producao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- venda_direta
-- =============================================================

CREATE TABLE IF NOT EXISTS venda_direta (
  venda_id          UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_venda        DATE                    NOT NULL DEFAULT CURRENT_DATE,
  canal             canal_venda_enum        NOT NULL,
  forma_pagamento   forma_pagamento_enum    NOT NULL,
  desconto          NUMERIC(10,2)           NOT NULL DEFAULT 0,
  valor_total       NUMERIC(10,2)           NOT NULL,
  observacao        TEXT,
  cliente_nome      TEXT,
  cliente_contato   TEXT,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venda_direta_data_venda ON venda_direta(data_venda);

CREATE OR REPLACE TRIGGER trg_venda_direta_updated_at
  BEFORE UPDATE ON venda_direta
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- venda_direta_item
-- =============================================================

CREATE TABLE IF NOT EXISTS venda_direta_item (
  item_id          UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id         UUID                NOT NULL REFERENCES venda_direta(venda_id),
  modelo_id        UUID                NOT NULL REFERENCES modelo(modelo_id),
  quantidade       INTEGER             NOT NULL,
  preco_unitario   NUMERIC(10,2)       NOT NULL,
  preco_origem     preco_origem_enum   NOT NULL,
  subtotal         NUMERIC(10,2)       NOT NULL,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venda_direta_item_venda_id  ON venda_direta_item(venda_id);
CREATE INDEX IF NOT EXISTS idx_venda_direta_item_modelo_id ON venda_direta_item(modelo_id);

CREATE OR REPLACE TRIGGER trg_venda_direta_item_updated_at
  BEFORE UPDATE ON venda_direta_item
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- config_equipamento
-- =============================================================

CREATE TABLE IF NOT EXISTS config_equipamento (
  equipamento_id    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome              TEXT          NOT NULL,
  potencia_watts    NUMERIC(10,2) NOT NULL,
  depreciacao_hora  NUMERIC(10,4) NOT NULL DEFAULT 0,
  ativa             BOOLEAN       NOT NULL DEFAULT TRUE,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_config_equipamento_updated_at
  BEFORE UPDATE ON config_equipamento
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- config_materia_prima
-- =============================================================

CREATE TABLE IF NOT EXISTS config_materia_prima (
  materia_prima_id   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome               TEXT          NOT NULL,
  preco_por_unidade  NUMERIC(10,4) NOT NULL,
  unidade_medida     TEXT          NOT NULL,
  ativo              BOOLEAN       NOT NULL DEFAULT TRUE,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_config_materia_prima_updated_at
  BEFORE UPDATE ON config_materia_prima
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- config_energia  (registro único — usar upsert)
-- =============================================================

CREATE TABLE IF NOT EXISTS config_energia (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  preco_kwh    NUMERIC(10,4) NOT NULL,
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_config_energia_updated_at
  BEFORE UPDATE ON config_energia
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- calculo_custo
-- =============================================================

CREATE TABLE IF NOT EXISTS calculo_custo (
  calculo_id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipamento_id          UUID          REFERENCES config_equipamento(equipamento_id),
  tempo_impressao_min     NUMERIC(10,2) NOT NULL,
  -- JSON: [{ "materia_prima_id": "uuid", "quantidade": 1.5 }, ...]
  materias_primas         JSONB         NOT NULL DEFAULT '[]',
  pct_falhas              NUMERIC(5,4)  NOT NULL DEFAULT 0,
  custo_energia           NUMERIC(10,4),
  custo_materias_primas   NUMERIC(10,4),
  custo_depreciacao       NUMERIC(10,4),
  custo_falhas            NUMERIC(10,4),
  custo_total             NUMERIC(10,4),
  quantidade              INTEGER       NOT NULL DEFAULT 1,
  custo_unitario          NUMERIC(10,4),
  salvo_em_modelo_id      UUID          REFERENCES modelo(modelo_id),
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calculo_custo_modelo_id ON calculo_custo(salvo_em_modelo_id);

CREATE OR REPLACE TRIGGER trg_calculo_custo_updated_at
  BEFORE UPDATE ON calculo_custo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- Row Level Security — acesso restrito ao usuário autenticado
-- =============================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'modelo','modelo_preco','revendedor','revendedor_modelo_preco',
      'envio','envio_item','acerto','producao',
      'venda_direta','venda_direta_item',
      'config_equipamento','config_materia_prima','config_energia','calculo_custo'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "Authenticated full access" ON %I
       FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END;
$$;
