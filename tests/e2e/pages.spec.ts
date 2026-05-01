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

	test("fluxo de caixa — ano atual é exibido", async ({ page }) => {
		await page.goto("/financeiro/fluxo");
		const year = new Date().getFullYear().toString();
		await expect(page.getByText(year)).toBeVisible();
	});

	test("fluxo de caixa — navegação entre anos funciona", async ({ page }) => {
		await page.goto("/financeiro/fluxo");
		const prevYear = (new Date().getFullYear() - 1).toString();
		await page.getByRole("link", { name: new RegExp(`← ${prevYear}`) }).click();
		await expect(page).toHaveURL(new RegExp(`ano=${prevYear}`));
		await expect(page.getByText(prevYear)).toBeVisible();
	});

	test("fluxo de caixa tem 12 colunas de meses", async ({ page }) => {
		await page.goto("/financeiro/fluxo");
		const headers = page.getByRole("columnheader");
		// Jan-Dez + "Linha" + "Total" = 14 columns
		await expect(headers).toHaveCount(14);
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

test.describe("Acertos / Financeiro", () => {
	test("página de acertos carrega sem erro", async ({ page }) => {
		await page.goto("/acertos");
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
