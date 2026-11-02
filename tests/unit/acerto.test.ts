/**
 * Testes de src/modules/acerto/calcular.ts e src/modules/envio/fechamento.ts
 * — importando o fonte real.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
	calcularAcertoComissao,
	calcularAcertoValorMinimo,
	precoPorFaixa,
	qtdRestanteItem,
	ratearValorManual,
} from "@/modules/acerto/calcular";

import {
	envioEstaEncerrado,
	qtdComRevendedor,
	statusAposConferencia,
	statusAposRecebimento,
	totalComRevendedor,
} from "@/modules/envio/fechamento";

describe("precoPorFaixa", () => {
	test("multiplica quantidade pelo preço unitário", () => {
		assert.equal(precoPorFaixa(3, 10), 30);
	});

	test("quantidade zero ou negativa não gera valor", () => {
		assert.equal(precoPorFaixa(0, 10), 0);
		assert.equal(precoPorFaixa(-2, 10), 0);
	});

	test("preço nulo trata como zero", () => {
		assert.equal(precoPorFaixa(3, null), 0);
		assert.equal(precoPorFaixa(3, undefined), 0);
	});
});

describe("calcularAcertoComissao", () => {
	test("só comissão fixa", () => {
		const r = calcularAcertoComissao(100, 5, 0);
		assert.equal(r.comissaoCalculada, 5);
		assert.equal(r.valorLiquido, 95);
	});

	test("só percentual (30%)", () => {
		const r = calcularAcertoComissao(100, 0, 0.3);
		assert.equal(r.comissaoCalculada, 30);
		assert.equal(r.valorLiquido, 70);
	});

	test("fixa + percentual somam", () => {
		const r = calcularAcertoComissao(100, 5, 0.1);
		assert.equal(r.comissaoCalculada, 15);
		assert.equal(r.valorLiquido, 85);
	});

	test("venda zero com percentual não gera comissão", () => {
		const r = calcularAcertoComissao(0, 0, 0.3);
		assert.equal(r.comissaoCalculada, 0);
		assert.equal(r.valorLiquido, 0);
	});

	test("comissão fixa sobre venda zero deixa líquido negativo", () => {
		// Comportamento intencional: a fixa é devida mesmo sem venda.
		const r = calcularAcertoComissao(0, 5, 0);
		assert.equal(r.valorLiquido, -5);
	});
});

describe("calcularAcertoValorMinimo", () => {
	test("valor por unidade vendida", () => {
		assert.equal(calcularAcertoValorMinimo(3, 25), 75);
	});

	test("nada vendido, nada a receber", () => {
		assert.equal(calcularAcertoValorMinimo(0, 25), 0);
	});

	test("quantidade negativa não gera crédito", () => {
		assert.equal(calcularAcertoValorMinimo(-1, 25), 0);
	});
});

describe("ratearValorManual", () => {
	test("soma exata do rateio confere com o valor informado", () => {
		const out = ratearValorManual([30, 30, 40], 90);
		assert.equal(
			out.reduce((s, v) => s + v, 0),
			90
		);
	});

	test("mantém a proporção original", () => {
		const out = ratearValorManual([25, 75], 200);
		assert.deepEqual(out, [50, 150]);
	});

	test("último item absorve a sobra de arredondamento", () => {
		const out = ratearValorManual([1, 1, 1], 100);
		assert.equal(
			out.reduce((s, v) => s + v, 0),
			100
		);
		// 33,33 + 33,33 + 33,34
		assert.equal(out[2], 33.34);
	});

	test("total calculado zero joga tudo no primeiro item", () => {
		assert.deepEqual(ratearValorManual([0, 0], 50), [50, 0]);
	});

	test("valor negativo é tratado como zero", () => {
		assert.deepEqual(ratearValorManual([10, 10], -5), [0, 0]);
	});

	test("lista vazia devolve lista vazia", () => {
		assert.deepEqual(ratearValorManual([], 100), []);
	});
});

describe("qtdRestanteItem", () => {
	test("desconta vendido e devolvido", () => {
		assert.equal(
			qtdRestanteItem({ qtd_enviada: 10, qtd_vendida: 4, qtd_devolvida: 2 }),
			4
		);
	});

	test("nulos contam como zero", () => {
		assert.equal(
			qtdRestanteItem({ qtd_enviada: 10, qtd_vendida: null, qtd_devolvida: null }),
			10
		);
	});

	test("nunca devolve negativo", () => {
		assert.equal(
			qtdRestanteItem({ qtd_enviada: 5, qtd_vendida: 4, qtd_devolvida: 4 }),
			0
		);
	});
});

// ─── Fechamento de envio ──────────────────────────────────────────────────

const item = (enviada: number, vendida: number, devolvida: number) => ({
	qtd_enviada: enviada,
	qtd_vendida: vendida,
	qtd_devolvida: devolvida,
});

describe("fechamento de envio", () => {
	test("qtdComRevendedor é o que sobrou", () => {
		assert.equal(qtdComRevendedor(item(10, 6, 1)), 3);
	});

	test("totalComRevendedor soma os itens", () => {
		assert.equal(totalComRevendedor([item(10, 6, 1), item(5, 0, 0)]), 8);
	});

	test("encerrado quando nada sobrou", () => {
		assert.ok(envioEstaEncerrado([item(10, 7, 3), item(5, 5, 0)]));
	});

	test("não encerrado com sobra em qualquer item", () => {
		assert.ok(!envioEstaEncerrado([item(10, 10, 0), item(5, 1, 0)]));
	});

	test("envio sem itens conta como encerrado", () => {
		assert.ok(envioEstaEncerrado([]));
	});

	test("conferência: sobra volta para ABERTO", () => {
		assert.equal(statusAposConferencia([item(10, 5, 0)]), "ABERTO");
	});

	test("conferência: nada sobrando vira CONFERIDO", () => {
		assert.equal(statusAposConferencia([item(10, 5, 5)]), "CONFERIDO");
	});

	test("recebimento: encerra só quando não há pendência física", () => {
		assert.equal(statusAposRecebimento([item(10, 5, 5)]), "ENCERRADO");
		assert.equal(statusAposRecebimento([item(10, 5, 0)]), "CONFERIDO");
	});
});
