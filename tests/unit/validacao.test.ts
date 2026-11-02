/**
 * Testes de src/lib/validacao.ts — importando o fonte real.
 *
 * Estas primitivas são o portão de entrada das Server Actions. Antes disso o
 * zod existia no projeto mas rodava só no navegador, e um payload inválido ia
 * direto para o Postgres.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import {
	validar,
	zDataISO,
	zPercentual,
	zQuantidade,
	zQuantidadeZero,
	zTextoOmitivel,
	zUuid,
	zValor,
} from "@/lib/validacao";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("zUuid", () => {
	test("aceita UUID", () => {
		assert.equal(zUuid.parse(UUID), UUID);
	});

	test("rejeita string qualquer", () => {
		assert.ok(!zUuid.safeParse("abc").success);
		assert.ok(!zUuid.safeParse("").success);
	});
});

describe("zDataISO", () => {
	test("aceita AAAA-MM-DD", () => {
		assert.equal(zDataISO.parse("2026-08-28"), "2026-08-28");
	});

	test("rejeita outros formatos", () => {
		for (const ruim of ["28/08/2026", "2026-8-28", "2026-08-28T00:00:00Z", ""]) {
			assert.ok(!zDataISO.safeParse(ruim).success, `deveria rejeitar: ${ruim}`);
		}
	});
});

describe("zQuantidade", () => {
	test("aceita inteiro positivo", () => {
		assert.equal(zQuantidade.parse(3), 3);
	});

	test("rejeita zero, negativo e fracionário", () => {
		assert.ok(!zQuantidade.safeParse(0).success);
		assert.ok(!zQuantidade.safeParse(-1).success);
		assert.ok(!zQuantidade.safeParse(1.5).success);
	});

	test("zQuantidadeZero aceita zero mas não negativo", () => {
		assert.equal(zQuantidadeZero.parse(0), 0);
		assert.ok(!zQuantidadeZero.safeParse(-1).success);
	});
});

describe("zValor e zPercentual", () => {
	test("valor aceita zero e positivo", () => {
		assert.equal(zValor.parse(0), 0);
		assert.equal(zValor.parse(12.34), 12.34);
	});

	test("valor rejeita negativo — preço negativo era aceito antes", () => {
		assert.ok(!zValor.safeParse(-0.01).success);
	});

	test("percentual fica entre 0 e 100", () => {
		assert.equal(zPercentual.parse(14), 14);
		assert.ok(!zPercentual.safeParse(-1).success);
		assert.ok(!zPercentual.safeParse(101).success);
	});
});

describe("zTextoOmitivel", () => {
	test("normaliza vazio e nulo para undefined", () => {
		assert.equal(zTextoOmitivel().parse(""), undefined);
		assert.equal(zTextoOmitivel().parse(null), undefined);
		assert.equal(zTextoOmitivel().parse(undefined), undefined);
	});

	test("apara espaços", () => {
		assert.equal(zTextoOmitivel().parse("  ok  "), "ok");
	});

	test("respeita o limite de tamanho", () => {
		assert.ok(!zTextoOmitivel(5).safeParse("123456").success);
	});
});

describe("validar", () => {
	const schema = z.object({ id: zUuid, qtd: zQuantidade });

	test("devolve os dados quando válido", () => {
		assert.deepEqual(validar(schema, { id: UUID, qtd: 2 }), {
			id: UUID,
			qtd: 2,
		});
	});

	test("lança Error com o caminho do campo", () => {
		assert.throws(
			() => validar(schema, { id: "x", qtd: 2 }),
			/id: Identificador inválido/
		);
	});

	test("inclui o contexto na mensagem", () => {
		assert.throws(
			() => validar(schema, { id: "x", qtd: 2 }, "Não foi possível criar"),
			/^Error: Não foi possível criar — id:/
		);
	});

	test("junta no máximo 3 problemas, para a mensagem caber num toast", () => {
		const largo = z.object({ a: zUuid, b: zUuid, c: zUuid, d: zUuid });
		try {
			validar(largo, {});
			assert.fail("deveria ter lançado");
		} catch (e) {
			const msg = (e as Error).message;
			assert.equal(msg.split("; ").length, 3);
		}
	});
});
