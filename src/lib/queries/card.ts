/**
 * Carregamento do card aberto — a visão completa de um pedido.
 */
import { createClient } from "@/lib/supabase/server";
import { exigirSemErro } from "@/lib/queries/erro";
import {
	calcularFinanceiroPedido,
	type FinanceiroPedido,
} from "@/modules/pedido/financeiro";
import type {
	CanalPedido,
	FormaPagamento,
	PedidoStatus,
	Prioridade,
	StatusPagamento,
} from "@/modules/pedido/status";
import type { EtiquetaCard } from "@/lib/queries/esteira";

export interface ItemCard {
	item_id: string;
	tipo: "PRODUTO" | "CORINGA";
	modelo_id: string | null;
	descricao: string;
	tempo_impressao_min: number | null;
	peso_g: number | null;
	num_placas: number | null;
	quantidade: number;
	preco_venda_unit: number | null;
	custo_unit: number | null;
	observacao: string | null;
}

export interface ItemChecklist {
	item_id: string;
	texto: string;
	concluido: boolean;
	ordem: number;
}

export interface Checklist {
	checklist_id: string;
	titulo: string;
	ordem: number;
	itens: ItemChecklist[];
}

export interface Comentario {
	comentario_id: string;
	texto_md: string;
	criado_por: string | null;
	autor: string | null;
	created_at: string;
}

export interface Anexo {
	anexo_id: string;
	url: string;
	nome: string;
	tipo: string | null;
	tamanho_bytes: number | null;
	created_at: string;
}

export interface CardCompleto {
	pedido_id: string;
	numero_pedido: string;
	titulo: string | null;
	descricao_md: string | null;
	status: PedidoStatus;
	prioridade: Prioridade;
	canal: CanalPedido;
	cliente_nome: string | null;
	cliente_telefone: string | null;
	cliente_email: string | null;
	cliente_referencia: string | null;
	data_pedido: string;
	data_prazo: string | null;
	prazo_concluido: boolean;
	data_inicio_producao: string | null;
	data_conclusao_producao: string | null;
	data_entrega: string | null;
	forma_pagamento: FormaPagamento | null;
	status_pagamento: StatusPagamento;
	valor_sinal: number | null;
	desconto_valor: number | null;
	taxa_marketplace_pct: number | null;
	custo_envio: number | null;
	outros_encargos: number | null;
	capa_url: string | null;
	responsavel_id: string | null;
	responsavel_nome: string | null;
	criado_por: string | null;
	criado_por_nome: string | null;
	created_at: string;
	updated_at: string;
	itens: ItemCard[];
	etiquetas: EtiquetaCard[];
	checklists: Checklist[];
	comentarios: Comentario[];
	anexos: Anexo[];
	financeiro: FinanceiroPedido;
}

function umDe<T>(v: unknown): T | null {
	if (v == null) return null;
	return Array.isArray(v) ? ((v[0] as T) ?? null) : (v as T);
}

function lista<T>(v: unknown): T[] {
	if (v == null) return [];
	return Array.isArray(v) ? (v as T[]) : [v as T];
}

