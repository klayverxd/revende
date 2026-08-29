import { createClient } from "@/lib/supabase/server";

export type PrecoOrigem = "MODELO" | "REVENDEDOR" | null;

export interface PrecoResolvido {
	preco: number | null;
	precoUnitario: number | null;
	valorMinimoUnit: number | null;
	origem: PrecoOrigem;
}

const VAZIO: PrecoResolvido = {
	preco: null,
	precoUnitario: null,
	valorMinimoUnit: null,
	origem: null,
};

/**
 * Preço padrão do modelo (faixa `quantidade_minima = 1`).
 *
 * Nota: apesar do nome "faixa", só a linha de quantidade 1 é lida — as demais
 * faixas de `modelo_preco` hoje servem só para exibição no catálogo.
 */
async function buscarPrecoModelo(
	supabase: Awaited<ReturnType<typeof createClient>>,
	modeloId: string
): Promise<PrecoResolvido> {
	const { data } = await supabase
		.from("modelo_preco")
		.select("preco")
		.eq("modelo_id", modeloId)
		.eq("quantidade_minima", 1)
		.eq("ativo", true)
		.is("deleted_at", null)
		.maybeSingle();

	if (!data) return VAZIO;

	return {
		preco: data.preco ?? null,
		precoUnitario: data.preco ?? null,
		valorMinimoUnit: null,
		origem: "MODELO",
	};
}

/**
 * Hierarquia de preço:
 * 1) `revendedor_modelo_preco` — o mais específico
 * 2) `modelo_preco` — o padrão do produto
 * 3) nulo — cai para entrada manual
 */
export async function resolverPreco(
	modeloId: string,
	revendedorId: string
): Promise<PrecoResolvido> {
	const supabase = await createClient();

	const { data: revRow } = await supabase
		.from("revendedor_modelo_preco")
		.select("preco, valor_minimo")
		.eq("revendedor_id", revendedorId)
		.eq("modelo_id", modeloId)
		.eq("quantidade_minima", 1)
		.eq("ativo", true)
		.is("deleted_at", null)
		.maybeSingle();

	if (revRow) {
		return {
			preco: revRow.preco ?? revRow.valor_minimo ?? null,
			precoUnitario: revRow.preco ?? null,
			valorMinimoUnit: revRow.valor_minimo ?? null,
			origem: "REVENDEDOR",
		};
	}

	return buscarPrecoModelo(supabase, modeloId);
}

/** Só o preço padrão do modelo, sem revendedor no meio (venda direta). */
export async function resolverPrecoModelo(
	modeloId: string
): Promise<PrecoResolvido> {
	const supabase = await createClient();
	return buscarPrecoModelo(supabase, modeloId);
}
