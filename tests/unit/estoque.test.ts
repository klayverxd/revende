/**
 * Testes de src/modules/estoque/calcular.ts — importando o fonte real.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
	calcularDisponivelPorModelo,
	calcularEstoque,
	calcularStatus,
	type EstoqueInput,
} from "@/modules/estoque/calcular";

const M = "modelo-1";

function entrada(overrides: Partial<EstoqueInput> = {}): EstoqueInput {
	return {
		modelos: [{ modelo_id: M, codigo: "M01", nome: "Chaveiro", estoque_minimo: 10 }],
		producoes: [],
		envioItens: [],
		vendaDiretaItens: [],
		...overrides,
	};
}

describe("calcularStatus", () => {
	test("SEM_ESTOQUE quando disponível é zero ou negativo", () => {
		assert.equal(calcularStatus(0, 10), "SEM_ESTOQUE");
		assert.equal(calcularStatus(-3, 10), "SEM_ESTOQUE");
	});

	test("REPOR quando abaixo do mínimo", () => {
		assert.equal(calcularStatus(9, 10), "REPOR");
		assert.equal(calcularStatus(1, 10), "REPOR");
	});

	test("no mínimo exato ainda é ATENCAO, não REPOR", () => {
		// O mínimo está atendido — só entra em REPOR quando fura.
		assert.equal(calcularStatus(10, 10), "ATENCAO");
	});

	test("ATENCAO até 1,5× o mínimo", () => {
		assert.equal(calcularStatus(15, 10), "ATENCAO");
	});

	test("OK acima de 1,5× o mínimo", () => {
		assert.equal(calcularStatus(16, 10), "OK");
	});

	test("sem mínimo definido, qualquer saldo positivo é OK", () => {
		assert.equal(calcularStatus(1, 0), "OK");
	});
});

describe("calcularEstoque — entradas", () => {
	test("soma as produções", () => {
		const [row] = calcularEstoque(
			entrada({
				producoes: [
					{ modelo_id: M, quantidade: 10 },
					{ modelo_id: M, quantidade: 5 },
				],
			})
		);
		assert.equal(row.entradas, 15);
		assert.equal(row.disponivel, 15);
	});

	test("quantidade nula conta como zero", () => {
		const [row] = calcularEstoque(
			entrada({ producoes: [{ modelo_id: M, quantidade: null }] })
		);
		assert.equal(row.entradas, 0);
	});
});

describe("calcularEstoque — envios ABERTO", () => {
	test("tudo enviado sai do estoque e fica em consignação", () => {
		const [row] = calcularEstoque(
			entrada({
				producoes: [{ modelo_id: M, quantidade: 20 }],
				envioItens: [
					{
						modelo_id: M,
						qtd_enviada: 8,
						qtd_vendida: null,
						qtd_devolvida: null,
						envio_status: "ABERTO",
					},
				],
			})
		);
		assert.equal(row.saidas, 8);
		assert.equal(row.disponivel, 12);
		assert.equal(row.em_consignacao, 8);
	});
});

describe("calcularEstoque — envios CONFERIDO/ENCERRADO", () => {
	test("só a devolução física volta ao estoque", () => {
		// Enviou 10, vendeu 6, devolveu 3 → 1 ainda com o revendedor.
		// Saída = 10 - 3 = 7. Consignação = 10 - 6 - 3 = 1.
		const [row] = calcularEstoque(
			entrada({
				producoes: [{ modelo_id: M, quantidade: 20 }],
				envioItens: [
					{
						modelo_id: M,
						qtd_enviada: 10,
						qtd_vendida: 6,
						qtd_devolvida: 3,
						envio_status: "CONFERIDO",
					},
				],
			})
		);
		assert.equal(row.saidas, 7);
		assert.equal(row.disponivel, 13);
		assert.equal(row.em_consignacao, 1);
	});

	test("ciclo fechado não deixa saldo em consignação", () => {
		const [row] = calcularEstoque(
			entrada({
				producoes: [{ modelo_id: M, quantidade: 20 }],
				envioItens: [
					{
						modelo_id: M,
						qtd_enviada: 10,
						qtd_vendida: 7,
						qtd_devolvida: 3,
						envio_status: "ENCERRADO",
					},
				],
			})
		);
		assert.equal(row.saidas, 7);
		assert.equal(row.em_consignacao, 0);
	});
});

describe("calcularEstoque — venda direta", () => {
	test("venda direta é saída de estoque", () => {
		const [row] = calcularEstoque(
			entrada({
				producoes: [{ modelo_id: M, quantidade: 20 }],
				vendaDiretaItens: [{ modelo_id: M, quantidade: 4 }],
			})
		);
		assert.equal(row.saidas, 4);
		assert.equal(row.disponivel, 16);
	});

	test("REGRESSÃO: venda direta entra no disponível", () => {
		// A cópia da fórmula dentro de criarEnvio ignorava venda_direta_item
		// e por isso calculava déficit a menos ao gerar produção automática.
		const disp = calcularDisponivelPorModelo({
			producoes: [{ modelo_id: M, quantidade: 10 }],
			envioItens: [],
			vendaDiretaItens: [{ modelo_id: M, quantidade: 10 }],
		});
		assert.equal(disp.get(M), 0);
	});
});

describe("calcularEstoque — resultado", () => {
	test("um modelo sem movimento aparece zerado, não desaparece", () => {
		const rows = calcularEstoque(entrada());
		assert.equal(rows.length, 1);
		assert.equal(rows[0].disponivel, 0);
		assert.equal(rows[0].status, "SEM_ESTOQUE");
	});

	test("código ausente vira '-'", () => {
		const [row] = calcularEstoque(
			entrada({ modelos: [{ modelo_id: M, codigo: null, nome: "X" }] })
		);
		assert.equal(row.codigo, "-");
	});

	test("movimento de outro modelo não contamina", () => {
		const [row] = calcularEstoque(
			entrada({
				producoes: [
					{ modelo_id: M, quantidade: 5 },
					{ modelo_id: "outro", quantidade: 99 },
				],
			})
		);
		assert.equal(row.entradas, 5);
	});
});
