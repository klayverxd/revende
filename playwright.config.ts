import { defineConfig, devices } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, "tests/e2e/.auth/user.json");

// Ensure the auth directory and empty state file exist so Playwright
// doesn't fail when reading storageState before the setup test runs.
const authDir = path.dirname(authFile);
if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
if (!fs.existsSync(authFile)) {
	fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
}

/**
 * Playwright E2E configuration.
 * Tests run against the local Next.js dev server.
 *
 * Requires environment variables (in .env.test.local or process env):
 *   TEST_USER_EMAIL    — e-mail of a Supabase test user
 *   TEST_USER_PASSWORD — password of that user
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export default defineConfig({
	testDir: "./tests/e2e",
	timeout: 30_000,
	expect: { timeout: 5_000 },
	fullyParallel: false, // sequential to avoid DB conflicts
	retries: process.env.CI ? 2 : 0,
	reporter: [["list"], ["html", { open: "never" }]],

	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		// Persist auth state so login only runs once per worker
		storageState: "tests/e2e/.auth/user.json",
	},

	projects: [
		// Setup: login once and save auth state
		{
			name: "setup",
			testMatch: /global\.setup\.ts/,
			use: { storageState: undefined },
		},
		// All E2E tests run after setup
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
			dependencies: ["setup"],
		},
	],

	// Start Next.js dev server automatically when running tests
	webServer: {
		command: "npm run dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
