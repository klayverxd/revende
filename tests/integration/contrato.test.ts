/**
 * Verifica que as asserções de src/lib/db/contrato.ts REALMENTE quebram.
 *
 * Por que este teste existe: a primeira versão do contrato usava apenas
 * `A extends B ? true : false`. Tipagem estrutural aceita propriedades a
 * mais, então uma coluna que o código escreve mas o schema não tem passava
 * batido — a asserção era decoração. Sabotar o payload de propósito e exigir
 * que o `tsc` reclame é a única forma de saber que a checagem tem dente.
 *
 * Cada caso roda o compilador de verdade sobre um arquivo temporário.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const RAIZ = process.cwd();

/**
 * Compila um trecho que importa o contrato real e devolve os erros do tsc.
 *
 * O arquivo vai para dentro de `src/` porque o `tsconfig.json` limita o
 * `include` a `src/**`, e é o `tsconfig` do projeto que garante as mesmas
 * regras de strictness.
 */
function compilar(codigo: string): { ok: boolean; saida: string } {
	const dir = mkdtempSync(path.join(RAIZ, "src", ".contrato-"));
	const arquivo = path.join(dir, "caso.ts");
	writeFileSync(arquivo, codigo, "utf8");

	// `paths` não pode ser passado por linha de comando (TS6064), então o caso
	// roda com um tsconfig que ESTENDE o do projeto — assim herda a mesma
	// strictness e o mesmo alias `@/`, e só troca o `include`.
	// O diretório temporário fica em src/, então a raiz está dois níveis acima.
	const tsconfig = path.join(dir, "tsconfig.json");
	writeFileSync(
		tsconfig,
		JSON.stringify(
			{
				extends: "../../tsconfig.json",
				compilerOptions: { incremental: false, noEmit: true },
				include: ["caso.ts"],
			},
			null,
			2
		),
		"utf8"
	);

	try {
		const r = spawnSync(
			`npx tsc -p "${path.relative(RAIZ, tsconfig).replace(/\\/g, "/")}"`,
			{ encoding: "utf8", shell: true, cwd: RAIZ, maxBuffer: 32 * 1024 * 1024 }
		);
		return {
			ok: r.status === 0,
			saida: `${r.stdout ?? ""}${r.stderr ?? ""}`,
		};
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

const IMPORTS = `
import type { Database, Insert } from "@/lib/db/types";
type Assert<T extends true> = T;
type ChavesDesconhecidas<A, B> = Exclude<keyof A, keyof B>;
type ChavesObrigatorias<T> = {
	[K in keyof T]-?: Record<string, never> extends Pick<T, K> ? never : K;
}[keyof T];
type ObrigatoriasFaltando<A, B> = Exclude<ChavesObrigatorias<B>, keyof A>;
type ExigirVazio<T> = [T] extends [never] ? true : { ERRO: T };
type PayloadConfere<A, B> = ExigirVazio<ChavesDesconhecidas<A, B>> extends true
	? ExigirVazio<ObrigatoriasFaltando<A, B>> extends true
		? ([A] extends [Pick<B, Extract<keyof A, keyof B>>] ? true : false)
		: ExigirVazio<ObrigatoriasFaltando<A, B>>
	: ExigirVazio<ChavesDesconhecidas<A, B>>;
`;

describe("as asserções de contrato têm dente", () => {
	test("payload correto compila", () => {
		const { ok, saida } = compilar(`${IMPORTS}
type Payload = {
	numero_pedido: string;
	canal: string;
	status: string;
};
export type _T = Assert<PayloadConfere<Payload, Insert<"pedido">>>;
`);
		assert.ok(ok, `deveria compilar, mas falhou:\n${saida}`);
	});

	test("REJEITA coluna que o schema não tem", () => {
		// Este é o caso que a versão vacuosa deixava passar.
		const { ok, saida } = compilar(`${IMPORTS}
type Payload = {
	numero_pedido: string;
	coluna_que_nao_existe: string;
};
export type _T = Assert<PayloadConfere<Payload, Insert<"pedido">>>;
`);
		assert.ok(!ok, "coluna inexistente deveria quebrar a compilação");
		assert.match(saida, /coluna_que_nao_existe/);
	});

	test("REJEITA tipo errado numa coluna existente", () => {
		const { ok, saida } = compilar(`${IMPORTS}
type Payload = {
	numero_pedido: number;
};
export type _T = Assert<PayloadConfere<Payload, Insert<"pedido">>>;
`);
		assert.ok(!ok, "tipo trocado deveria quebrar a compilação");
		assert.match(saida, /does not satisfy the constraint 'true'|not assignable/i);
	});

	test("REJEITA valor de enum que o banco não conhece", () => {
		// Usa envio_item.modelo_acerto, que é enum de verdade. O status de
		// pedido NÃO serve mais para este teste: em produção ele é TEXT, então
		// o TypeScript aceita qualquer string — quem barra valor inválido ali
		// é o CHECK da 022, coberto por tests/integration/producao.test.ts.
		const { ok } = compilar(`${IMPORTS}
type Payload = {
	envio_id: string;
	modelo_id: string;
	qtd_enviada: number;
	preco_origem: Database["public"]["Enums"]["preco_origem_enum"];
	modelo_acerto: "ACERTO_INVENTADO";
};
export type _T = Assert<PayloadConfere<Payload, Insert<"envio_item">>>;
`);
		assert.ok(!ok, "enum inválido deveria quebrar a compilação");
	});

	test("REJEITA payload que omite coluna obrigatória", () => {
		const { ok } = compilar(`${IMPORTS}
// numero_pedido é NOT NULL sem default → obrigatório no Insert.
type Payload = { canal: string };
export type _T = Assert<PayloadConfere<Payload, Insert<"pedido">>>;
`);
		assert.ok(!ok, "faltar coluna obrigatória deveria quebrar a compilação");
	});

	test("o arquivo de contrato real compila", () => {
		// Importa uma asserção nomeada: se qualquer `Assert<...>` de contrato.ts
		// estiver falso, o tsc reclama ao resolver o módulo.
		const { ok, saida } = compilar(`
import type { _PedidoInsertConfere, _AcertoInsertConfere } from "@/lib/db/contrato";
export type _A = _PedidoInsertConfere;
export type _B = _AcertoInsertConfere;
`);
		assert.ok(ok, `contrato.ts deveria compilar:\n${saida}`);
	});
});
