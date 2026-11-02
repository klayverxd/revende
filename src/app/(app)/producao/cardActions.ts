"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validar, zTexto, zUuid } from "@/lib/validacao";

/**
 * Checklists, comentários e etiquetas do card.
 *
 * Separado de `actions.ts` (que cuida do card em si e da esteira) só para
 * manter cada arquivo legível — são as duas metades do mesmo módulo.
 */

function revalidar(pedidoId: string) {
	revalidatePath("/producao");
	revalidatePath(`/producao/${pedidoId}`);
	revalidatePath("/hoje");
}

/** Descobre o pedido dono de uma checklist, para revalidar a rota certa. */
async function pedidoDaChecklist(
	supabase: Awaited<ReturnType<typeof createClient>>,
	checklistId: string
): Promise<string> {
	const { data } = await supabase
		.from("pedido_checklist")
		.select("pedido_id")
		.eq("checklist_id", checklistId)
		.is("deleted_at", null)
		.single();
	if (!data) throw new Error("Checklist não encontrada");
	return data.pedido_id as string;
}

// ─── Checklists ───────────────────────────────────────────────────────────

export async function criarChecklist(pedidoId: string, titulo: string) {
	const dados = validar(
		z.object({ pedidoId: zUuid, titulo: zTexto(120) }),
		{ pedidoId, titulo },
		"Não foi possível criar a checklist"
	);

	const supabase = await createClient();

	const { data: ultima } = await supabase
		.from("pedido_checklist")
		.select("ordem")
		.eq("pedido_id", dados.pedidoId)
		.is("deleted_at", null)
		.order("ordem", { ascending: false })
		.limit(1)
		.maybeSingle();

	const { data, error } = await supabase
		.from("pedido_checklist")
		.insert({
			pedido_id: dados.pedidoId,
			titulo: dados.titulo,
			ordem: (ultima?.ordem ?? 0) + 1,
		})
		.select("checklist_id")
		.single();

	if (error) throw new Error(error.message);
	revalidar(dados.pedidoId);
	return { checklistId: data.checklist_id as string };
}

export async function renomearChecklist(checklistId: string, titulo: string) {
	const dados = validar(
		z.object({ checklistId: zUuid, titulo: zTexto(120) }),
		{ checklistId, titulo },
		"Não foi possível renomear"
	);

	const supabase = await createClient();
	const pedidoId = await pedidoDaChecklist(supabase, dados.checklistId);

	const { error } = await supabase
		.from("pedido_checklist")
		.update({ titulo: dados.titulo })
		.eq("checklist_id", dados.checklistId);

	if (error) throw new Error(error.message);
	revalidar(pedidoId);
}

export async function removerChecklist(checklistId: string) {
	validar(z.object({ checklistId: zUuid }), { checklistId }, "Checklist inválida");

	const supabase = await createClient();
	const pedidoId = await pedidoDaChecklist(supabase, checklistId);

	// Soft delete, como todo o resto do sistema. Os itens somem com ela na
	// leitura porque a query filtra pela checklist ativa.
	const { error } = await supabase
		.from("pedido_checklist")
		.update({ deleted_at: new Date().toISOString() })
		.eq("checklist_id", checklistId);

	if (error) throw new Error(error.message);
	revalidar(pedidoId);
}

export async function adicionarItemChecklist(
	checklistId: string,
	texto: string
) {
	const dados = validar(
		z.object({ checklistId: zUuid, texto: zTexto(500) }),
		{ checklistId, texto },
		"Não foi possível adicionar o item"
	);

	const supabase = await createClient();
	const pedidoId = await pedidoDaChecklist(supabase, dados.checklistId);

	const { data: ultimo } = await supabase
		.from("pedido_checklist_item")
		.select("ordem")
		.eq("checklist_id", dados.checklistId)
		.is("deleted_at", null)
		.order("ordem", { ascending: false })
		.limit(1)
		.maybeSingle();

	const { error } = await supabase.from("pedido_checklist_item").insert({
		checklist_id: dados.checklistId,
		texto: dados.texto,
		ordem: (ultimo?.ordem ?? 0) + 1,
	});

	if (error) throw new Error(error.message);
	revalidar(pedidoId);
}

export async function marcarItemChecklist(itemId: string, concluido: boolean) {
	const dados = validar(
		z.object({ itemId: zUuid, concluido: z.boolean() }),
		{ itemId, concluido },
		"Não foi possível marcar o item"
	);

	const supabase = await createClient();

	const { data: item } = await supabase
		.from("pedido_checklist_item")
		.select("checklist:checklist_id(pedido_id)")
		.eq("item_id", dados.itemId)
		.single();

	const rel = item?.checklist as unknown as { pedido_id: string } | null;
	const pedidoId = Array.isArray(rel) ? rel[0]?.pedido_id : rel?.pedido_id;

	const { error } = await supabase
		.from("pedido_checklist_item")
		.update({
			concluido: dados.concluido,
			// Guarda quando foi marcado: é o dado que permite medir tempo de
			// acabamento depois, sem precisar de tabela de histórico.
			concluido_em: dados.concluido ? new Date().toISOString() : null,
		})
		.eq("item_id", dados.itemId);

	if (error) throw new Error(error.message);
	if (pedidoId) revalidar(pedidoId);
}

