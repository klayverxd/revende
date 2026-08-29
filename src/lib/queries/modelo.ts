import { createClient } from "@/lib/supabase/server";

/**
 * Próximo código sequencial de produto (`M01`, `M02`, …).
 *
 * Existia em 3 cópias (calculadora, produtos e estoque), todas usando
 * `.order("codigo", { ascending: false }).limit(1)` — ordenação de **texto**,
 * que funciona até `M99` e depois erra: `"M100" < "M99"` lexicograficamente,
 * então o 101º produto reciclaria um código já usado. Aqui o máximo é
 * calculado numericamente.
 */
export async function gerarCodigoModelo(): Promise<string> {
	const supabase = await createClient();

	const { data } = await supabase
		.from("modelo")
		.select("codigo")
		.like("codigo", "M%");

	let maior = 0;
	for (const row of data ?? []) {
		const codigo = row.codigo as string | null;
		if (!codigo) continue;
		const num = Number.parseInt(codigo.slice(1), 10);
		if (Number.isFinite(num) && num > maior) maior = num;
	}

	return `M${String(maior + 1).padStart(2, "0")}`;
}
