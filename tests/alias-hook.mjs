/**
 * Resolve o alias `@/*` → `src/*` para o test runner do Node.
 *
 * Sem isto os testes unitários teriam que copiar a lógica do fonte (era o que
 * acontecia antes: `tests/unit/calculo.test.ts` duplicava as funções e passava
 * enquanto a produção divergia). Com o hook, o teste importa exatamente o
 * mesmo módulo que o app importa.
 *
 * Uso: node --experimental-strip-types --import ./tests/alias-hook.mjs ...
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Tenta os sufixos que o bundler tentaria, na mesma ordem. */
function resolverArquivo(base) {
	const candidatos = [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		path.join(base, "index.ts"),
		path.join(base, "index.tsx"),
	];
	for (const c of candidatos) {
		if (existsSync(c) && !c.endsWith(path.sep)) {
			try {
				// Diretórios existem mas não são módulos; só aceita arquivo.
				if (path.extname(c)) return c;
			} catch {
				/* ignora */
			}
		}
	}
	return null;
}

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (!specifier.startsWith("@/")) {
			return nextResolve(specifier, context);
		}

		const alvo = resolverArquivo(path.join(SRC, specifier.slice(2)));
		if (!alvo) {
			throw new Error(
				`Alias "@/" não resolvido: ${specifier} (procurado em ${SRC})`
			);
		}

		return { url: pathToFileURL(alvo).href, shortCircuit: true };
	},
});
