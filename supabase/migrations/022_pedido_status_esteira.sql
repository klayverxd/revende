-- =============================================================
-- 022_pedido_status_esteira.sql — valores válidos de pedido, no banco
-- =============================================================
-- A esteira de produção vivia no Trello, com estas colunas:
--   ideias · orçamentos · a fazer · processo manual · mídia ·
--   a enviar/entregar · concluídos · cancelados
--
-- Três estados do fluxo real não tinham para onde ir e entram agora:
--   IDEIA     — anotação que talvez vire pedido. É o que se perdia.
--   ORCAMENTO — cotado e enviado ao cliente, aguardando resposta.
--   MIDIA     — pronto, mas ainda precisa de foto/vídeo antes de sair.
--
-- POR QUE CHECK E NÃO ENUM:
--   A primeira versão desta migration fazia ALTER TYPE num enum. A
--   conferência mostrou que em produção essas colunas são TEXT, sem
--   validação nenhuma — qualquer string era aceita. CHECK resolve as duas
--   coisas: valida no banco e, ao contrário de enum, permite remover um
--   valor depois (enum só cresce).
--
--   A lista oficial mora em src/modules/pedido/status.ts. O teste de
--   integração confere que o CHECK e o código têm exatamente os mesmos
--   valores — se um mudar sem o outro, `npm run test:db` falha.
--
-- SEGURANÇA, igual à 019: se já existir linha com valor fora da lista, o
-- CHECK NÃO é criado e sai um WARNING com os valores encontrados. Não usamos
-- NOT VALID porque, no PostgreSQL, uma linha antiga inválida passaria a
-- falhar em QUALQUER update — arrastar o card na esteira daria erro de
-- constraint sem explicação. Melhor corrigir o dado e rodar de novo.
-- =============================================================

DO $$
DECLARE
  r          RECORD;
  violacoes  INTEGER;
  exemplos   TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('pedido', 'status', 'pedido_status_check', ARRAY[
        'IDEIA', 'ORCAMENTO', 'NOVO', 'EM_MODELAGEM', 'AGUARDANDO_IMPRESSAO',
        'IMPRIMINDO', 'EM_ACABAMENTO', 'MIDIA', 'PRONTO', 'ENVIADO',
        'ENTREGUE', 'CANCELADO'
      ]),
      ('pedido', 'canal', 'pedido_canal_check', ARRAY[
        'PRESENCIAL', 'WHATSAPP', 'INSTAGRAM', 'SHOPEE'
      ]),
      ('pedido', 'prioridade', 'pedido_prioridade_check', ARRAY[
        'NORMAL', 'ALTA', 'URGENTE'
      ]),
      ('pedido', 'status_pagamento', 'pedido_status_pagamento_check', ARRAY[
        'PENDENTE', 'SINAL_RECEBIDO', 'PAGO'
      ]),
      ('pedido', 'forma_pagamento', 'pedido_forma_pagamento_check', ARRAY[
        'PIX', 'DINHEIRO', 'CARTAO', 'OUTRO'
      ]),
      ('pedido_item', 'tipo', 'pedido_item_tipo_check', ARRAY[
        'PRODUTO', 'CORINGA'
      ])
    ) AS v(tabela, coluna, nome, valores)
  LOOP
    -- Idempotente: rodar de novo não duplica nem falha.
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = r.nome AND conrelid = r.tabela::regclass
    ) THEN
      CONTINUE;
    END IF;

    -- NULL passa em CHECK por definição (forma_pagamento é opcional).
    EXECUTE format(
      'SELECT COUNT(*) FROM %I WHERE %I IS NOT NULL AND NOT (%I = ANY ($1))',
      r.tabela, r.coluna, r.coluna
    ) INTO violacoes USING r.valores;

    IF violacoes = 0 THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I = ANY (%L::text[]))',
        r.tabela, r.nome, r.coluna, r.valores
      );
      RAISE NOTICE '%.%: CHECK criado.', r.tabela, r.coluna;
    ELSE
      EXECUTE format(
        'SELECT string_agg(DISTINCT %I, '', '') FROM %I
         WHERE %I IS NOT NULL AND NOT (%I = ANY ($1))',
        r.coluna, r.tabela, r.coluna, r.coluna
      ) INTO exemplos USING r.valores;

      RAISE WARNING
        '%.%: % linha(s) com valor fora da lista (%) — CHECK NÃO criado. Corrija esses valores e rode esta migration de novo.',
        r.tabela, r.coluna, violacoes, exemplos;
    END IF;
  END LOOP;
END $$;
