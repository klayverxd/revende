import { test, expect } from "@playwright/test";

test.describe("Envios", () => {
	test("lista envios sem erro", async ({ page }) => {
		await page.goto("/envios");
		await expect(page).not.toHaveURL(/\/login/);
		await expect(page.getByRole("heading", { name: /envios/i })).toBeVisible();
	});

	test("filtro por revendedor funciona via query string", async ({ page }) => {
		// Visit with a fake revendedor id — should show filtered/empty state without error
		await page.goto("/envios?revendedor=00000000-0000-0000-0000-000000000000");
		await expect(page).not.toHaveURL(/\/login/);
		await expect(page.getByRole("heading", { name: /envios/i })).toBeVisible();
		// "Ver todos" button should appear
		await expect(
			page.getByRole("button", { name: /ver todos/i })
		).toBeVisible();
	});

	test("botão Ver todos limpa filtro", async ({ page }) => {
		await page.goto("/envios?revendedor=00000000-0000-0000-0000-000000000000");
		await page.getByRole("button", { name: /ver todos/i }).click();
		await expect(page).toHaveURL(/\/envios$/);
		await expect(
			page.getByRole("button", { name: /ver todos/i })
		).not.toBeVisible();
	});

	test("botão Novo envio navega para /envios/novo", async ({ page }) => {
		await page.goto("/envios");
		await page.getByRole("link", { name: /novo envio/i }).click();
		await expect(page).toHaveURL(/\/envios\/novo/);
	});

	test("página /envios/novo carrega sem erro", async ({ page }) => {
		await page.goto("/envios/novo");
		await expect(page).not.toHaveURL(/\/login/);
		// Should have some form elements
		await expect(
			page.getByText(/revendedor|novo envio/i).first()
		).toBeVisible();
	});
});
