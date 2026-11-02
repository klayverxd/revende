/**
 * Simula o caminho que o banco de PRODUÇÃO percorre — não o de um banco novo.
 *
 * `migrations.test.ts` valida que um Postgres limpo aceita todas as
 * migrations. Isso não basta: a produção tem história própria. As tabelas
 * `pedido` e `pedido_item` foram criadas à mão no Table Editor (TEXT, sem
 * enum, sem CHECK), havia um trigger feito à mão, e a PRIMEIRA versão da
 * 010b — que assumia enums e DATE — chegou a ser executada lá.
 *
 * Essa primeira versão deixou uma armadilha: um trigger que escreve
 * `NEW.updated_at` num `pedido_item` que não tinha essa coluna. Todo UPDATE
 * na tabela passou a falhar. Este teste reproduz o estado exato e prova que
 * a 017b desarma o problema antes das migrations seguintes.
 *
 * O estado de produção vem de `supabase/consultas/conferir_producao_*.sql`,
 * executada no banco real. A versão da 010b que rodou lá está guardada em
 * `fixtures/010b_versao_aplicada_em_producao.sql`, como registro.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

import { PEDIDO_STATUS } from "@/modules/pedido/status";

const RAIZ = process.cwd();
const MIGRATIONS = path.join(RAIZ, "supabase", "migrations");
const PRELUDIO = readFileSync(path.join(RAIZ, "scripts", "preludio.sql"), "utf8");
const V010B_PRODUCAO = readFileSync(
	path.join(RAIZ, "tests", "integration", "fixtures", "010b_versao_aplicada_em_producao.sql"),
	"utf8"
);

/** Objetos que a conferência encontrou em produção e que não vêm de migration. */
const CRIADO_A_MAO = `
CREATE OR REPLACE FUNCTION trigger_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER set_updated_at_pedido
  BEFORE UPDATE ON pedido
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
`;

/**
 * Divergências fora de `pedido` que a conferência completa também achou:
 * coluna criada à mão em `modelo` e default ausente em `membro_equipe`.
 */
const DIVERGENCIAS_DEMAIS = `
ALTER TABLE membro_equipe ALTER COLUMN dono_id DROP DEFAULT;
ALTER TABLE modelo ADD COLUMN is_coringa BOOLEAN NOT NULL DEFAULT FALSE;
`;

const arquivos = readdirSync(MIGRATIONS).filter(f => f.endsWith(".sql")).sort();
const antesDe010b = arquivos.filter(f => f < "010b");
const de011a017 = arquivos.filter(f => f > "010b" && f < "017b");
const migration017b = arquivos.filter(f => f.startsWith("017b"));
const depoisDe017b = arquivos.filter(f => f > "017b");
const NOVA_010B = arquivos.find(f => f.startsWith("010b"))!;

async function aplicar(db: PGlite, lista: string[]) {
	for (const f of lista) {
		try {
			await db.exec(readFileSync(path.join(MIGRATIONS, f), "utf8"));
		} catch (e) {
			throw new Error(`${f} falhou: ${(e as Error).message}`);
		}
	}
}

/**
 * Monta o banco no estado em que a produção estava IMEDIATAMENTE ANTES da
 * 017b: tabelas do Table Editor + 011..017 + a 010b antiga já executada.
 */
async function bancoComoProducao(
	semear?: (db: PGlite) => Promise<void>
): Promise<PGlite> {
	const db = await PGlite.create({ extensions: { uuid_ossp } });
	await db.exec(PRELUDIO);
	await aplicar(db, antesDe010b);

	// A 010b atual descreve as tabelas como existem em produção; aqui ela faz
	// o papel de "alguém criou no Table Editor".
	await aplicar(db, [NOVA_010B]);
	await db.exec(CRIADO_A_MAO);
	await aplicar(db, de011a017);
	await db.exec(DIVERGENCIAS_DEMAIS);

	if (semear) await semear(db);

	// O que de fato foi executado em produção.
	await db.exec(V010B_PRODUCAO);
	return db;
}

async function semearPedidoValido(db: PGlite) {
	await db.exec(`
		INSERT INTO pedido (pedido_id, numero_pedido, canal, status, prioridade)
		VALUES ('11111111-1111-4111-8111-111111111111', 'PED-2026-0001',
		        'WHATSAPP', 'IMPRIMINDO', 'NORMAL');
		INSERT INTO pedido_item (item_id, pedido_id, tipo, quantidade, preco_venda_unit)
		VALUES ('22222222-2222-4222-8222-222222222222',
		        '11111111-1111-4111-8111-111111111111', 'PRODUTO', 1, 25);
	`);
}

