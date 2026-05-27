"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ─── Desfazer Conferência ────────────────────────────────────────────────────
// Reverte todos os envios com conferência pendente de um revendedor:
// - Busca via acertos PENDENTE (cobre envios ABERTO com conferência parcial)
// - Busca via envios CONFERIDO/ENCERRADO (sem acerto pendente)
// - Zera itens, apaga acertos, reverte status para ABERTO
export async function desfazerConferencia(revendedorId: string) {
	if (!revendedorId) throw new Error("Revendedor inválido");

	const supabase = await createClient();
	const deletedAt = new Date().toISOString();

	// Acertos pendentes (inclui conferências parciais onde envio ficou ABERTO)
	const { data: acertosPendentes, error: acertosError } = await supabase
		.from("acerto")
		.select("acerto_id, envio_id")
		.eq("revendedor_id", revendedorId)
		.eq("status", "PENDENTE")
		.is("deleted_at", null);

	if (acertosError) throw new Error(acertosError.message);

	// Envios CONFERIDO/ENCERRADO (podem não ter acerto pendente se já foi recebido)
	const { data: enviosConferidos, error: enviosError } = await supabase
		.from("envio")
		.select("envio_id")
		.eq("revendedor_id", revendedorId)
		.in("status", ["CONFERIDO", "ENCERRADO"])
		.is("deleted_at", null);

	if (enviosError) throw new Error(enviosError.message);

	const envioIdsSet = new Set<string>([
		...(acertosPendentes ?? []).map(a => a.envio_id as string).filter(Boolean),
		...(enviosConferidos ?? []).map(e => e.envio_id as string),
	]);

	if ((acertosPendentes ?? []).length === 0 && envioIdsSet.size === 0) {
		throw new Error("Nenhuma conferência encontrada para este revendedor");
	}

	// Soft delete dos acertos pendentes
	if (acertosPendentes && acertosPendentes.length > 0) {
		const ids = acertosPendentes.map(a => a.acerto_id as string);
		const { error } = await supabase
			.from("acerto")
			.update({ deleted_at: deletedAt })
			.in("acerto_id", ids);
		if (error) throw new Error(error.message);
	}

	const envioIds = [...envioIdsSet];

	if (envioIds.length > 0) {
		// Zerar dados de conferência nos itens
		const { error: itensError } = await supabase
			.from("envio_item")
			.update({
				qtd_vendida: 0,
				qtd_devolvida: null,
				valor_total_venda: null,
				valor_a_receber: null,
				preco_cliente: null,
				modo_valor: "CALCULADO",
			})
			.in("envio_id", envioIds)
			.is("deleted_at", null);

		if (itensError) throw new Error(itensError.message);

		// Só reverte CONFERIDO/ENCERRADO para ABERTO (ABERTO já está correto)
		const { error: envioUpdateError } = await supabase
			.from("envio")
			.update({ status: "ABERTO" })
			.in("envio_id", envioIds)
			.in("status", ["CONFERIDO", "ENCERRADO"]);

		if (envioUpdateError) throw new Error(envioUpdateError.message);
	}

	revalidatePath("/configuracoes");
	revalidatePath("/conferencias");
	revalidatePath("/financeiro");
	revalidatePath("/financeiro", "layout");
	revalidatePath("/dashboard");
}

// ─── Desfazer Recebimento de Acerto ─────────────────────────────────────────
export async function desfazerRecebimento(acertoId: string) {
	if (!acertoId) throw new Error("Acerto inválido");

	const supabase = await createClient();

	const { data: acerto, error: acertoError } = await supabase
		.from("acerto")
		.select("acerto_id, envio_id, status")
		.eq("acerto_id", acertoId)
		.is("deleted_at", null)
		.single();

	if (acertoError || !acerto) throw new Error("Acerto não encontrado");
	if ((acerto.status as string) !== "RECEBIDO") {
		throw new Error("Apenas acertos RECEBIDO podem ser desfeitos");
	}

	const { error: updateAcertoError } = await supabase
		.from("acerto")
		.update({
			status: "PENDENTE",
			data_recebimento: null,
			valor_repassado: null,
			observacao: null,
		})
		.eq("acerto_id", acertoId);

	if (updateAcertoError) throw new Error(updateAcertoError.message);

	// Se envio estava ENCERRADO, volta para CONFERIDO
	const { error: envioUpdateError } = await supabase
		.from("envio")
		.update({ status: "CONFERIDO" })
		.eq("envio_id", acerto.envio_id as string)
		.eq("status", "ENCERRADO");

	if (envioUpdateError) throw new Error(envioUpdateError.message);

	revalidatePath("/configuracoes");
	revalidatePath("/conferencias");
	revalidatePath("/financeiro");
}