export async function editarItemChecklist(itemId: string, texto: string) {
	const dados = validar(
		z.object({ itemId: zUuid, texto: zTexto(500) }),
		{ itemId, texto },
		"Não foi possível salvar o item"
	);

	const supabase = await createClient();
	const { error } = await supabase
		.from("pedido_checklist_item")
		.update({ texto: dados.texto })
		.eq("item_id", dados.itemId);

	if (error) throw new Error(error.message);
	revalidatePath("/producao");
}

export async function removerItemChecklist(itemId: string) {
	validar(z.object({ itemId: zUuid }), { itemId }, "Item inválido");

	const supabase = await createClient();
	const { error } = await supabase
		.from("pedido_checklist_item")
		.update({ deleted_at: new Date().toISOString() })
		.eq("item_id", itemId);

	if (error) throw new Error(error.message);
	revalidatePath("/producao");
}

// ─── Comentários ──────────────────────────────────────────────────────────

export async function comentar(pedidoId: string, textoMd: string) {
	const dados = validar(
		z.object({ pedidoId: zUuid, textoMd: zTexto(10_000) }),
		{ pedidoId, textoMd },
		"Não foi possível comentar"
	);

	const supabase = await createClient();
	const { error } = await supabase.from("pedido_comentario").insert({
		pedido_id: dados.pedidoId,
		texto_md: dados.textoMd,
	});

	if (error) throw new Error(error.message);
	revalidar(dados.pedidoId);
}

export async function removerComentario(comentarioId: string) {
	validar(
		z.object({ comentarioId: zUuid }),
		{ comentarioId },
		"Comentário inválido"
	);

	const supabase = await createClient();
	const { data } = await supabase
		.from("pedido_comentario")
		.select("pedido_id")
		.eq("comentario_id", comentarioId)
		.single();

	const { error } = await supabase
		.from("pedido_comentario")
		.update({ deleted_at: new Date().toISOString() })
		.eq("comentario_id", comentarioId);

	if (error) throw new Error(error.message);
	if (data?.pedido_id) revalidar(data.pedido_id as string);
}

// ─── Etiquetas ────────────────────────────────────────────────────────────

const CORES_PADRAO = [
	"#185FA5",
	"#15803D",
	"#B45309",
	"#B91C1C",
	"#7C3AED",
	"#0F766E",
	"#BE185D",
	"#4B5563",
] as const;

export async function criarEtiqueta(nome: string, cor?: string) {
	const dados = validar(
		z.object({
			nome: zTexto(40),
			cor: z
				.string()
				.regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser um hex tipo #185FA5")
				.optional(),
		}),
		{ nome, cor },
		"Não foi possível criar a etiqueta"
	);

	const supabase = await createClient();

	// Sem cor escolhida, roda a paleta conforme quantas já existem — evita
	// todas nascerem azuis.
	const { count } = await supabase
		.from("etiqueta")
		.select("etiqueta_id", { count: "exact", head: true })
		.is("deleted_at", null);

	const { data, error } = await supabase
		.from("etiqueta")
		.insert({
			nome: dados.nome,
			cor: dados.cor ?? CORES_PADRAO[(count ?? 0) % CORES_PADRAO.length],
			ordem: count ?? 0,
		})
		.select("etiqueta_id, nome, cor")
		.single();

	if (error) throw new Error(error.message);
	revalidatePath("/producao");
	return data as { etiqueta_id: string; nome: string; cor: string };
}

export async function alternarEtiqueta(
	pedidoId: string,
	etiquetaId: string,
	aplicar: boolean
) {
	const dados = validar(
		z.object({ pedidoId: zUuid, etiquetaId: zUuid, aplicar: z.boolean() }),
		{ pedidoId, etiquetaId, aplicar },
		"Não foi possível alterar a etiqueta"
	);

	const supabase = await createClient();

	if (dados.aplicar) {
		// A ligação é (pedido, etiqueta): reaplicar não deve duplicar nem falhar.
		const { error } = await supabase
			.from("pedido_etiqueta")
			.upsert(
				{ pedido_id: dados.pedidoId, etiqueta_id: dados.etiquetaId },
				{ onConflict: "pedido_id,etiqueta_id" }
			);
		if (error) throw new Error(error.message);
	} else {
		const { error } = await supabase
			.from("pedido_etiqueta")
			.delete()
			.eq("pedido_id", dados.pedidoId)
			.eq("etiqueta_id", dados.etiquetaId);
		if (error) throw new Error(error.message);
	}

	revalidar(dados.pedidoId);
}
