"use server";

import { createClient } from "@/lib/supabase/server";
import { buscarEstoque } from "@/app/(app)/estoque/actions";

export interface ProdutoDisponivelServer {
	modelo_id: string;
	codigo: string | null;
	nome: string;
	estoque_disponivel: number;
	custo_producao: number | null;
}

export async function buscarProdutosDisponiveis(): Promise<ProdutoDisponivelServer[]> {
	const supabase = await createClient();
	const [{ data: modelos }, estoque] = await Promise.all([
		supabase
			.from("modelo")
			.select("modelo_id, codigo, nome, custo_producao")
			.eq("ativo", true)
			.is("deleted_at", null)
			.order("nome"),
		buscarEstoque(),
	]);
	const estoqueMap = new Map(estoque.map(r => [r.modelo_id, r.disponivel]));
	return (modelos ?? []).map(p => ({
		modelo_id: p.modelo_id as string,
		codigo: (p.codigo as string | null) ?? null,
		nome: p.nome as string,
		estoque_disponivel: estoqueMap.get(p.modelo_id as string) ?? 0,
		custo_producao: (p.custo_producao as number | null) ?? null,
	}));
}

export interface DraftState {
	revendedorId: string;
	itens: unknown[];
	step: 1 | 2 | 3;
	dataEnvio: string;
	observacao: string;
}

export async function salvarRascunhoServidor(draft: DraftState): Promise<void> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return;

	await supabase.from("envio_draft").upsert(
		{
			user_id: user.id,
			draft_json: draft,
			updated_at: new Date().toISOString(),
		},
		{ onConflict: "user_id" }
	);
}

export async function carregarRascunhoServidor(): Promise<DraftState | null> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	const { data } = await supabase
		.from("envio_draft")
		.select("draft_json")
		.eq("user_id", user.id)
		.single();

	if (!data?.draft_json) return null;
	return data.draft_json as DraftState;
}

export async function limparRascunhoServidor(): Promise<void> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return;

	await supabase.from("envio_draft").delete().eq("user_id", user.id);
}
