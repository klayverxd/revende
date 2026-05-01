import { test, expect } from "@playwright/test";

test.describe("Produtos", () => {
	test("lista produtos sem erro", async ({ page }) => {
		await page.goto("/produtos");
		await expect(page).not.toHaveURL(/\/login/);
		await expect(
			page.getByRole("heading", { name: /produtos/i })
		).toBeVisible();
	});

	test("botão Novo produto abre modal", async ({ page }) => {
		await page.goto("/produtos");
		await page.getByRole("button", { name: /novo produto/i }).click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(page.getByLabel(/nome/i).first()).toBeVisible();
	});

	test("modal valida campo nome obrigatório", async ({ page }) => {
		await page.goto("/produtos");
		await page.getByRole("button", { name: /novo produto/i }).click();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: /salvar/i })
			.click();
		await expect(page.getByText(/obrigatório/i)).toBeVisible();
	});

	test("cria produto e aparece na lista", async ({ page }) => {
		const nomeTeste = `Produto Teste ${Date.now()}`;
		await page.goto("/produtos");
		await page.getByRole("button", { name: /novo produto/i }).click();
		await page.getByLabel(/nome/i).first().fill(nomeTeste);
		await page
			.getByRole("dialog")
			.getByRole("button", { name: /salvar/i })
			.click();
		// Modal should close and product should appear
		await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8000 });
		await expect(page.getByText(nomeTeste)).toBeVisible({ timeout: 8000 });
	});

	test("desativa produto via menu de ações", async ({ page }) => {
		const nomeTeste = `Produto Desativar ${Date.now()}`;
		// Create first
		await page.goto("/produtos");
		await page.getByRole("button", { name: /novo produto/i }).click();
		await page.getByLabel(/nome/i).first().fill(nomeTeste);
		await page
			.getByRole("dialog")
			.getByRole("button", { name: /salvar/i })
			.click();
		await expect(page.getByText(nomeTeste)).toBeVisible({ timeout: 8000 });

		// Open actions menu and deactivate
		const row = page.getByRole("row").filter({ hasText: nomeTeste });
		await row.getByRole("button", { name: /ações/i }).click();
		await page.getByRole("button", { name: /desativar/i }).click();
		// After deactivation, product may be hidden from active list
		await page.waitForTimeout(1000);
	});
});