// ─── Limpar Dados por Grupo ──────────────────────────────────────────────────

export type GrupoLimpeza =
	| "conferencias"
	| "envios"
	| "modelos"
	| "revendedores"
	| "vendas"
	| "producoes"
	| "calculadora"
	| "tudo";

async function limparConferenciasInterno(
	supabase: Awaited<ReturnType<typeof createClient>>,
	revendedorId: string | null
) {
	const deletedAt = new Date().toISOString();

	// Acertos pendentes (filtrando por revendedor se informado)
	let acertoQuery = supabase
		.from("acerto")
		.select("acerto_id, envio_id")
		.eq("status", "PENDENTE")
		.is("deleted_at", null);
	if (revendedorId) acertoQuery = acertoQuery.eq("revendedor_id", revendedorId);
	const { data: acertosPendentes } = await acertoQuery;

	// Envios CONFERIDO/ENCERRADO
	let envioQuery = supabase
		.from("envio")
		.select("envio_id")
		.in("status", ["CONFERIDO", "ENCERRADO"])
		.is("deleted_at", null);
	if (revendedorId) envioQuery = envioQuery.eq("revendedor_id", revendedorId);
	const { data: enviosConferidos } = await envioQuery;

	const envioIdsSet = new Set<string>([
		...(acertosPendentes ?? []).map(a => a.envio_id as string).filter(Boolean),
		...(enviosConferidos ?? []).map(e => e.envio_id as string),
	]);

	// Soft delete acertos pendentes
	if (acertosPendentes && acertosPendentes.length > 0) {
		const ids = acertosPendentes.map(a => a.acerto_id as string);
		await supabase
			.from("acerto")
			.update({ deleted_at: deletedAt })
			.in("acerto_id", ids);
	}

	const envioIds = [...envioIdsSet];
	if (envioIds.length === 0) return;

	// Zera dados de conferência nos itens
	await supabase
		.from("envio_item")
		.update({
			qtd_vendida: 0,
			qtd_devolvida: null,
			valor_total_venda: null,
			valor_a_receber: null,
			preco_cliente: null,
			modo_valor: "CALCULADO",
		})
		.in("envio_id", envioIds)
		.is("deleted_at", null);

	// Reverte envios CONFERIDO/ENCERRADO para ABERTO
	await supabase
		.from("envio")
		.update({ status: "ABERTO" })
		.in("envio_id", envioIds)
		.in("status", ["CONFERIDO", "ENCERRADO"]);
}

export async function limparConferenciasRevendedor(revendedorId: string) {
	if (!revendedorId) throw new Error("Revendedor inválido");
	const supabase = await createClient();
	await limparConferenciasInterno(supabase, revendedorId);
	revalidatePath("/configuracoes");
	revalidatePath("/conferencias");
	revalidatePath("/financeiro");
	revalidatePath("/financeiro", "layout");
	revalidatePath("/dashboard");
}

async function softDeleteAll(
	supabase: Awaited<ReturnType<typeof createClient>>,
	tabela: string
) {
	const { error } = await supabase
		.from(tabela)
		.update({ deleted_at: new Date().toISOString() })
		.is("deleted_at", null);
	if (error) throw new Error(`Erro ao limpar ${tabela}: ${error.message}`);
}

