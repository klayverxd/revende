import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * `eslint-config-next@15` só publica configs no formato legado (.eslintrc),
 * então precisa passar pelo FlatCompat. A versão anterior deste arquivo
 * importava `eslint-config-next/core-web-vitals` como se fosse flat config
 * ESM — o que só existe no eslint-config-next 16 — e por isso `npm run lint`
 * falhava com ERR_MODULE_NOT_FOUND desde sempre.
 */
const compat = new FlatCompat({
	baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

export default defineConfig([
	globalIgnores([
		".next/**",
		"out/**",
		"build/**",
		"next-env.d.ts",
		"playwright-report/**",
		"test-results/**",
		// Gerado a partir das migrations — nao editar, nao lintar.
		"src/lib/db/types.ts",
		// Temporarios do teste de contrato, caso uma execucao seja interrompida.
		"src/.contrato-*/**",
	]),
	...compat.extends("next/core-web-vitals", "next/typescript"),
]);
