/**
 * Testes de src/lib/format.ts — importando o fonte real.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
	arredondar,
	clamp,
	diasEntre,
	fmtBRL,
	fmtData,
	fmtPct,
	fmtTempo,
	parseNum,
	parseTempo,
} from "@/lib/format";

describe("fmtBRL", () => {
	test("formata valor positivo", () => {
		// Intl usa espaço não separável entre símbolo e número
		assert.match(fmtBRL(1234.56), /^R\$\s1\.234,56$/u);
	});

	test("nulo e NaN viram travessão", () => {
		assert.equal(fmtBRL(null), "—");
		assert.equal(fmtBRL(undefined), "—");
		assert.equal(fmtBRL(Number.NaN), "—");
	});

	test("zero é formatado, não vira travessão", () => {
		assert.match(fmtBRL(0), /0,00$/u);
	});
});

describe("fmtData", () => {
	test("converte YYYY-MM-DD em DD/MM/AAAA", () => {
		assert.equal(fmtData("2026-08-27"), "27/08/2026");
	});

	test("aceita timestamp e ignora a hora", () => {
		assert.equal(fmtData("2026-08-27T23:45:00Z"), "27/08/2026");
	});

	test("NÃO desloca o dia — é o bug de fuso que existia nas telas", () => {
		// new Date("2026-01-01") em fuso negativo virava 31/12/2025
		assert.equal(fmtData("2026-01-01"), "01/01/2026");
		assert.equal(fmtData("2026-12-31"), "31/12/2026");
	});

	test("vazio e inválido viram travessão", () => {
		assert.equal(fmtData(null), "—");
		assert.equal(fmtData(""), "—");
		assert.equal(fmtData("2026-08"), "—");
	});
});

describe("diasEntre", () => {
	test("conta dias corridos", () => {
		assert.equal(diasEntre("2026-08-01", "2026-08-27"), 26);
	});

	test("negativo quando a data final é anterior", () => {
		assert.equal(diasEntre("2026-08-27", "2026-08-01"), -26);
	});

	test("mesmo dia é zero", () => {
		assert.equal(diasEntre("2026-08-27", "2026-08-27"), 0);
	});

	test("atravessa virada de ano sem erro de fuso", () => {
		assert.equal(diasEntre("2025-12-31", "2026-01-01"), 1);
	});
});

describe("fmtPct", () => {
	test("fração vira pontos percentuais", () => {
		assert.equal(fmtPct(0.3), "30%");
	});

	test("respeita casas decimais", () => {
		assert.equal(fmtPct(0.1234, { casas: 2 }), "12,34%");
	});

	test("aceita valor já em pontos percentuais", () => {
		assert.equal(fmtPct(30, { fracao: false }), "30%");
	});
});

describe("parseNum", () => {
	test("formato brasileiro com milhar e decimal", () => {
		assert.equal(parseNum("1.234,56"), 1234.56);
	});

	test("apenas vírgula decimal", () => {
		assert.equal(parseNum("12,5"), 12.5);
	});

	test("ponto decimal ao estilo inglês", () => {
		assert.equal(parseNum("12.5"), 12.5);
	});

	test("inteiro simples", () => {
		assert.equal(parseNum("150"), 150);
	});

	test("ignora espaços", () => {
		assert.equal(parseNum(" 1 234,50 "), 1234.5);
	});

	test("vazio e inválido viram 0, nunca NaN", () => {
		assert.equal(parseNum(""), 0);
		assert.equal(parseNum(null), 0);
		assert.equal(parseNum("abc"), 0);
		assert.equal(parseNum(Number.NaN), 0);
	});

	test("aceita número direto", () => {
		assert.equal(parseNum(42.5), 42.5);
	});
});

describe("parseTempo", () => {
	test("horas e minutos: 2h30", () => {
		assert.equal(parseTempo("2h30"), 150);
	});

	test("horas e minutos com sufixo: 2h30m", () => {
		assert.equal(parseTempo("2h30m"), 150);
	});

	test("só horas: 2h", () => {
		assert.equal(parseTempo("2h"), 120);
	});

	test("horas fracionadas: 2,5h e 2.5h", () => {
		assert.equal(parseTempo("2,5h"), 150);
		assert.equal(parseTempo("2.5h"), 150);
	});

	test("formato h:mm", () => {
		assert.equal(parseTempo("2:30"), 150);
		assert.equal(parseTempo("0:45"), 45);
	});

	test("minutos explícitos", () => {
		assert.equal(parseTempo("90m"), 90);
		assert.equal(parseTempo("90min"), 90);
	});

	test("número solto é minuto", () => {
		assert.equal(parseTempo("150"), 150);
	});

	test("maiúsculas e espaços", () => {
		assert.equal(parseTempo(" 2H30 "), 150);
	});

	test("inválido vira 0", () => {
		assert.equal(parseTempo("abc"), 0);
		assert.equal(parseTempo(""), 0);
		assert.equal(parseTempo(null), 0);
	});
});

describe("fmtTempo", () => {
	test("horas e minutos", () => {
		assert.equal(fmtTempo(150), "2h30");
	});

	test("hora exata", () => {
		assert.equal(fmtTempo(120), "2h");
	});

	test("menos de uma hora", () => {
		assert.equal(fmtTempo(45), "45min");
	});

	test("zero e nulo viram travessão", () => {
		assert.equal(fmtTempo(0), "—");
		assert.equal(fmtTempo(null), "—");
	});

	test("ida e volta com parseTempo", () => {
		for (const min of [45, 90, 120, 150, 185]) {
			assert.equal(parseTempo(fmtTempo(min)), min);
		}
	});
});

describe("clamp e arredondar", () => {
	test("clamp limita nos dois extremos", () => {
		assert.equal(clamp(5, 0, 10), 5);
		assert.equal(clamp(-1, 0, 10), 0);
		assert.equal(clamp(99, 0, 10), 10);
	});

	test("arredondar devolve número, não string", () => {
		assert.equal(arredondar(10 / 3, 4), 3.3333);
		assert.equal(typeof arredondar(1.5), "number");
	});

	test("arredondar vence o erro de ponto flutuante", () => {
		// 1.005 * 100 é 100.49999999999999 em IEEE-754; Math.round sozinho
		// devolveria 1.00 e perderia um centavo.
		assert.equal(arredondar(1.005, 2), 1.01);
		assert.equal(arredondar(2.675, 2), 2.68);
	});

	test("arredondar afasta do zero nos negativos", () => {
		assert.equal(arredondar(-1.005, 2), -1.01);
		assert.equal(arredondar(-2.5, 0), -3);
	});

	test("arredondar protege contra NaN", () => {
		assert.equal(arredondar(Number.NaN), 0);
	});
});
