import { test, expect } from "@playwright/test";

test.describe("Estoque", () => {
	test("página de estoque carrega sem erro", async ({ page }) => {
		await page.goto("/estoque");
		await expect(page).not.toHaveURL(/\/login/);
		await expect(page.getByRole("heading", { name: /estoque/i })).toBeVisible();
	});

	test("tabs de estoque são exibidas", async ({ page }) => {
		await page.goto("/estoque");
		// Should have view switcher tabs
		await expect(page.getByRole("tab").first()).toBeVisible({ timeout: 8000 });
	});
});

test.describe("Financeiro", () => {
	test("página financeiro carrega sem erro", async ({ page }) => {
		await page.goto("/financeiro");
		await expect(page).not.toHaveURL(/\/login/);
	});

	// Havia aqui 3 testes de um "fluxo de caixa" com navegacao por ano e 14
	// colunas. Essa tela nao existe mais: /financeiro/fluxo virou redirect
	// para /financeiro. Os testes eram impossiveis de passar, e ninguem
	// percebeu porque o lint e o CI tambem estavam quebrados.
	test("/financeiro/fluxo redireciona para /financeiro", async ({ page }) => {
		await page.goto("/financeiro/fluxo");
		await expect(page).toHaveURL(/\/financeiro$/);
	});
});

test.describe("Conferências", () => {
	test("lista de conferências carrega sem erro", async ({ page }) => {
		await page.goto("/conferencias");
		await expect(page).not.toHaveURL(/\/login/);
		await expect(
			page.getByRole("heading", { name: /conferência|conferencia/i })
		).toBeVisible();
	});
});

test.describe("Acertos", () => {
	test("/acertos redireciona para /financeiro", async ({ page }) => {
		await page.goto("/acertos");
		await expect(page).toHaveURL(/\/financeiro$/);
	});
});

test.describe("Extrato publico do revendedor", () => {
	// A rota /r/ e a unica servida fora do login, e roda com service role
	// (ignora RLS). Antes era enderecada pelo revendedor_id e sem token, e o
	// middleware nem a liberava. Estes testes travam as duas pontas.
	test("token invalido responde 404, nao manda para o login", async ({
		page,
	}) => {
		const resposta = await page.goto("/r/nao-e-um-uuid");
		expect(resposta?.status()).toBe(404);
		await expect(page).not.toHaveURL(/\/login/);
	});

	test("token bem formado mas inexistente responde 404", async ({ page }) => {
		const resposta = await page.goto("/r/00000000-0000-4000-8000-000000000000");
		expect(resposta?.status()).toBe(404);
		await expect(page).not.toHaveURL(/\/login/);
	});
});

test.describe("Venda direta", () => {
	test("lista de vendas diretas carrega sem erro", async ({ page }) => {
		await page.goto("/venda-direta");
		await expect(page).not.toHaveURL(/\/login/);
		await expect(
			page.getByRole("heading", { name: /venda direta/i })
		).toBeVisible();
	});

	test("botão Nova venda navega para formulário", async ({ page }) => {
		await page.goto("/venda-direta");
		await page.getByRole("link", { name: /nova venda/i }).click();
		await expect(page).toHaveURL(/\/venda-direta\/nova/);
	});
});

test.describe("Calculadora", () => {
	test("página calculadora carrega sem erro", async ({ page }) => {
		await page.goto("/calculadora");
		await expect(page).not.toHaveURL(/\/login/);
		await expect(
			page.getByRole("heading", { name: /calculadora/i })
		).toBeVisible();
	});
});