export async function limparDados(grupo: GrupoLimpeza) {
	const supabase = await createClient();

	switch (grupo) {
		case "conferencias": {
			await limparConferenciasInterno(supabase, null);
			break;
		}
		case "envios": {
			await softDeleteAll(supabase, "acerto");
			await softDeleteAll(supabase, "envio_item");
			await softDeleteAll(supabase, "envio");
			break;
		}
		case "modelos": {
			await softDeleteAll(supabase, "revendedor_modelo_preco");
			await softDeleteAll(supabase, "modelo_preco");
			await softDeleteAll(supabase, "modelo");
			break;
		}
		case "revendedores": {
			await softDeleteAll(supabase, "revendedor_modelo_preco");
			await softDeleteAll(supabase, "revendedor");
			break;
		}
		case "vendas": {
			await softDeleteAll(supabase, "venda_direta_item");
			await softDeleteAll(supabase, "venda_direta");
			break;
		}
		case "producoes": {
			await softDeleteAll(supabase, "producao");
			break;
		}
		case "calculadora": {
			await softDeleteAll(supabase, "calculo_custo");
			await softDeleteAll(supabase, "config_equipamento");
			await softDeleteAll(supabase, "config_materia_prima");
			const { error: energiaError } = await supabase
				.from("config_energia")
				.delete()
				.neq("id", "00000000-0000-0000-0000-000000000000");
			if (energiaError)
				throw new Error(`Erro ao limpar config_energia: ${energiaError.message}`);
			break;
		}
		case "tudo": {
			await softDeleteAll(supabase, "acerto");
			await softDeleteAll(supabase, "envio_item");
			await softDeleteAll(supabase, "envio");
			await softDeleteAll(supabase, "venda_direta_item");
			await softDeleteAll(supabase, "venda_direta");
			await softDeleteAll(supabase, "producao");
			await softDeleteAll(supabase, "calculo_custo");
			await softDeleteAll(supabase, "config_equipamento");
			await softDeleteAll(supabase, "config_materia_prima");
			const { error: energiaError } = await supabase
				.from("config_energia")
				.delete()
				.neq("id", "00000000-0000-0000-0000-000000000000");
			if (energiaError)
				throw new Error(`Erro ao limpar config_energia: ${energiaError.message}`);
			await softDeleteAll(supabase, "revendedor_modelo_preco");
			await softDeleteAll(supabase, "modelo_preco");
			await softDeleteAll(supabase, "modelo");
			await softDeleteAll(supabase, "revendedor");
			break;
		}
		default:
			throw new Error("Grupo inválido");
	}

	const paths = [
		"/configuracoes", "/dashboard", "/envios", "/conferencias",
		"/financeiro", "/estoque", "/produtos", "/revendedores",
		"/venda-direta", "/calculadora",
	];
	for (const p of paths) revalidatePath(p);
}

// ─── Equipe ──────────────────────────────────────────────────────────────────

export interface MembroEquipe {
	id: string;
	email_convidado: string;
	membro_id: string | null;
	created_at: string;
}

export async function buscarEquipe(): Promise<MembroEquipe[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("membro_equipe")
		.select("id, email_convidado, membro_id, created_at")
		.order("created_at", { ascending: true });
	if (error) throw new Error(error.message);
	return data ?? [];
}

export async function convidarMembro(email: string): Promise<MembroEquipe> {
	const email_norm = email.trim().toLowerCase();
	if (!email_norm) throw new Error("E-mail inválido");

	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error("Não autenticado");

	const { data, error } = await supabase
		.from("membro_equipe")
		.insert({ dono_id: user.id, email_convidado: email_norm })
		.select("id, email_convidado, membro_id, created_at")
		.single();

	if (error) {
		if (error.code === "23505") throw new Error("Este e-mail já foi convidado.");
		throw new Error(error.message);
	}

	revalidatePath("/configuracoes");
	return data;
}

export async function removerMembro(membroEquipeId: string) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("membro_equipe")
		.delete()
		.eq("id", membroEquipeId);
	if (error) throw new Error(error.message);
	revalidatePath("/configuracoes");
}
