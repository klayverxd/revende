/**
 * Testes de src/modules/pedido/status.ts — o modelo da esteira.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
	COLUNAS_ESTEIRA,
	PEDIDO_STATUS,
	STATUS_COR,
	STATUS_LABEL,
	STATUS_VARIANTE,
	colunaDoStatus,
	colunaPorId,
	ehPrePedido,
	ordemEntre,
	pedidoEstaAtivo,
	situacaoPrazo,
	statusAoMover,
	type PedidoStatus,
} from "@/modules/pedido/status";

describe("integridade do modelo", () => {
	test("todo status tem coluna na esteira", () => {
		const cobertos = new Set(COLUNAS_ESTEIRA.flatMap(c => c.statuses));
		const orfaos = PEDIDO_STATUS.filter(s => !cobertos.has(s));
		assert.deepEqual(orfaos, [], `status sem coluna: ${orfaos.join(", ")}`);
	});

	test("nenhum status aparece em duas colunas", () => {
		const vistos = new Set<string>();
		const repetidos: string[] = [];
		for (const c of COLUNAS_ESTEIRA) {
			for (const s of c.statuses) {
				if (vistos.has(s)) repetidos.push(s);
				vistos.add(s);
			}
		}
		assert.deepEqual(repetidos, []);
	});

	test("statusAoEntrar de cada coluna pertence à própria coluna", () => {
		for (const c of COLUNAS_ESTEIRA) {
			assert.ok(
				c.statuses.includes(c.statusAoEntrar),
				`${c.id}: statusAoEntrar "${c.statusAoEntrar}" não está na coluna`
			);
		}
	});

	test("ids de coluna são únicos", () => {
		const ids = COLUNAS_ESTEIRA.map(c => c.id);
		assert.equal(new Set(ids).size, ids.length);
	});

	test("todo status tem rótulo, cor e variante", () => {
		for (const s of PEDIDO_STATUS) {
			assert.ok(STATUS_LABEL[s], `sem rótulo: ${s}`);
			assert.ok(STATUS_COR[s], `sem cor: ${s}`);
			assert.ok(STATUS_VARIANTE[s], `sem variante: ${s}`);
		}
	});

	test("as colunas do Trello estão todas representadas", () => {
		assert.deepEqual(
			COLUNAS_ESTEIRA.map(c => c.id),
			[
				"ideias",
				"orcamento",
				"a-fazer",
				"imprimindo",
				"processo-manual",
				"midia",
				"a-entregar",
				"concluidos",
				"cancelados",
			]
		);
	});
});

describe("colunaDoStatus", () => {
	test("mapeia status para a coluna certa", () => {
		assert.equal(colunaDoStatus("IDEIA").id, "ideias");
		assert.equal(colunaDoStatus("EM_ACABAMENTO").id, "processo-manual");
		assert.equal(colunaDoStatus("ENVIADO").id, "a-entregar");
		assert.equal(colunaDoStatus("CANCELADO").id, "cancelados");
	});

	test("agrupa os status que são a mesma pilha de trabalho", () => {
		assert.equal(colunaDoStatus("NOVO").id, "a-fazer");
		assert.equal(colunaDoStatus("AGUARDANDO_IMPRESSAO").id, "a-fazer");
		assert.equal(colunaDoStatus("EM_MODELAGEM").id, "a-fazer");
	});

	test("colunaPorId devolve undefined para id inexistente", () => {
		assert.equal(colunaPorId("nao-existe"), undefined);
	});
});

describe("statusAoMover", () => {
	test("mover para outra coluna adota o status de entrada dela", () => {
		assert.equal(statusAoMover("NOVO", "imprimindo"), "IMPRIMINDO");
		assert.equal(statusAoMover("IDEIA", "orcamento"), "ORCAMENTO");
	});

	test("PRESERVA o status quando a coluna de destino é a mesma", () => {
		// Soltar um card de AGUARDANDO_IMPRESSAO na própria coluna "A fazer"
		// não deve rebaixá-lo para NOVO.
		assert.equal(statusAoMover("AGUARDANDO_IMPRESSAO", "a-fazer"), "AGUARDANDO_IMPRESSAO");
		assert.equal(statusAoMover("EM_MODELAGEM", "a-fazer"), "EM_MODELAGEM");
		assert.equal(statusAoMover("ENVIADO", "a-entregar"), "ENVIADO");
	});

	test("coluna inexistente devolve null em vez de mudar o status", () => {
		assert.equal(statusAoMover("NOVO", "coluna-fantasma"), null);
	});

	test("mover para trás é permitido", () => {
		// A esteira não é uma máquina de estados rígida: um pedido pode voltar
		// de "Imprimindo" para "A fazer" quando a impressão falha.
		assert.equal(statusAoMover("IMPRIMINDO", "a-fazer"), "NOVO");
	});
});

describe("ciclo de vida", () => {
	test("pedidoEstaAtivo exclui entregue e cancelado", () => {
		assert.ok(pedidoEstaAtivo("IMPRIMINDO"));
		assert.ok(pedidoEstaAtivo("IDEIA"));
		assert.ok(!pedidoEstaAtivo("ENTREGUE"));
		assert.ok(!pedidoEstaAtivo("CANCELADO"));
	});

	test("ideia e orçamento são pré-pedido", () => {
		assert.ok(ehPrePedido("IDEIA"));
		assert.ok(ehPrePedido("ORCAMENTO"));
		assert.ok(!ehPrePedido("NOVO"));
	});
});

describe("situacaoPrazo", () => {
	const HOJE = "2026-08-28";

	test("sem prazo definido", () => {
		assert.equal(situacaoPrazo(null, HOJE), "SEM_PRAZO");
	});

	test("atrasado quando a data já passou", () => {
		assert.equal(situacaoPrazo("2026-08-27", HOJE), "ATRASADO");
	});

	test("hoje é hoje", () => {
		assert.equal(situacaoPrazo("2026-08-28", HOJE), "HOJE");
	});

	test("futuro", () => {
		assert.equal(situacaoPrazo("2026-08-29", HOJE), "FUTURO");
	});

	test("prazo marcado como cumprido vence o atraso", () => {
		assert.equal(
			situacaoPrazo("2026-01-01", HOJE, { prazoConcluido: true }),
			"CUMPRIDO"
		);
	});

	test("pedido entregue ou cancelado não fica atrasado", () => {
		assert.equal(
			situacaoPrazo("2026-01-01", HOJE, { status: "ENTREGUE" }),
			"CUMPRIDO"
		);
		assert.equal(
			situacaoPrazo("2026-01-01", HOJE, { status: "CANCELADO" }),
			"CUMPRIDO"
		);
	});

	test("compara sem construir Date — sem deslocamento de fuso", () => {
		// Era o bug clássico: new Date("2026-01-01") em fuso negativo virava
		// 31/12/2025 e o card aparecia atrasado sem estar.
		assert.equal(situacaoPrazo("2026-01-01", "2026-01-01"), "HOJE");
		assert.equal(situacaoPrazo("2026-01-01T23:59:59Z", "2026-01-01"), "HOJE");
	});

	test("aceita timestamp completo", () => {
		assert.equal(situacaoPrazo("2026-08-30T10:00:00Z", HOJE), "FUTURO");
	});
});

describe("ordemEntre", () => {
	test("ponto médio entre dois cards", () => {
		assert.equal(ordemEntre(10, 20), 15);
	});

	test("soltar no topo da coluna", () => {
		assert.equal(ordemEntre(null, 10), 9);
	});

	test("soltar no fim da coluna", () => {
		assert.equal(ordemEntre(10, null), 11);
	});

	test("coluna vazia", () => {
		assert.equal(ordemEntre(null, null), 0);
	});

	test("suporta arrastos repetidos sem colidir", () => {
		// É por isso que ordem_esteira é DOUBLE PRECISION: inserir sempre no
		// mesmo ponto não esgota o espaço em nenhum número prático de arrastos.
		let a = 0;
		const b = 1;
		for (let i = 0; i < 30; i++) {
			const meio = ordemEntre(a, b);
			assert.ok(meio > a && meio < b, `iteração ${i}: ${meio} fora de (${a}, ${b})`);
			a = meio;
		}
	});
});

describe("STATUS_LABEL", () => {
	test("os status novos da esteira têm rótulo em português", () => {
		assert.equal(STATUS_LABEL.IDEIA, "Ideia");
		assert.equal(STATUS_LABEL.ORCAMENTO, "Orçamento");
		assert.equal(STATUS_LABEL.MIDIA, "Mídia");
	});

	test("EM_ACABAMENTO usa o nome que a equipe usa", () => {
		// As duas telas antigas discordavam: uma dizia "Em acabamento", a outra
		// "Processo manual" — que é o termo da coluna do Trello.
		assert.equal(STATUS_LABEL.EM_ACABAMENTO, "Processo manual");
	});

	test("cobre exatamente os status existentes, sem sobra", () => {
		const chaves = Object.keys(STATUS_LABEL) as PedidoStatus[];
		assert.equal(chaves.length, PEDIDO_STATUS.length);
	});
});
