import { createClient } from "@/lib/supabase/server";

export type PrecoOrigem = "MODELO" | "REVENDEDOR" | null;

export interface PrecoResolvido {
	preco: number | null;
	precoUnitario: number | null;
	preco2mais: number | null;
	valorMinimoUnit: number | null;
	origem: PrecoOrigem;
}

interface FaixaPreco {
	quantidade_minima: number;
	preco: number | null;
	valor_minimo: number | null;
}

function pickFaixaPorQuantidade(faixas: FaixaPreco[], quantidade: number) {
	const ordenadas = [...faixas].sort(
		(a, b) => a.quantidade_minima - b.quantidade_minima
	);
	let selecionada: FaixaPreco | null = null;
	for (const f of ordenadas) {
		if (quantidade >= f.quantidade_minima) selecionada = f;
	}
	return selecionada;
}

function pickSnapshot(faixas: FaixaPreco[]) {
	const faixa1 = faixas.find(f => f.quantidade_minima === 1) ?? null;
	const faixa2 =
		faixas
			.filter(f => f.quantidade_minima >= 2)
			.sort((a, b) => a.quantidade_minima - b.quantidade_minima)[0] ?? null;

	return {
		precoUnitario: faixa1?.preco ?? null,
		preco2mais: faixa2?.preco ?? null,
		valorMinimoUnit: faixa1?.valor_minimo ?? null,
	};
}

/**
 * Hierarquia de preço:
 * 1) revendedor_modelo_preco
 * 2) modelo_preco
 * 3) null (manual)
 */
export async function resolverPreco(
	modeloId: string,
	revendedorId: string,
	quantidade: number
): Promise<PrecoResolvido> {
	const supabase = await createClient();

	const { data: precosRev } = await supabase
		.from("revendedor_modelo_preco")
		.select("quantidade_minima, preco, valor_minimo")
		.eq("revendedor_id", revendedorId)
		.eq("modelo_id", modeloId)
		.eq("ativo", true)
		.is("deleted_at", null);

	if (precosRev && precosRev.length > 0) {
		const faixas = (precosRev as FaixaPreco[]).filter(
			f => f.preco !== null || f.valor_minimo !== null
		);
		const aplicada = pickFaixaPorQuantidade(faixas, quantidade);
		const snapshots = pickSnapshot(faixas);
		return {
			preco: aplicada?.preco ?? aplicada?.valor_minimo ?? null,
			precoUnitario: snapshots.precoUnitario,
			preco2mais: snapshots.preco2mais,
			valorMinimoUnit: snapshots.valorMinimoUnit,
			origem: "REVENDEDOR",
		};
	}

	const { data: precosModelo } = await supabase
		.from("modelo_preco")
		.select("quantidade_minima, preco")
		.eq("modelo_id", modeloId)
		.eq("ativo", true)
		.is("deleted_at", null);

	if (precosModelo && precosModelo.length > 0) {
		const faixas = (
			precosModelo as Array<{ quantidade_minima: number; preco: number }>
		).map(f => ({
			quantidade_minima: f.quantidade_minima,
			preco: f.preco,
			valor_minimo: null,
		}));
		const aplicada = pickFaixaPorQuantidade(faixas, quantidade);
		const snapshots = pickSnapshot(faixas);
		return {
			preco: aplicada?.preco ?? null,
			precoUnitario: snapshots.precoUnitario,
			preco2mais: snapshots.preco2mais,
			valorMinimoUnit: null,
			origem: "MODELO",
		};
	}

	return {
		preco: null,
		precoUnitario: null,
		preco2mais: null,
		valorMinimoUnit: null,
		origem: null,
	};
}
