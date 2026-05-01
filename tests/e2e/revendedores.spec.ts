import { test, expect } from "@playwright/test";

test.describe("Revendedores", () => {
	test("lista revendedores sem erro", async ({ page }) => {
		await page.goto("/revendedores");
		await expect(page).not.toHaveURL(/\/login/);
		await expect(
			page.getByRole("heading", { name: /revendedores/i })
		).toBeVisible();
	});

	test("botão Novo revendedor abre modal", async ({ page }) => {
		await page.goto("/revendedores");
		await page.getByRole("button", { name: /novo revendedor/i }).click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(page.getByLabel(/nome/i).first()).toBeVisible();
	});

	test("modal valida campo nome obrigatório", async ({ page }) => {
		await page.goto("/revendedores");
		await page.getByRole("button", { name: /novo revendedor/i }).click();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: /salvar/i })
			.click();
		await expect(page.getByText(/obrigatório/i)).toBeVisible();
	});

	test("cria revendedor COMISSAO e aparece na lista", async ({ page }) => {
		const nome = `Revendedor Comissao ${Date.now()}`;
		await page.goto("/revendedores");
		await page.getByRole("button", { name: /novo revendedor/i }).click();
		await page.getByLabel(/nome/i).first().fill(nome);
		// Select COMISSAO (should be default, but make sure)
		const select = page.getByRole("dialog").getByRole("combobox");
		if ((await select.count()) > 0) {
			await select.selectOption("COMISSAO");
		}
		await page
			.getByRole("dialog")
			.getByRole("button", { name: /salvar/i })
			.click();
		await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8000 });
		await expect(page.getByText(nome)).toBeVisible({ timeout: 8000 });
	});

	test("cria revendedor VALOR_MINIMO e aparece na lista", async ({ page }) => {
		const nome = `Revendedor VM ${Date.now()}`;
		await page.goto("/revendedores");
		await page.getByRole("button", { name: /novo revendedor/i }).click();
		await page.getByLabel(/nome/i).first().fill(nome);
		const select = page.getByRole("dialog").getByRole("combobox");
		if ((await select.count()) > 0) {
			await select.selectOption("VALOR_MINIMO");
		}
		await page
			.getByRole("dialog")
			.getByRole("button", { name: /salvar/i })
			.click();
		await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8000 });
		await expect(page.getByText(nome)).toBeVisible({ timeout: 8000 });
	});
});