async function existeConstraint(db: PGlite, nome: string): Promise<boolean> {
	const r = await db.query<{ n: number }>(
		"SELECT COUNT(*)::int AS n FROM pg_constraint WHERE conname = $1",
		[nome]
	);
	return r.rows[0].n > 0;
}

describe("caminho da produção", () => {
	test("a armadilha existe antes da 017b: UPDATE em pedido_item falha", async () => {
		const db = await bancoComoProducao(semearPedidoValido);
		try {
			await assert.rejects(
				db.query(
					"UPDATE pedido_item SET quantidade = 2 WHERE item_id = '22222222-2222-4222-8222-222222222222'"
				),
				/updated_at/,
				"se isto não falhar, a simulação não reproduz a produção"
			);
		} finally {
			await db.close();
		}
	});

	test("a 017b desarma a armadilha e o UPDATE volta a funcionar", async () => {
		const db = await bancoComoProducao(semearPedidoValido);
		try {
			await aplicar(db, migration017b);

			await db.query(
				"UPDATE pedido_item SET quantidade = 2 WHERE item_id = '22222222-2222-4222-8222-222222222222'"
			);
			const r = await db.query<{ quantidade: number; updated_at: unknown }>(
				"SELECT quantidade, updated_at FROM pedido_item"
			);
			assert.equal(r.rows[0].quantidade, 2);
			assert.ok(r.rows[0].updated_at, "updated_at deveria ter sido preenchido");
		} finally {
			await db.close();
		}
	});

	test("a 017b deixa um trigger de updated_at só em pedido", async () => {
		const db = await bancoComoProducao(semearPedidoValido);
		try {
			await aplicar(db, migration017b);
			const r = await db.query<{ tgname: string }>(
				`SELECT tgname FROM pg_trigger
         WHERE tgrelid = 'pedido'::regclass AND NOT tgisinternal
         ORDER BY tgname`
			);
			assert.deepEqual(
				r.rows.map(x => x.tgname),
				["trg_pedido_updated_at"]
			);
		} finally {
			await db.close();
		}
	});

	test("a 017b remove os enums órfãos criados pela 010b antiga", async () => {
		const db = await bancoComoProducao(semearPedidoValido);
		try {
			const antes = await db.query<{ n: number }>(
				"SELECT COUNT(*)::int AS n FROM pg_type WHERE typname = 'pedido_status_enum'"
			);
			assert.equal(antes.rows[0].n, 1, "a 010b antiga deveria ter criado o enum");

			await aplicar(db, migration017b);

			const depois = await db.query<{ typname: string }>(
				`SELECT typname FROM pg_type WHERE typname IN (
           'pedido_status_enum','canal_pedido_enum','status_pagamento_enum',
           'prioridade_enum','pedido_item_tipo_enum')`
			);
			assert.deepEqual(depois.rows, []);
		} finally {
			await db.close();
		}
	});

	test("depois da 017b, as migrations 018 a 023 aplicam sem erro", async () => {
		const db = await bancoComoProducao(semearPedidoValido);
		try {
			await aplicar(db, migration017b);
			await aplicar(db, depoisDe017b);
		} finally {
			await db.close();
		}
	});

	test("rodar a 017b duas vezes não faz mal", async () => {
		const db = await bancoComoProducao(semearPedidoValido);
		try {
			await aplicar(db, migration017b);
			await aplicar(db, migration017b);
		} finally {
			await db.close();
		}
	});

	test("depois de tudo, a esteira funciona sobre os dados que já existiam", async () => {
		const db = await bancoComoProducao(semearPedidoValido);
		try {
			await aplicar(db, migration017b);
			await aplicar(db, depoisDe017b);

			// O pedido antigo sobreviveu e ganhou ordem na esteira (023).
			const antigo = await db.query<{ status: string; ordem_esteira: number | null }>(
				"SELECT status, ordem_esteira FROM pedido WHERE numero_pedido = 'PED-2026-0001'"
			);
			assert.equal(antigo.rows[0].status, "IMPRIMINDO");
			assert.ok(antigo.rows[0].ordem_esteira != null);

			// Os status novos da esteira são aceitos...
			await db.query(
				"INSERT INTO pedido (numero_pedido, canal, status) VALUES ('PED-2026-0002', 'INSTAGRAM', 'IDEIA')"
			);
			// ...e o arrasto de card (UPDATE) funciona.
			await db.query(
				"UPDATE pedido SET status = 'MIDIA' WHERE numero_pedido = 'PED-2026-0002'"
			);

			// Valor fora da lista agora é barrado no banco — antes passava.
			await assert.rejects(
				db.query("UPDATE pedido SET status = 'INVENTADO' WHERE numero_pedido = 'PED-2026-0002'"),
				/pedido_status_check/
			);

			// Os recursos do card (023) funcionam no pedido antigo.
			await db.exec(`
				INSERT INTO pedido_checklist (checklist_id, pedido_id, titulo)
				VALUES ('33333333-3333-4333-8333-333333333333',
				        '11111111-1111-4111-8111-111111111111', 'Acabamento');
				INSERT INTO pedido_checklist_item (checklist_id, texto)
				VALUES ('33333333-3333-4333-8333-333333333333', 'Lixar');
			`);
		} finally {
			await db.close();
		}
	});

	test("o CHECK de status usa exatamente a lista do código", async () => {
		const db = await bancoComoProducao(semearPedidoValido);
		try {
			await aplicar(db, migration017b);
			await aplicar(db, depoisDe017b);

			const r = await db.query<{ def: string }>(
				"SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'pedido_status_check'"
			);
			const valores = (/\{([^}]*)\}/.exec(r.rows[0].def)?.[1] ?? "").split(",");
			assert.deepEqual(valores, [...PEDIDO_STATUS]);
		} finally {
			await db.close();
		}
	});
});

