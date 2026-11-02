/**
 * Testes de src/lib/queries/erro.ts.
 *
 * Motivo: a esteira rodou contra um banco sem a migration 023 e respondeu
 * 200 com o quadro vazio — o erro do Supabase era descartado e "a query
 * falhou" virava "não há pedidos".
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { exigirSemErro } from "@/lib/queries/erro";

describe("exigirSemErro", () => {
	test("sem erro, não faz nada", () => {
		exigirSemErro(null, "contexto");
		exigirSemErro(undefined, "contexto");
	});

	test("com erro, lança com o contexto na frente", () => {
		assert.throws(
			() => exigirSemErro({ message: "falhou", code: "XX000" }, "Carregando a esteira"),
			/^Error: Carregando a esteira: falhou$/
		);
	});

	test("coluna inexistente aponta para as migrations pendentes", () => {
		// O erro exato que aconteceu: PostgREST sem a coluna da 023.
		assert.throws(
			() =>
				exigirSemErro(
					{
						message: "Could not find the 'ordem_esteira' column of 'pedido' in the schema cache",
						code: "PGRST204",
					},
					"Não foi possível carregar a esteira"
				),
			/ordem_esteira.*sem alguma migration/
		);
	});

	test("tabela inexistente também aponta para as migrations", () => {
		for (const code of ["42P01", "42703", "PGRST205"]) {
			assert.throws(
				() => exigirSemErro({ message: "x", code }, "c"),
				/sem alguma migration/,
				`código ${code} deveria dar a dica`
			);
		}
	});

	test("erro que não é de schema não ganha a dica", () => {
		assert.throws(
			() => exigirSemErro({ message: "permission denied", code: "42501" }, "c"),
			err => !(err as Error).message.includes("migration")
		);
	});
});
