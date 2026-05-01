"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Salva preço personalizado para um revendedor. Passa null para remover. */
export async function salvarPrecoRevendedor(
	revendedorId: string,
	modeloId: string,
	precoUnit: number | null,
	valorMinimo: number | null
) {
	const supabase = await createClient();
	await supabase
		.from("revendedor_modelo_preco")
		.delete()
		.eq("revendedor_id", revendedorId)
		.eq("modelo_id", modeloId);
	if (precoUnit !== null || valorMinimo !== null) {
		const { error } = await supabase.from("revendedor_modelo_preco").insert({
			revendedor_id: revendedorId,
			modelo_id: modeloId,
			quantidade_minima: 1,
			rotulo: "Unitário",
			preco: precoUnit ?? null,
			valor_minimo: valorMinimo ?? null,

			ativo: true,
		});
		if (error) throw new Error(error.message);
	}
	revalidatePath(`/produtos/${modeloId}/precos`);
}

export interface FaixaPrecoData {
	rotulo: string;
	quantidade_minima: number;
	preco: number;
}

export async function criarFaixaPreco(modeloId: string, data: FaixaPrecoData) {
	const supabase = await createClient();
	const { error } = await supabase.from("modelo_preco").insert({
		modelo_id: modeloId,
		rotulo: data.rotulo,
		quantidade_minima: data.quantidade_minima,
		preco: data.preco,
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
