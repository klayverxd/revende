"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ProdutoData {
	nome: string;
	codigo?: string;
	descricao?: string;
	custo_producao?: number | null;
	estoque_minimo?: number;
}

async function gerarCodigo(): Promise<string> {
	const supabase = await createClient();
	const { data } = await supabase
		.from("modelo")
		.select("codigo")
		.like("codigo", "M%")
		.order("codigo", { ascending: false })
		.limit(1);

	if (!data || data.length === 0) return "M01";
	const last = data[0].codigo as string;
	const num = parseInt(last.replace("M", ""), 10);
	return `M${String(num + 1).padStart(2, "0")}`;
}

export async function criarProduto(data: ProdutoData) {
	const supabase = await createClient();
	const codigo = data.codigo?.trim() || (await gerarCodigo());

	const { error } = await supabase.from("modelo").insert({
		nome: data.nome,
		codigo,
		descricao: data.descricao ?? null,
		custo_producao: data.custo_producao ?? null,
		estoque_minimo: data.estoque_minimo ?? 0,
		ativo: true,
	});

	if (error) throw new Error(error.message);
	revalidatePath("/produtos");
}

export async function atualizarProduto(id: string, data: ProdutoData) {
	const supabase = await createClient();

	const { error } = await supabase
		.from("modelo")
		.update({
			nome: data.nome,
			codigo: data.codigo ?? undefined,
			descricao: data.descricao ?? null,
			custo_producao: data.custo_producao ?? null,
			estoque_minimo: data.estoque_minimo ?? 0,
		})
		.eq("modelo_id", id);

	if (error) throw new Error(error.message);
	revalidatePath("/produtos");
}

export async function deletarProdutos(ids: string[]) {
	const supabase = await createClient();

	const { error } = await supabase
		.from("modelo")
		.update({ deleted_at: new Date().toISOString() })
		.in("modelo_id", ids);

	if (error) throw new Error(error.message);
	revalidatePath("/produtos");
}

export async function ativarProdutos(ids: string[]) {
	const supabase = await createClient();

	const { error } = await supabase
		.from("modelo")
		.update({ ativo: true, deleted_at: null })
		.in("modelo_id", ids);

	if (error) throw new Error(error.message);
	revalidatePath("/produtos");
}

export async function desativarProdutos(ids: string[]) {
	const supabase = await createClient();

	const { error } = await supabase
		.from("modelo")
		.update({ ativo: false })
		.in("modelo_id", ids);

	if (error) throw new Error(error.message);
	revalidatePath("/produtos");
}
