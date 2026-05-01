import { test, expect } from "@playwright/test";

test.describe("Autenticação", () => {
	test.use({ storageState: undefined }); // overrides shared auth for this group

	test("redireciona / para /login quando não autenticado", async ({ page }) => {
		// Clear storage so we are not authenticated
		await page.context().clearCookies();
		await page.goto("/");
		await expect(page).toHaveURL(/\/login/);
	});

	test("redireciona /dashboard para /login quando não autenticado", async ({
		page,
	}) => {
		await page.context().clearCookies();
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/login/);
	});

	test("exibe página de login com campos obrigatórios", async ({ page }) => {
		await page.context().clearCookies();
		await page.goto("/login");
		await expect(page.getByLabel(/e-mail/i)).toBeVisible();
		await expect(page.getByLabel(/senha/i)).toBeVisible();
		await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
	});

	test("exibe erro com credenciais inválidas", async ({ page }) => {
		await page.context().clearCookies();
		await page.goto("/login");
		await page.getByLabel(/e-mail/i).fill("usuario@invalido.com");
		await page.getByLabel(/senha/i).fill("senhaerrada123");
		await page.getByRole("button", { name: /entrar/i }).click();
		await expect(page.getByText(/incorretos|inválido|erro/i)).toBeVisible({
			timeout: 8000,
		});
	});
});
