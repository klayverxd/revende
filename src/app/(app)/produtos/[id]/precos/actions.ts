"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Salva os dois preços padrão do produto (unitário e 2+). */
export async function salvarPrecoProduto(
	modeloId: string,
	precoUnit: number | null,
	preco2mais: number | null
) {
	const supabase = await createClient();
	await supabase.from("modelo_preco").delete().eq("modelo_id", modeloId);
	const rows = [];
	if (precoUnit !== null)
		rows.push({
			modelo_id: modeloId,
			quantidade_minima: 1,
			rotulo: "Unitário",
			preco: precoUnit,
			eh_promocao: false,
			ativo: true,
		});
	if (preco2mais !== null)
		rows.push({
			modelo_id: modeloId,
			quantidade_minima: 2,
			rotulo: "2 ou mais",
			preco: preco2mais,
			eh_promocao: false,
			ativo: true,
		});
	if (rows.length > 0) {
		const { error } = await supabase.from("modelo_preco").insert(rows);
		if (error) throw new Error(error.message);
	}
	revalidatePath(`/produtos/${modeloId}/precos`);
}

/** Salva preços personalizados para um revendedor. Passa null para remover. */
export async function salvarPrecoRevendedor(
	revendedorId: string,
	modeloId: string,
	precoUnit: number | null,
	preco2mais: number | null,
	valorMinimo: number | null
) {
	const supabase = await createClient();
	await supabase
		.from("revendedor_modelo_preco")
		.delete()
		.eq("revendedor_id", revendedorId)
		.eq("modelo_id", modeloId);
	const rows = [];
	if (precoUnit !== null || valorMinimo !== null)
		rows.push({
			revendedor_id: revendedorId,
			modelo_id: modeloId,
			quantidade_minima: 1,
			rotulo: "Unitário",
			preco: precoUnit ?? null,
			valor_minimo: valorMinimo ?? null,
			eh_promocao: false,
			ativo: true,
		});
	if (preco2mais !== null)
		rows.push({
			revendedor_id: revendedorId,
			modelo_id: modeloId,
			quantidade_minima: 2,
			rotulo: "2 ou mais",
			preco: preco2mais ?? null,
			valor_minimo: null,
			eh_promocao: false,
			ativo: true,
		});
	if (rows.length > 0) {
		const { error } = await supabase
			.from("revendedor_modelo_preco")
			.insert(rows);
		if (error) throw new Error(error.message);
	}
	revalidatePath(`/produtos/${modeloId}/precos`);
}

export interface FaixaPrecoData {
	rotulo: string;
	quantidade_minima: number;
	preco: number;
	eh_promocao?: boolean;
}

export async function criarFaixaPreco(modeloId: string, data: FaixaPrecoData) {
	const supabase = await createClient();
	const { error } = await supabase.from("modelo_preco").insert({
		modelo_id: modeloId,
		rotulo: data.rotulo,
		quantidade_minima: data.quantidade_minima,
		preco: data.preco,
		eh_promocao: data.eh_promocao ?? false,
		ativo: true,
	});
	if (error) throw new Error(error.message);
	revalidatePath(`/produtos/${modeloId}/precos`);
}

export async function atualizarFaixaPreco(
	precoId: string,
	data: Partial<FaixaPrecoData>
) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("modelo_preco")
		.update(data)
		.eq("preco_id", precoId);
	if (error) throw new Error(error.message);
	// revalidate handled by caller passing modeloId
}

export async function atualizarFaixaPrecoComRevalidate(
	precoId: string,
	modeloId: string,
	data: Partial<FaixaPrecoData>
) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("modelo_preco")
		.update(data)
		.eq("preco_id", precoId);
	if (error) throw new Error(error.message);
	revalidatePath(`/produtos/${modeloId}/precos`);
}

export async function deletarFaixaPreco(precoId: string, modeloId: string) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("modelo_preco")
		.delete()
		.eq("preco_id", precoId);
	if (error) throw new Error(error.message);
	revalidatePath(`/produtos/${modeloId}/precos`);
}

export async function criarFaixaPrecoRevendedor(
	revendedorId: string,
	modeloId: string,
	data: FaixaPrecoData & { valor_minimo?: number }
) {
	const supabase = await createClient();
	const { error } = await supabase.from("revendedor_modelo_preco").insert({
		revendedor_id: revendedorId,
		modelo_id: modeloId,
		rotulo: data.rotulo,
		quantidade_minima: data.quantidade_minima,
		preco: data.preco,
		valor_minimo: data.valor_minimo ?? null,
		eh_promocao: data.eh_promocao ?? false,
		ativo: true,
	});
	if (error) throw new Error(error.message);
	revalidatePath(`/produtos/${modeloId}/precos`);
}

export async function deletarFaixasRevendedor(
	revendedorId: string,
	modeloId: string
) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("revendedor_modelo_preco")
		.delete()
		.eq("revendedor_id", revendedorId)
		.eq("modelo_id", modeloId);
	if (error) throw new Error(error.message);
	revalidatePath(`/produtos/${modeloId}/precos`);
}

export async function toggleFaixaAtivo(
	precoId: string,
	modeloId: string,
	ativo: boolean
) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("modelo_preco")
		.update({ ativo })
		.eq("preco_id", precoId);
	if (error) throw new Error(error.message);
	revalidatePath(`/produtos/${modeloId}/precos`);
}