describe("demais divergências de produção (024)", () => {
	test("a 024 alinha modelo, membro_equipe e a função feita à mão", async () => {
		const db = await bancoComoProducao(semearPedidoValido);
		try {
			await aplicar(db, migration017b);
			await aplicar(db, depoisDe017b);

			const dflt = await db.query<{ d: string | null }>(
				`SELECT pg_get_expr(d.adbin, d.adrelid) AS d
         FROM pg_attribute a
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
         WHERE a.attrelid = 'membro_equipe'::regclass AND a.attname = 'dono_id'`
			);
			assert.equal(dflt.rows[0].d, "auth.uid()");

			const col = await db.query<{ n: number }>(
				`SELECT COUNT(*)::int AS n FROM information_schema.columns
         WHERE table_name = 'modelo' AND column_name = 'is_coringa'`
			);
			assert.equal(col.rows[0].n, 1, "is_coringa não pode sumir: é dado de produção");

			const fn = await db.query<{ n: number }>(
				"SELECT COUNT(*)::int AS n FROM pg_proc WHERE proname = 'trigger_set_updated_at'"
			);
			assert.equal(fn.rows[0].n, 0, "sem uso depois da 017b, a função feita à mão sai");
		} finally {
			await db.close();
		}
	});

	test("a 024 não remove a função se ainda houver trigger usando", async () => {
		const db = await bancoComoProducao(async d => {
			await semearPedidoValido(d);
			// Um uso que a conferência ainda não mostrou (os triggers vieram
			// cortados): o DROP sem CASCADE tem que falhar em silêncio.
			await d.exec(`
				CREATE TRIGGER outro_uso BEFORE UPDATE ON modelo
				FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
			`);
		});
		try {
			await aplicar(db, migration017b);
			await aplicar(db, depoisDe017b);

			const fn = await db.query<{ n: number }>(
				"SELECT COUNT(*)::int AS n FROM pg_proc WHERE proname = 'trigger_set_updated_at'"
			);
			assert.equal(fn.rows[0].n, 1);
			await db.query("UPDATE modelo SET nome = nome");
		} finally {
			await db.close();
		}
	});
});

describe("produção com dado fora da lista", () => {
	test("a 022 não cria o CHECK, não aborta e cria os demais", async () => {
		// Produção não tinha validação nenhuma: qualquer string cabia em
		// `status`. Se alguém gravou um valor solto pelo painel, a 022 precisa
		// avisar em vez de quebrar — e não pode usar NOT VALID, porque aí toda
		// edição daquela linha passaria a falhar.
		const db = await bancoComoProducao(async d => {
			await semearPedidoValido(d);
			await d.exec(
				"INSERT INTO pedido (numero_pedido, canal, status) VALUES ('PED-2026-0099', 'WHATSAPP', 'em producao')"
			);
		});
		try {
			await aplicar(db, migration017b);
			await aplicar(db, depoisDe017b);

			assert.ok(
				!(await existeConstraint(db, "pedido_status_check")),
				"com dado fora da lista, o CHECK de status não deveria ter sido criado"
			);
			assert.ok(await existeConstraint(db, "pedido_canal_check"));
			assert.ok(await existeConstraint(db, "pedido_item_tipo_check"));

			// A linha com valor solto continua editável.
			await db.query(
				"UPDATE pedido SET cliente_nome = 'Maria' WHERE numero_pedido = 'PED-2026-0099'"
			);
		} finally {
			await db.close();
		}
	});
});
