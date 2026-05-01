import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
	test("renderiza cards de resumo", async ({ page }) => {
		await page.goto("/dashboard");
		// Page should not redirect to login (auth state from setup)
		await expect(page).not.toHaveURL(/\/login/);
		// Should have the main heading
		await expect(
			page.getByRole("heading", { name: /dashboard|revendê/i })
		).toBeVisible({ timeout: 10000 });
	});

	test("sidebar está visível no desktop", async ({ page }) => {
		await page.goto("/dashboard");
		// Sidebar has navigation links
		await expect(
			page.getByRole("link", { name: /produtos/i }).first()
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: /revendedores/i }).first()
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: /envios/i }).first()
		).toBeVisible();
	});

	test("links de navegação funcionam", async ({ page }) => {
		await page.goto("/dashboard");
		await page
			.getByRole("link", { name: /produtos/i })
			.first()
			.click();
		await expect(page).toHaveURL(/\/produtos/);
	});
});
