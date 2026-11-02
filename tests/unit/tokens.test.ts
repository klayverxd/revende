/**
 * Testes de src/lib/tokens.ts — importando o fonte real.
 *
 * Isto guarda a correção da falha do extrato público: a rota /r/ roda com o
 * client de service role (ignora RLS), então a validação do token é a única
 * barreira antes do banco.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { ehRotaPublica, urlExtrato, validarToken } from "@/lib/tokens";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("validarToken", () => {
	test("aceita UUID canônico", () => {
		assert.equal(validarToken(UUID), UUID);
	});

	test("normaliza maiúsculas e espaços", () => {
		assert.equal(validarToken(`  ${UUID.toUpperCase()}  `), UUID);
	});

	test("rejeita vazio, nulo e undefined", () => {
		assert.equal(validarToken(""), null);
		assert.equal(validarToken(null), null);
		assert.equal(validarToken(undefined), null);
	});

	test("rejeita formato que não é UUID", () => {
		for (const ruim of [
			"abc",
			"12345",
			UUID.slice(0, -1), // curto
			`${UUID}0`, // longo
			UUID.replace(/-/g, ""), // sem hífens
			"3f2504e0-4f89-41d3-9a0c-0305e82c330g", // caractere inválido
		]) {
			assert.equal(validarToken(ruim), null, `deveria rejeitar: ${ruim}`);
		}
	});

	test("rejeita tentativas de injeção antes de chegar no banco", () => {
		for (const ataque of [
			`${UUID}' OR '1'='1`,
			`${UUID};DROP TABLE revendedor`,
			"../../etc/passwd",
			"%00",
			"3f2504e0-4f89-41d3-9a0c-0305e8 2c3301", // espaço no meio
			`${UUID} ${UUID}`,
		]) {
			assert.equal(validarToken(ataque), null, `deveria rejeitar: ${ataque}`);
		}
	});

	test("espaço em volta é aparado, mas o resultado segue UUID estrito", () => {
		// O trim é conveniência para colar da área de transferência. Não afrouxa
		// nada: o regex é ancorado e roda depois, sobre a string inteira.
		assert.equal(validarToken(`${UUID}\n`), UUID);
		assert.equal(validarToken(`\t${UUID} `), UUID);
	});
});

describe("ehRotaPublica", () => {
	test("libera as rotas de autenticação, exatas", () => {
		assert.ok(ehRotaPublica("/login"));
		assert.ok(ehRotaPublica("/register"));
		assert.ok(ehRotaPublica("/auth/callback"));
	});

	test("libera o extrato por prefixo", () => {
		// Era exatamente isto que faltava: /r/ não estava na lista e o link
		// do extrato caía no /login.
		assert.ok(ehRotaPublica(`/r/${UUID}`));
	});

	test("NÃO libera as rotas do app", () => {
		for (const rota of [
			"/dashboard",
			"/pedidos",
			"/revendedores/123",
			"/financeiro",
			"/configuracoes",
		]) {
			assert.ok(!ehRotaPublica(rota), `deveria exigir sessão: ${rota}`);
		}
	});

	test("prefixo não vaza para rota parecida", () => {
		// "/relatorios" começa com "/r" mas não com "/r/"
		assert.ok(!ehRotaPublica("/relatorios"));
		assert.ok(!ehRotaPublica("/revendedores"));
	});

	test("match exato não aceita sufixo", () => {
		assert.ok(!ehRotaPublica("/login-falso"));
		assert.ok(!ehRotaPublica("/registerX"));
	});
});

describe("urlExtrato", () => {
	test("monta a URL do extrato", () => {
		assert.equal(
			urlExtrato("https://app.exemplo.com", UUID),
			`https://app.exemplo.com/r/${UUID}`
		);
	});

	test("não duplica a barra final", () => {
		assert.equal(
			urlExtrato("https://app.exemplo.com/", UUID),
			`https://app.exemplo.com/r/${UUID}`
		);
	});
});
