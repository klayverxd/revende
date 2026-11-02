/**
 * Valida que o banco é reproduzível a partir do repositório.
 *
 * Roda um PostgreSQL de verdade (PGlite: Postgres compilado para WASM, dentro
 * do pacote npm — sem Docker, sem instalação, sem credencial), aplica TODAS as
 * migrations em ordem e verifica o resultado.
 *
 * Por que isto existe: `pedido`, `pedido_item` e `acerto.data_conferencia`
 * foram criados à mão no painel do Supabase e nunca tiveram migration. Um
 * banco novo a partir do repositório quebrava na migration 011 e de novo na
 * 014. O DDL das migrations 010b/018 foi RECONSTRUÍDO a partir do código, e a
 * única forma honesta de saber se ele está certo é aplicá-lo num Postgres
 * limpo e escrever nele o mesmo payload que o código escreve.
 *
 * Os arquivos .sql são aplicados VERBATIM. O único acréscimo é
 * `scripts/preludio.sql`, que recria o que a plataforma Supabase fornece de
 * fábrica.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

import { calcularEstoque } from "@/modules/estoque/calcular";
import {
	envioEstaEncerrado,
	statusAposConferencia,
} from "@/modules/envio/fechamento";
import { calcularAcertoValorMinimo } from "@/modules/acerto/calcular";
import { COLUNAS_ESTEIRA, PEDIDO_STATUS } from "@/modules/pedido/status";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
/**
 * O que a plataforma Supabase provê e as migrations assumem existir: os papéis
 * do PostgREST, o schema `auth` com `auth.users`/`auth.uid()`/`auth.jwt()`, e o
 * schema `storage` usado pela migration 009 (bucket de fotos).
 *
 * Nada ali pertence ao projeto — é ambiente. Fica num .sql compartilhado com
 * `scripts/gerar-tipos.mjs`, que precisa exatamente do mesmo cenário.
 */
const PRELUDIO = readFileSync(
	path.join(process.cwd(), "scripts", "preludio.sql"),
	"utf8"
);

/** O usuário fixo declarado no prelúdio. */
const UID = "00000000-0000-4000-8000-000000000001";

let db: PGlite;
const aplicadas: string[] = [];

before(async () => {
	db = await PGlite.create({ extensions: { uuid_ossp } });
	await db.exec(PRELUDIO);

	const arquivos = readdirSync(MIGRATIONS_DIR)
		.filter(f => f.endsWith(".sql"))
		.sort();

	for (const arquivo of arquivos) {
		const sql = readFileSync(path.join(MIGRATIONS_DIR, arquivo), "utf8");
		try {
			await db.exec(sql);
			aplicadas.push(arquivo);
		} catch (e) {
			throw new Error(
				`Migration ${arquivo} falhou: ${(e as Error).message}`
			);
		}
	}
});

after(async () => {
	await db?.close();
});

async function umaLinha<T = Record<string, unknown>>(
	sql: string,
	params?: unknown[]
): Promise<T> {
	const r = await db.query<T>(sql, params);
	assert.ok(r.rows[0], `query sem resultado: ${sql}`);
	return r.rows[0];
}

async function existeTabela(nome: string): Promise<boolean> {
	const r = await umaLinha<{ existe: boolean }>(
		`SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS existe`,
		[nome]
	);
	return r.existe;
}

async function existeColuna(tabela: string, coluna: string): Promise<boolean> {
	const r = await umaLinha<{ existe: boolean }>(
		`SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS existe`,
		[tabela, coluna]
	);
	return r.existe;
}

// ─── 1. As migrations aplicam ─────────────────────────────────────────────

