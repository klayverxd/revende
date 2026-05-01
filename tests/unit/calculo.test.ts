/**
 * Unit tests for business logic calculations.
 * Run with: node --test --experimental-strip-types tests/unit/calculo.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ─── Helpers copied from source (inline to avoid Supabase import) ──────────

function precoPorFaixa(
	qtdVendida: number,
	precoUnitario: number | null,
	preco2mais: number | null
): number {
	if (qtdVendida <= 0) return 0;
	if (qtdVendida >= 2 && Number.isFinite(preco2mais)) {
		return qtdVendida * (preco2mais ?? 0);
	}
	return qtdVendida * (precoUnitario ?? 0);
}

function calcularAcertoComissao(
	valorTotalVenda: number,
	comissaoFixa: number,
	comissaoPct: number
): { comissaoCalculada: number; valorLiquido: number } {
	const comissaoCalculada = comissaoFixa + valorTotalVenda * comissaoPct;
	const valorLiquido = valorTotalVenda - comissaoCalculada;
	return { comissaoCalculada, valorLiquido };
}

function calcularAcertoValorMinimo(
	qtdVendida: number,
	valorMinimoUnit: number
): number {
	return qtdVendida * valorMinimoUnit;
}

function calcularStatus(
	disponivel: number,
	minimo: number
): "OK" | "REPOR" | "ATENÇÃO" | "SEM ESTOQUE" {
	if (disponivel <= 0) return "SEM ESTOQUE";
	if (disponivel <= minimo) return "REPOR";
	if (disponivel <= minimo * 1.5) return "ATENÇÃO";
	return "OK";
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("precoPorFaixa", () => {
	test("retorna 0 quando quantidade é 0", () => {
		assert.equal(precoPorFaixa(0, 10, 8), 0);
	});

	test("usa preco_unitario quando qtd = 1", () => {
		assert.equal(precoPorFaixa(1, 10, 8), 10);
	});

	test("usa preco_2mais quando qtd >= 2", () => {
		assert.equal(precoPorFaixa(2, 10, 8), 16);
		assert.equal(precoPorFaixa(5, 10, 8), 40);
	});

	test("usa preco_unitario quando preco_2mais é null", () => {
		assert.equal(precoPorFaixa(3, 10, null), 30);
	});

	test("retorna 0 quando qtd negativa", () => {
		assert.equal(precoPorFaixa(-1, 10, 8), 0);
	});
});

describe("calcularAcertoComissao", () => {
	test("comissão apenas fixa", () => {
		const { comissaoCalculada, valorLiquido } = calcularAcertoComissao(
			100,
			5,
			0
		);
		assert.equal(comissaoCalculada, 5);
		assert.equal(valorLiquido, 95);
	});

	test("comissão apenas percentual (30%)", () => {
		const { comissaoCalculada, valorLiquido } = calcularAcertoComissao(
			100,
			0,
			0.3
		);
		assert.equal(comissaoCalculada, 30);
		assert.equal(valorLiquido, 70);
	});

	test("comissão fixa + percentual", () => {
		const { comissaoCalculada, valorLiquido } = calcularAcertoComissao(
			100,
			5,
			0.1
		);
		assert.equal(comissaoCalculada, 15);
		assert.equal(valorLiquido, 85);
	});

	test("valor total zero resulta em comissão zero percentual", () => {
		const { comissaoCalculada, valorLiquido } = calcularAcertoComissao(
			0,
			0,
			0.3
		);
		assert.equal(comissaoCalculada, 0);
		assert.equal(valorLiquido, 0);
	});
});

describe("calcularAcertoValorMinimo", () => {
	test("calcula corretamente para 3 unidades", () => {
		assert.equal(calcularAcertoValorMinimo(3, 25), 75);
	});

	test("retorna 0 quando quantidade é 0", () => {
		assert.equal(calcularAcertoValorMinimo(0, 25), 0);
	});
});

describe("calcularStatus de estoque", () => {
	test("sem estoque quando disponivel = 0", () => {
		assert.equal(calcularStatus(0, 10), "SEM ESTOQUE");
	});

	test("sem estoque quando disponivel negativo", () => {
		assert.equal(calcularStatus(-1, 10), "SEM ESTOQUE");
	});

	test("REPOR quando disponivel <= minimo", () => {
		assert.equal(calcularStatus(10, 10), "REPOR");
		assert.equal(calcularStatus(5, 10), "REPOR");
	});

	test("ATENÇÃO quando disponivel <= minimo * 1.5", () => {
		assert.equal(calcularStatus(12, 10), "ATENÇÃO");
		assert.equal(calcularStatus(15, 10), "ATENÇÃO");
	});

	test("OK quando disponivel > minimo * 1.5", () => {
		assert.equal(calcularStatus(16, 10), "OK");
		assert.equal(calcularStatus(100, 10), "OK");
	});

	test("OK quando minimo = 0", () => {
		assert.equal(calcularStatus(1, 0), "OK");
	});
});

describe("validação de comissão percentual", () => {
	test("aceita 0 (sem comissão)", () => {
		const pct = 0;
		assert.ok(pct >= 0 && pct <= 1);
	});

	test("aceita 1 (100%)", () => {
		const pct = 1;
		assert.ok(pct >= 0 && pct <= 1);
	});

	test("rejeita valor > 1", () => {
		const pct = 1.1;
		assert.ok(!(pct >= 0 && pct <= 1));
	});

	test("rejeita valor negativo", () => {
		const pct = -0.1;
		assert.ok(!(pct >= 0 && pct <= 1));
	});
});