export async function buscarCardCompleto(
	pedidoId: string
): Promise<CardCompleto | null> {
	const supabase = await createClient();

	const { data: p, error: erroPedido } = await supabase
		.from("pedido")
		.select(
			`pedido_id, numero_pedido, titulo, descricao_md, status, prioridade, canal,
			 cliente_nome, cliente_telefone, cliente_email, cliente_referencia,
			 data_pedido, data_prazo, prazo_concluido, data_inicio_producao,
			 data_conclusao_producao, data_entrega, forma_pagamento, status_pagamento,
			 valor_sinal, desconto_valor, taxa_marketplace_pct, custo_envio,
			 outros_encargos, capa_url, responsavel_id, criado_por,
			 created_at, updated_at,
			 itens:pedido_item(item_id, tipo, modelo_id, descricao_custom,
				tempo_impressao_min, peso_g, num_placas, quantidade,
				preco_venda_unit, custo_unit, observacao,
				modelo:modelo_id(codigo, nome)),
			 etiquetas:pedido_etiqueta(etiqueta:etiqueta_id(etiqueta_id, nome, cor))`
		)
		.eq("pedido_id", pedidoId)
		.is("deleted_at", null)
		.maybeSingle();

	// Sem esta checagem, uma coluna faltando no banco virava `null` e a página
	// respondia 404 — "pedido não existe" quando o pedido existe.
	exigirSemErro(erroPedido, "Não foi possível carregar o pedido");
	if (!p) return null;

	const [
		{ data: checklists, error: erroChecklists },
		{ data: comentarios, error: erroComentarios },
		{ data: anexos, error: erroAnexos },
		{ data: membros },
	] = await Promise.all([
		supabase
			.from("pedido_checklist")
			.select(
				"checklist_id, titulo, ordem, itens:pedido_checklist_item(item_id, texto, concluido, ordem, deleted_at)"
			)
			.eq("pedido_id", pedidoId)
			.is("deleted_at", null)
			.order("ordem"),
		supabase
			.from("pedido_comentario")
			.select("comentario_id, texto_md, criado_por, created_at")
			.eq("pedido_id", pedidoId)
			.is("deleted_at", null)
			.order("created_at", { ascending: true }),
		supabase
			.from("pedido_anexo")
			.select("anexo_id, url, nome, tipo, tamanho_bytes, created_at")
			.eq("pedido_id", pedidoId)
			.is("deleted_at", null)
			.order("created_at"),
		supabase.from("membro_equipe").select("membro_id, email_convidado"),
	]);

	exigirSemErro(erroChecklists, "Não foi possível carregar as checklists");
	exigirSemErro(erroComentarios, "Não foi possível carregar os comentários");
	exigirSemErro(erroAnexos, "Não foi possível carregar os anexos");
	// `membros` fica sem checagem de propósito: sem ele o card só perde o nome
	// do autor, e isso não deve derrubar a página.

	const nomePorId = new Map<string, string>();
	for (const m of membros ?? []) {
		const id = m.membro_id as string | null;
		if (!id) continue;
		const email = (m.email_convidado as string | null) ?? "";
		nomePorId.set(id, email.split("@")[0] || email);
	}

	const itens: ItemCard[] = lista<{
		item_id: string;
		tipo: string;
		modelo_id: string | null;
		descricao_custom: string | null;
		tempo_impressao_min: number | null;
		peso_g: number | null;
		num_placas: number | null;
		quantidade: number;
		preco_venda_unit: number | null;
		custo_unit: number | null;
		observacao: string | null;
		modelo: unknown;
	}>(p.itens).map(i => {
		const modelo = umDe<{ codigo: string | null; nome: string }>(i.modelo);
		return {
			item_id: i.item_id,
			tipo: i.tipo as "PRODUTO" | "CORINGA",
			modelo_id: i.modelo_id,
			descricao:
				modelo?.nome ?? i.descricao_custom ?? "Item sem descrição",
			tempo_impressao_min: i.tempo_impressao_min,
			peso_g: i.peso_g,
			num_placas: i.num_placas,
			quantidade: i.quantidade,
			preco_venda_unit: i.preco_venda_unit,
			custo_unit: i.custo_unit,
			observacao: i.observacao,
		};
	});

	const etiquetas = lista<{ etiqueta: unknown }>(p.etiquetas)
		.map(e => umDe<EtiquetaCard>(e.etiqueta))
		.filter((e): e is EtiquetaCard => Boolean(e));

	return {
		pedido_id: p.pedido_id as string,
		numero_pedido: p.numero_pedido as string,
		titulo: p.titulo as string | null,
		descricao_md: p.descricao_md as string | null,
		status: p.status as PedidoStatus,
		prioridade: p.prioridade as Prioridade,
		canal: p.canal as CanalPedido,
		cliente_nome: p.cliente_nome as string | null,
		cliente_telefone: p.cliente_telefone as string | null,
		cliente_email: p.cliente_email as string | null,
		cliente_referencia: p.cliente_referencia as string | null,
		data_pedido: p.data_pedido as string,
		data_prazo: p.data_prazo as string | null,
		prazo_concluido: (p.prazo_concluido as boolean | null) ?? false,
		data_inicio_producao: p.data_inicio_producao as string | null,
		data_conclusao_producao: p.data_conclusao_producao as string | null,
		data_entrega: p.data_entrega as string | null,
		forma_pagamento: p.forma_pagamento as FormaPagamento | null,
		status_pagamento: p.status_pagamento as StatusPagamento,
		valor_sinal: p.valor_sinal as number | null,
		desconto_valor: p.desconto_valor as number | null,
		taxa_marketplace_pct: p.taxa_marketplace_pct as number | null,
		custo_envio: p.custo_envio as number | null,
		outros_encargos: p.outros_encargos as number | null,
		capa_url: p.capa_url as string | null,
		responsavel_id: p.responsavel_id as string | null,
		responsavel_nome: p.responsavel_id
			? (nomePorId.get(p.responsavel_id as string) ?? null)
			: null,
		criado_por: p.criado_por as string | null,
		criado_por_nome: p.criado_por
			? (nomePorId.get(p.criado_por as string) ?? null)
			: null,
		created_at: p.created_at as string,
		updated_at: p.updated_at as string,
		itens,
		etiquetas,
		checklists: (checklists ?? []).map(c => ({
			checklist_id: c.checklist_id as string,
			titulo: c.titulo as string,
			ordem: c.ordem as number,
			itens: lista<ItemChecklist & { deleted_at: string | null }>(c.itens)
				.filter(i => !i.deleted_at)
				.sort((a, b) => a.ordem - b.ordem)
				.map(({ item_id, texto, concluido, ordem }) => ({
					item_id,
					texto,
					concluido,
					ordem,
				})),
		})),
		comentarios: (comentarios ?? []).map(c => ({
			comentario_id: c.comentario_id as string,
			texto_md: c.texto_md as string,
			criado_por: c.criado_por as string | null,
			autor: c.criado_por
				? (nomePorId.get(c.criado_por as string) ?? null)
				: null,
			created_at: c.created_at as string,
		})),
		anexos: (anexos ?? []) as Anexo[],
		financeiro: calcularFinanceiroPedido(p, itens),
	};
}

/** Membros do workspace, para o seletor de responsável. */
export async function buscarMembros(): Promise<
	Array<{ id: string; nome: string }>
> {
	const supabase = await createClient();
	const { data } = await supabase
		.from("membro_equipe")
		.select("membro_id, email_convidado");

	const out: Array<{ id: string; nome: string }> = [];
	for (const m of data ?? []) {
		const id = m.membro_id as string | null;
		if (!id) continue;
		const email = (m.email_convidado as string | null) ?? "";
		out.push({ id, nome: email.split("@")[0] || email });
	}
	return out;
}