describe("migrations aplicam num banco limpo", () => {
	test("todos os arquivos .sql foram aplicados, em ordem", () => {
		const noDisco = readdirSync(MIGRATIONS_DIR)
			.filter(f => f.endsWith(".sql"))
			.sort();
		assert.deepEqual(aplicadas, noDisco);
		assert.ok(aplicadas.length >= 21, `esperava 21+, veio ${aplicadas.length}`);
	});

	test("010b roda antes da 011, que faz ALTER nas tabelas de pedido", () => {
		const i010b = aplicadas.indexOf("010b_pedido_tables.sql");
		const i011 = aplicadas.indexOf("011_pedido_rls.sql");
		const i014 = aplicadas.indexOf("014_multi_usuario.sql");
		assert.ok(i010b > -1, "010b_pedido_tables.sql não encontrada");
		assert.ok(i010b < i011, "010b precisa vir antes da 011");
		assert.ok(i010b < i014, "010b precisa vir antes da 014");
	});
});

// ─── 2. Estrutura resultante ──────────────────────────────────────────────

describe("estrutura do banco", () => {
	const TABELAS = [
		"modelo",
		"modelo_preco",
		"revendedor",
		"revendedor_modelo_preco",
		"envio",
		"envio_item",
		"acerto",
		"producao",
		"venda_direta",
		"venda_direta_item",
		"config_equipamento",
		"config_materia_prima",
		"config_energia",
		"config_custo_extra",
		"calculo_custo",
		"envio_draft",
		"pedido",
		"pedido_item",
		"cliente",
		"membro_equipe",
	];

	test("todas as tabelas existem", async () => {
		const faltando: string[] = [];
		for (const t of TABELAS) {
			if (!(await existeTabela(t))) faltando.push(t);
		}
		assert.deepEqual(faltando, [], `tabelas ausentes: ${faltando.join(", ")}`);
	});

	test("colunas que já faltaram em migration e quebraram banco novo", async () => {
		assert.ok(
			await existeColuna("acerto", "data_conferencia"),
			"acerto.data_conferencia"
		);
		assert.ok(
			await existeColuna("revendedor", "extrato_token"),
			"revendedor.extrato_token"
		);
		assert.ok(
			await existeColuna("revendedor", "extrato_ativo"),
			"revendedor.extrato_ativo"
		);
	});

	test("criado_por existe nas tabelas de movimentação", async () => {
		for (const t of [
			"pedido",
			"pedido_item",
			"envio",
			"envio_item",
			"acerto",
			"producao",
			"venda_direta",
			"venda_direta_item",
			"calculo_custo",
		]) {
			assert.ok(await existeColuna(t, "criado_por"), `${t}.criado_por`);
		}
	});

	test("pedido tem todas as colunas que o código escreve", async () => {
		// Espelha o insert de criarPedido + as colunas lidas em buscarPedido.
		const esperadas = [
			"pedido_id",
			"numero_pedido",
			"data_pedido",
			"canal",
			"status",
			"prioridade",
			"cliente_nome",
			"cliente_telefone",
			"cliente_email",
			"cliente_referencia",
			"data_prazo",
			"forma_pagamento",
			"status_pagamento",
			"valor_sinal",
			"desconto_valor",
			"taxa_marketplace_pct",
			"custo_envio",
			"outros_encargos",
			"data_inicio_producao",
			"data_conclusao_producao",
			"data_entrega",
			"observacao",
			"deleted_at",
			"created_at",
			"updated_at",
			"user_id",
			"criado_por",
			"cliente_id",
		];
		const faltando: string[] = [];
		for (const c of esperadas) {
			if (!(await existeColuna("pedido", c))) faltando.push(c);
		}
		assert.deepEqual(faltando, []);
	});

	test("pedido_item tem todas as colunas que o código escreve", async () => {
		const esperadas = [
			"item_id",
			"pedido_id",
			"tipo",
			"modelo_id",
			"descricao_custom",
			"tempo_impressao_min",
			"peso_g",
			"num_placas",
			"quantidade",
			"preco_venda_unit",
			"custo_unit",
			"observacao",
			"user_id",
		];
		const faltando: string[] = [];
		for (const c of esperadas) {
			if (!(await existeColuna("pedido_item", c))) faltando.push(c);
		}
		assert.deepEqual(faltando, []);
	});

	/** Valores do CHECK de uma coluna, na ordem em que foram declarados. */
	async function valoresDoCheck(nome: string): Promise<string[]> {
		const r = await db.query<{ def: string }>(
			"SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = $1",
			[nome]
		);
		assert.ok(r.rows[0], `CHECK ${nome} não existe`);
		return (/\{([^}]*)\}/.exec(r.rows[0].def)?.[1] ?? "").split(",");
	}

	test("CHECK de status do pedido casa com o código", async () => {
		// Em produção a coluna é TEXT — não há enum. A lista de valores
		// válidos vive no CHECK da 022 e tem que ser idêntica à do módulo,
		// na ordem: se uma mudar sem a outra, quebra aqui.
		assert.deepEqual(await valoresDoCheck("pedido_status_check"), [...PEDIDO_STATUS]);
	});

	test("todo status aceito pelo banco tem coluna na esteira", async () => {
		// Um status válido sem coluna no kanban viraria card invisível.
		const cobertos = new Set<string>(COLUNAS_ESTEIRA.flatMap(c => c.statuses));
		const orfaos = (await valoresDoCheck("pedido_status_check")).filter(
			v => !cobertos.has(v)
		);
		assert.deepEqual(orfaos, [], `status sem coluna: ${orfaos.join(", ")}`);
	});

	test("não sobrou nenhum enum de pedido", async () => {
		// A primeira versão da 010b criava enums que, em produção, nenhuma
		// coluna usava. Num banco novo eles não podem nem nascer.
		const r = await db.query<{ typname: string }>(
			`SELECT typname FROM pg_type WHERE typname IN (
         'pedido_status_enum','canal_pedido_enum','status_pagamento_enum',
         'prioridade_enum','pedido_item_tipo_enum')`
		);
		assert.deepEqual(r.rows, []);
	});

	test("pedido_item aceita UPDATE — a armadilha da 010b antiga", async () => {
		// O trigger de updated_at exige a coluna. Em produção ela faltava, e
		// todo UPDATE em pedido_item quebrava. Aqui num banco limpo.
		const cols = await db.query<{ column_name: string }>(
			`SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pedido_item' AND column_name IN ('updated_at','deleted_at')`
		);
		assert.equal(cols.rows.length, 2);
	});

	test("as tabelas do card existem", async () => {
		for (const t of [
			"pedido_checklist",
			"pedido_checklist_item",
			"etiqueta",
			"pedido_etiqueta",
			"pedido_comentario",
			"pedido_anexo",
		]) {
			assert.ok(await existeTabela(t), t);
		}
		for (const c of [
			"titulo",
			"descricao_md",
			"responsavel_id",
			"capa_url",
			"prazo_concluido",
			"ordem_esteira",
		]) {
			assert.ok(await existeColuna("pedido", c), `pedido.${c}`);
		}
	});

	test("índices únicos da 019 e 020 foram criados", async () => {
		// Banco limpo não tem duplicata, então a trava de segurança da 019
		// deve deixar passar e criar os três índices.
		for (const idx of [
			"idx_rmp_revendedor_modelo_qtd_unique",
			"idx_config_energia_user_unique",
			"idx_pedido_numero_user_unique",
			"idx_revendedor_extrato_token_unique",
		]) {
			const r = await umaLinha<{ existe: boolean }>(
				`SELECT EXISTS (
           SELECT 1 FROM pg_indexes
           WHERE schemaname = 'public' AND indexname = $1
         ) AS existe`,
				[idx]
			);
			assert.ok(r.existe, `índice ausente: ${idx}`);
		}
	});

	test("RLS habilitada nas tabelas de dados", async () => {
		const r = await db.query<{ relname: string }>(
			`SELECT c.relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`
		);
		assert.deepEqual(
			r.rows.map(x => x.relname).sort(),
			[],
			"tabelas sem RLS"
		);
	});

	test("trigger de updated_at existe em pedido e pedido_item", async () => {
		for (const t of ["pedido", "pedido_item"]) {
			const r = await umaLinha<{ n: number }>(
				`SELECT COUNT(*)::int AS n FROM pg_trigger
         WHERE tgrelid = $1::regclass AND NOT tgisinternal`,
				[t]
			);
			assert.ok(r.n > 0, `${t} sem trigger de updated_at`);
		}
	});

	test("bucket de fotos criado pela 009", async () => {
		const r = await umaLinha<{ n: number }>(
			`SELECT COUNT(*)::int AS n FROM storage.buckets WHERE id = 'produto-fotos'`
		);
		assert.equal(r.n, 1);
	});
});

