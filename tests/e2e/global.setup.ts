import { test as setup } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
	const email = process.env.TEST_USER_EMAIL;
	const password = process.env.TEST_USER_PASSWORD;

	if (!email || !password) {
		// If no credentials provided, create an empty auth state and skip
		const dir = path.dirname(authFile);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
		console.warn(
			"⚠  TEST_USER_EMAIL / TEST_USER_PASSWORD not set — E2E tests will run without auth (auth-required pages will be skipped or fail)"
		);
		return;
	}

	await page.goto("/login");
	await page.getByLabel(/e-mail/i).fill(email);
	await page.getByLabel(/senha/i).fill(password);
	await page.getByRole("button", { name: /entrar/i }).click();
	await page.waitForURL("/dashboard");

	await page.context().storageState({ path: authFile });
});
