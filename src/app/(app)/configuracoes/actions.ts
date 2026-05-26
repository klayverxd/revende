"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ─── Desfazer Conferência ────────────────────────────────────────────────────
// Reverte um envio CONFERIDO ou ENCERRADO de volta para ABERTO,
// zerando as quantidades vendidas/devolvidas nos itens e
// apagando (soft delete) o acerto associado.
export async function desfazerConferencia(envioId: string) {
	if (!envioId) throw new Error("Envio inválido");

	const supabase = await createClient();

	const { data: envio, error: envioError } = await supabase
		.from("envio")
		.select("envio_id, status")
		.eq("envio_id", envioId)
		.is("deleted_at", null)
		.single();

	if (envioError || !envio) throw new Error("Envio não encontrado");
	if (!["CONFERIDO", "ENCERRADO"].includes(envio.status as string)) {
		throw new Error("Apenas envios CONFERIDO ou ENCERRADO podem ser desfeitos");
	}

	// Soft delete do acerto associado
	const { error: acertoError } = await supabase
		.from("acerto")
		.update({ deleted_at: new Date().toISOString() })
		.eq("envio_id", envioId)
		.is("deleted_at", null);

	if (acertoError) throw new Error(acertoError.message);

	// Zerar quantidades vendidas/devolvidas e valores nos itens
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
		.eq("envio_id", envioId)
		.is("deleted_at", null);

	if (itensError) throw new Error(itensError.message);

	// Voltar status do envio para ABERTO
	const { error: envioUpdateError } = await supabase
		.from("envio")
		.update({ status: "ABERTO" })
		.eq("envio_id", envioId);

	if (envioUpdateError) throw new Error(envioUpdateError.message);

	revalidatePath("/configuracoes");
	revalidatePath("/conferencias");
	revalidatePath("/financeiro");
}

// ─── Desfazer Recebimento de Acerto ─────────────────────────────────────────
// Reverte um acerto RECEBIDO de volta para PENDENTE e,
// se o envio estava ENCERRADO, volta para CONFERIDO.
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

	// Voltar acerto para PENDENTE
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

	// Se o envio estava ENCERRADO, volta para CONFERIDO
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
	| "envios"
	| "modelos"
	| "revendedores"
	| "vendas"
	| "producoes"
	| "calculadora"
	| "tudo";

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
		case "envios": {
			// acerto → envio_item → envio
			await softDeleteAll(supabase, "acerto");
			await softDeleteAll(supabase, "envio_item");
			await softDeleteAll(supabase, "envio");
			break;
		}
		case "modelos": {
			// revendedor_modelo_preco → modelo_preco → modelo
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
			// config_energia não tem deleted_at — apagar diretamente
			const { error: energiaError } = await supabase
				.from("config_energia")
				.delete()
				.neq("id", "00000000-0000-0000-0000-000000000000"); // deleta tudo do usuário
			if (energiaError)
				throw new Error(
					`Erro ao limpar config_energia: ${energiaError.message}`
				);
			break;
		}
		case "tudo": {
			// Ordem: dependentes primeiro
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
				throw new Error(
					`Erro ao limpar config_energia: ${energiaError.message}`
				);
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
		"/configuracoes",
		"/dashboard",
		"/envios",
		"/conferencias",
		"/financeiro",
		"/estoque",
		"/produtos",
		"/revendedores",
		"/venda-direta",
		"/calculadora",
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
