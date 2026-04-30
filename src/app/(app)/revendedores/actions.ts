"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface RevendedorData {
	nome: string;
	telefone?: string;
	email?: string;
	endereco?: string;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
	comissao_fixa?: number | null;
	/** Armazenado como decimal: 0.30 = 30% */
	comissao_pct?: number | null;
	/** Valor mínimo padrão por unidade para este revendedor (VALOR_MINIMO) */
	valor_minimo_padrao?: number | null;
}

export async function criarRevendedor(
	data: RevendedorData
): Promise<{ revendedor_id: string }> {
	const supabase = await createClient();

	const { data: created, error } = await supabase
		.from("revendedor")
		.insert({
			nome: data.nome,
			telefone: data.telefone ?? null,
			email: data.email ?? null,
			endereco: data.endereco ?? null,
			modelo_acerto: data.modelo_acerto,
			comissao_fixa: data.comissao_fixa ?? 0,
			comissao_pct: data.comissao_pct ?? 0,
			valor_minimo_padrao: data.valor_minimo_padrao ?? null,
			ativo: true,
		})
		.select("revendedor_id")
		.single();

	if (error) throw new Error(error.message);
	revalidatePath("/revendedores");
	return { revendedor_id: created.revendedor_id as string };
}

export async function atualizarRevendedor(id: string, data: RevendedorData) {
	const supabase = await createClient();

	const { error } = await supabase
		.from("revendedor")
		.update({
			nome: data.nome,
			telefone: data.telefone ?? null,
			email: data.email ?? null,
			endereco: data.endereco ?? null,
			modelo_acerto: data.modelo_acerto,
			comissao_fixa: data.comissao_fixa ?? 0,
			comissao_pct: data.comissao_pct ?? 0,
			valor_minimo_padrao: data.valor_minimo_padrao ?? null,
		})
		.eq("revendedor_id", id);

	if (error) throw new Error(error.message);
	revalidatePath("/revendedores");
	revalidatePath(`/revendedores/${id}`);
}

export async function deletarRevendedores(ids: string[]) {
	const supabase = await createClient();

	for (const id of ids) {
		// Verificar envios abertos
		const { data: abertos } = await supabase
			.from("envio")
			.select("envio_id")
			.eq("revendedor_id", id)
			.eq("status", "ABERTO")
			.is("deleted_at", null)
			.limit(1);

		if (abertos && abertos.length > 0) {
			throw new Error(
				`Revendedor possui envios em aberto e não pode ser removido.`
			);
		}

		// Verificar histórico de envios
		const { data: historico } = await supabase
			.from("envio")
			.select("envio_id")
			.eq("revendedor_id", id)
			.limit(1);

		if (historico && historico.length > 0) {
			// Soft delete
			await supabase
				.from("revendedor")
				.update({ deleted_at: new Date().toISOString() })
				.eq("revendedor_id", id);
		} else {
			// Hard delete
			await supabase.from("revendedor").delete().eq("revendedor_id", id);
		}
	}

	revalidatePath("/revendedores");
}

export async function ativarRevendedores(ids: string[]) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("revendedor")
		.update({ ativo: true })
		.in("revendedor_id", ids);
	if (error) throw new Error(error.message);
	revalidatePath("/revendedores");
}

export async function desativarRevendedores(ids: string[]) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("revendedor")
		.update({ ativo: false })
		.in("revendedor_id", ids);
	if (error) throw new Error(error.message);
	revalidatePath("/revendedores");
}

export async function definirPrecoEmMassa(
	revendedorId: string,
	modeloIds: string[],
	valor: number,
	campo: "preco" | "valor_minimo"
) {
	const supabase = await createClient();

	for (const modeloId of modeloIds) {
		// Verificar se já existe faixa unitária para este par
		const { data: existente } = await supabase
			.from("revendedor_modelo_preco")
			.select("rev_preco_id")
			.eq("revendedor_id", revendedorId)
			.eq("modelo_id", modeloId)
			.eq("quantidade_minima", 1)
			.single();

		if (existente) {
			await supabase
				.from("revendedor_modelo_preco")
				.update({ [campo]: valor })
				.eq("rev_preco_id", existente.rev_preco_id);
		} else {
			await supabase.from("revendedor_modelo_preco").insert({
				revendedor_id: revendedorId,
				modelo_id: modeloId,
				rotulo: "Unitário",
				quantidade_minima: 1,
				preco: campo === "preco" ? valor : null,
				valor_minimo: campo === "valor_minimo" ? valor : null,
				eh_promocao: false,
				ativo: true,
			});
		}
	}

	revalidatePath(`/revendedores/${revendedorId}`);
}

/**
 * Aplica o valor_minimo_padrao do revendedor a todos os produtos ativos
 * que ainda não possuem faixa unitária personalizada.
 * Se sobrescrever=true, atualiza também os que já têm.
 */
export async function aplicarValorMinimoPadrao(
	revendedorId: string,
	valor: number,
	sobrescrever = false
) {
	const supabase = await createClient();

	// Buscar todos os modelos ativos
	const { data: modelos } = await supabase
		.from("modelo")
		.select("modelo_id")
		.eq("ativo", true)
		.is("deleted_at", null);

	if (!modelos || modelos.length === 0) return;

	for (const modelo of modelos) {
		const modeloId = modelo.modelo_id as string;

		const { data: existente } = await supabase
			.from("revendedor_modelo_preco")
			.select("rev_preco_id, valor_minimo")
			.eq("revendedor_id", revendedorId)
			.eq("modelo_id", modeloId)
			.eq("quantidade_minima", 1)
			.is("deleted_at", null)
			.maybeSingle();

		if (existente) {
			if (sobrescrever) {
				await supabase
					.from("revendedor_modelo_preco")
					.update({ valor_minimo: valor })
					.eq("rev_preco_id", existente.rev_preco_id);
			}
			// Se não sobrescrever, mantém o personalizado existente
		} else {
			await supabase.from("revendedor_modelo_preco").insert({
				revendedor_id: revendedorId,
				modelo_id: modeloId,
				rotulo: "Unitário",
				quantidade_minima: 1,
				preco: null,
				valor_minimo: valor,
				eh_promocao: false,
				ativo: true,
			});
		}
	}

	revalidatePath(`/revendedores/${revendedorId}`);
}