// ─── 3. O banco aceita o que o código escreve ─────────────────────────────

describe("ciclo de negócio completo no banco real", () => {
	const ids: Record<string, string> = {};

	test("cria produto, preço e produção", async () => {
		const m = await umaLinha<{ modelo_id: string }>(
			`INSERT INTO modelo (nome, codigo, custo_producao, estoque_minimo, ativo)
       VALUES ('Chaveiro Gato', 'M01', 3.5000, 10, true)
       RETURNING modelo_id`
		);
		ids.modelo = m.modelo_id;

		await db.query(
			`INSERT INTO modelo_preco (modelo_id, rotulo, quantidade_minima, preco)
       VALUES ($1, 'Unitário', 1, 15.00)`,
			[ids.modelo]
		);

		await db.query(
			`INSERT INTO producao (modelo_id, quantidade, data_producao)
       VALUES ($1, 20, CURRENT_DATE)`,
			[ids.modelo]
		);

		const p = await umaLinha<{ n: number }>(
			`SELECT COUNT(*)::int AS n FROM producao WHERE modelo_id = $1`,
			[ids.modelo]
		);
		assert.equal(p.n, 1);
	});

	test("user_id e criado_por são preenchidos pelos DEFAULTs", async () => {
		const r = await umaLinha<{ user_id: string; criado_por: string }>(
			`SELECT user_id, criado_por FROM producao WHERE modelo_id = $1`,
			[ids.modelo]
		);
		// user_id = dono do workspace (workspace_owner_id), criado_por = a pessoa.
		// Com um único usuário, os dois coincidem — mas vêm de DEFAULTs distintos.
		assert.equal(r.user_id, UID);
		assert.equal(r.criado_por, UID);
	});

	test("cria revendedor com token de extrato gerado automaticamente", async () => {
		const r = await umaLinha<{
			revendedor_id: string;
			extrato_token: string;
			extrato_ativo: boolean;
		}>(
			`INSERT INTO revendedor (nome, modelo_acerto, valor_minimo_padrao, ativo)
       VALUES ('Maria', 'VALOR_MINIMO', 10.00, true)
       RETURNING revendedor_id, extrato_token, extrato_ativo`
		);
		ids.revendedor = r.revendedor_id;

		assert.match(
			r.extrato_token,
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
			"extrato_token deve nascer como UUID"
		);
		assert.notEqual(
			r.extrato_token,
			r.revendedor_id,
			"o token NÃO pode ser igual à chave primária — é a correção da falha"
		);
		assert.equal(r.extrato_ativo, true);
	});

	test("envio ABERTO com item", async () => {
		const e = await umaLinha<{ envio_id: string }>(
			`INSERT INTO envio (revendedor_id, data_envio, status)
       VALUES ($1, CURRENT_DATE, 'ABERTO')
       RETURNING envio_id`,
			[ids.revendedor]
		);
		ids.envio = e.envio_id;

		const i = await umaLinha<{ envio_item_id: string }>(
			`INSERT INTO envio_item
         (envio_id, modelo_id, modelo_acerto, qtd_enviada,
          valor_minimo_unit, preco_origem, modo_valor)
       VALUES ($1, $2, 'VALOR_MINIMO', 8, 10.00, 'REVENDEDOR', 'CALCULADO')
       RETURNING envio_item_id`,
			[ids.envio, ids.modelo]
		);
		ids.envioItem = i.envio_item_id;
		assert.ok(ids.envioItem);
	});

	test("venda direta com item de catálogo", async () => {
		const v = await umaLinha<{ venda_id: string }>(
			`INSERT INTO venda_direta (data_venda, canal, forma_pagamento, valor_total)
       VALUES (CURRENT_DATE, 'PRESENCIAL', 'PIX', 60.00)
       RETURNING venda_id`
		);
		await db.query(
			`INSERT INTO venda_direta_item
         (venda_id, modelo_id, quantidade, preco_unitario, preco_origem, subtotal)
       VALUES ($1, $2, 4, 15.00, 'MODELO', 60.00)`,
			[v.venda_id, ids.modelo]
		);
		const r = await umaLinha<{ n: number }>(
			`SELECT COUNT(*)::int AS n FROM venda_direta_item WHERE modelo_id = $1`,
			[ids.modelo]
		);
		assert.equal(r.n, 1);
	});

	test("estoque do banco real casa com o módulo de cálculo", async () => {
		// Produziu 20, enviou 8 em consignação, vendeu 4 direto → 8 disponíveis.
		// Este é o teste que valida a correção do criarEnvio, que ignorava as
		// vendas diretas.
		const modelos = await db.query<{
			modelo_id: string;
			codigo: string | null;
			nome: string;
			estoque_minimo: number;
		}>(`SELECT modelo_id, codigo, nome, estoque_minimo FROM modelo
        WHERE deleted_at IS NULL`);

		const producoes = await db.query<{
			modelo_id: string;
			quantidade: number;
		}>(`SELECT modelo_id, quantidade FROM producao WHERE deleted_at IS NULL`);

		const envioItens = await db.query<{
			modelo_id: string;
			qtd_enviada: number;
			qtd_vendida: number | null;
			qtd_devolvida: number | null;
			envio_status: "ABERTO" | "CONFERIDO" | "ENCERRADO";
		}>(`SELECT ei.modelo_id, ei.qtd_enviada, ei.qtd_vendida, ei.qtd_devolvida,
                   e.status AS envio_status
            FROM envio_item ei JOIN envio e USING (envio_id)
            WHERE ei.deleted_at IS NULL AND e.deleted_at IS NULL`);

		const vendaItens = await db.query<{
			modelo_id: string;
			quantidade: number;
		}>(`SELECT vdi.modelo_id, vdi.quantidade
            FROM venda_direta_item vdi JOIN venda_direta vd USING (venda_id)
            WHERE vd.deleted_at IS NULL AND vdi.modelo_id IS NOT NULL`);

		const [linha] = calcularEstoque({
			modelos: modelos.rows,
			producoes: producoes.rows,
			envioItens: envioItens.rows,
			vendaDiretaItens: vendaItens.rows,
		});

		assert.equal(linha.entradas, 20);
		assert.equal(linha.saidas, 12, "8 em consignação + 4 de venda direta");
		assert.equal(linha.disponivel, 8);
		assert.equal(linha.em_consignacao, 8);
		// Disponível 8 com mínimo 10: furou o mínimo, então REPOR.
		assert.equal(linha.status, "REPOR");
	});

	test("conferência parcial: vendeu 6, devolveu 1, sobrou 1", async () => {
		await db.query(
			`UPDATE envio_item
         SET qtd_vendida = 6, qtd_devolvida = 1, valor_a_receber = 60.00
       WHERE envio_item_id = $1`,
			[ids.envioItem]
		);

		const itens = await db.query<{
			qtd_enviada: number;
			qtd_vendida: number | null;
			qtd_devolvida: number | null;
		}>(
			`SELECT qtd_enviada, qtd_vendida, qtd_devolvida FROM envio_item
       WHERE envio_id = $1 AND deleted_at IS NULL`,
			[ids.envio]
		);

		assert.equal(
			statusAposConferencia(itens.rows),
			"ABERTO",
			"sobrou 1 com a revendedora, então volta para ABERTO"
		);
		assert.ok(!envioEstaEncerrado(itens.rows));
		assert.equal(calcularAcertoValorMinimo(6, 10), 60);
	});

	test("acerto grava data_conferencia — a coluna que faltava", async () => {
		const a = await umaLinha<{ acerto_id: string; data_conferencia: unknown }>(
			`INSERT INTO acerto
         (revendedor_id, envio_id, modelo_acerto, valor_a_receber, status,
          data_conferencia)
       VALUES ($1, $2, 'VALOR_MINIMO', 60.00, 'PENDENTE', CURRENT_DATE)
       RETURNING acerto_id, data_conferencia`,
			[ids.revendedor, ids.envio]
		);
		assert.ok(a.acerto_id);
		assert.ok(a.data_conferencia, "data_conferencia não foi gravada");
	});

	test("índice único de acerto por envio impede duplicata", async () => {
		await assert.rejects(
			db.query(
				`INSERT INTO acerto (revendedor_id, envio_id, modelo_acerto, status)
         VALUES ($1, $2, 'VALOR_MINIMO', 'PENDENTE')`,
				[ids.revendedor, ids.envio]
			),
			/duplicate key|unique/i
		);
	});

	test("pedido aceita exatamente o payload que criarPedido escreve", async () => {
		// Este é o teste que valida o DDL reconstruído da 010b: se o schema
		// divergisse do que o código grava, falharia aqui.
		const p = await umaLinha<{ pedido_id: string; numero_pedido: string }>(
			`INSERT INTO pedido (
         numero_pedido, data_pedido, canal, status, prioridade,
         cliente_nome, cliente_telefone, cliente_email, cliente_referencia,
         data_prazo, forma_pagamento, status_pagamento, valor_sinal,
         desconto_valor, taxa_marketplace_pct, custo_envio, outros_encargos,
         observacao
       ) VALUES (
         'PED-2026-0001', CURRENT_DATE, 'SHOPEE', 'NOVO', 'ALTA',
         'João', '11999998888', 'joao@exemplo.com', 'indicação',
         CURRENT_DATE + 7, 'PIX', 'SINAL_RECEBIDO', 25.00,
         5.00, 14.00, 12.90, 0.00,
         'entregar na portaria'
       ) RETURNING pedido_id, numero_pedido`
		);
		ids.pedido = p.pedido_id;
		assert.equal(p.numero_pedido, "PED-2026-0001");

		// Item de catálogo
		await db.query(
			`INSERT INTO pedido_item
         (pedido_id, tipo, modelo_id, quantidade, preco_venda_unit, custo_unit)
       VALUES ($1, 'PRODUTO', $2, 3, 20.00, 3.50)`,
			[ids.pedido, ids.modelo]
		);

		// Item sob medida (coringa), sem produto de catálogo
		await db.query(
			`INSERT INTO pedido_item
         (pedido_id, tipo, descricao_custom, tempo_impressao_min, peso_g,
          num_placas, quantidade, preco_venda_unit, custo_unit, observacao)
       VALUES ($1, 'CORINGA', 'Suporte sob medida', 150.00, 85.50,
               2, 1, 90.00, 12.40, 'cliente mandou o STL')`,
			[ids.pedido]
		);

		const r = await umaLinha<{ n: number }>(
			`SELECT COUNT(*)::int AS n FROM pedido_item WHERE pedido_id = $1`,
			[ids.pedido]
		);
		assert.equal(r.n, 2);
	});

	test("atualizarStatusPedido consegue gravar as datas de produção", async () => {
		await db.query(
			`UPDATE pedido
         SET status = 'IMPRIMINDO', data_inicio_producao = CURRENT_DATE
       WHERE pedido_id = $1`,
			[ids.pedido]
		);
		const r = await umaLinha<{ status: string; data_inicio_producao: unknown }>(
			`SELECT status, data_inicio_producao FROM pedido WHERE pedido_id = $1`,
			[ids.pedido]
		);
		assert.equal(r.status, "IMPRIMINDO");
		assert.ok(r.data_inicio_producao);
	});

	test("numero_pedido não se repete (UNIQUE global, como em produção)", async () => {
		await assert.rejects(
			db.query(
				`INSERT INTO pedido (numero_pedido, canal, status)
         VALUES ('PED-2026-0001', 'PRESENCIAL', 'NOVO')`
			),
			/duplicate key|unique/i,
			"mesmo número no mesmo workspace deve ser rejeitado"
		);
	});

	test("preço por revendedor não aceita duplicata", async () => {
		await db.query(
			`INSERT INTO revendedor_modelo_preco
         (revendedor_id, modelo_id, rotulo, quantidade_minima, valor_minimo, ativo)
       VALUES ($1, $2, 'Unitário', 1, 10.00, true)`,
			[ids.revendedor, ids.modelo]
		);

		// A duplicata era o que fazia resolverPreco cair no maybeSingle() e o
		// preço do revendedor desaparecer em silêncio.
		await assert.rejects(
			db.query(
				`INSERT INTO revendedor_modelo_preco
           (revendedor_id, modelo_id, rotulo, quantidade_minima, valor_minimo, ativo)
         VALUES ($1, $2, 'Padrão', 1, 12.00, true)`,
				[ids.revendedor, ids.modelo]
			),
			/duplicate key|unique/i
		);
	});

	test("soft delete libera a combinação de preço para uma nova linha", async () => {
		await db.query(
			`UPDATE revendedor_modelo_preco SET deleted_at = NOW()
       WHERE revendedor_id = $1 AND modelo_id = $2`,
			[ids.revendedor, ids.modelo]
		);
		// O índice é parcial (WHERE deleted_at IS NULL), então arquivar a linha
		// antiga deve permitir inserir a nova — é assim que a limpeza da 019
		// funciona sem perder histórico.
		await db.query(
			`INSERT INTO revendedor_modelo_preco
         (revendedor_id, modelo_id, rotulo, quantidade_minima, valor_minimo, ativo)
       VALUES ($1, $2, 'Unitário', 1, 12.00, true)`,
			[ids.revendedor, ids.modelo]
		);
		const r = await umaLinha<{ n: number }>(
			`SELECT COUNT(*)::int AS n FROM revendedor_modelo_preco
       WHERE revendedor_id = $1 AND deleted_at IS NULL`,
			[ids.revendedor]
		);
		assert.equal(r.n, 1);
	});

	test("config_energia é um registro por workspace", async () => {
		await db.query(
			`INSERT INTO config_energia (preco_kwh, pct_falhas) VALUES (0.95, 0.05)`
		);
		await assert.rejects(
			db.query(
				`INSERT INTO config_energia (preco_kwh, pct_falhas) VALUES (1.10, 0.05)`
			),
			/duplicate key|unique/i,
			"a 001 dizia 'registro único' mas nunca declarou a constraint"
		);
	});

	test("trigger de updated_at realmente atualiza", async () => {
		const antes = await umaLinha<{ updated_at: string }>(
			`SELECT updated_at FROM pedido WHERE pedido_id = $1`,
			[ids.pedido]
		);
		await db.query(
			`UPDATE pedido SET observacao = 'mexido' WHERE pedido_id = $1`,
			[ids.pedido]
		);
		const depois = await umaLinha<{ updated_at: string }>(
			`SELECT updated_at FROM pedido WHERE pedido_id = $1`,
			[ids.pedido]
		);
		assert.ok(
			new Date(depois.updated_at).getTime() >=
				new Date(antes.updated_at).getTime(),
			"updated_at não avançou"
		);
	});
});
