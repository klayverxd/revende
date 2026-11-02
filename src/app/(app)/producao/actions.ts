"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/format";
import {
	validar,
	zDataISO,
	zTexto,
	zTextoOmitivel,
	zUuid,
} from "@/lib/validacao";
import {
	CANAL_PEDIDO,
	PEDIDO_STATUS,
	PRIORIDADE,
	colunaPorId,
	statusAoMover,
	type PedidoStatus,
} from "@/modules/pedido/status";

function revalidarEsteira(pedidoId?: string) {
	revalidatePath("/producao");
	revalidatePath("/hoje");
	revalidatePath("/dashboard");
	if (pedidoId) revalidatePath(`/producao/${pedidoId}`);
}

/**
 * Datas de produção derivadas do status.
 *
 * Antes ficavam espalhadas em `atualizarStatusPedido`; aqui é a mesma regra,
 * num lugar só, e agora cobre também os estados novos da esteira.
 */
function datasDoStatus(status: PedidoStatus): Record<string, string> {
	const hoje = hojeISO();
	if (status === "IMPRIMINDO" || status === "EM_MODELAGEM") {
		return { data_inicio_producao: hoje };
	}
	if (status === "PRONTO") return { data_conclusao_producao: hoje };
	if (status === "ENTREGUE") return { data_entrega: hoje };
	return {};
}

// ─── Mover card entre colunas ─────────────────────────────────────────────

const moverSchema = z.object({
	pedidoId: zUuid,
	colunaDestinoId: z.string().min(1).max(50),
	ordem: z.number().finite(),
});

/**
 * Move um card para outra coluna do kanban, na posição indicada.
 *
 * A ordem vem calculada pelo cliente (ponto médio entre os vizinhos) para o
 * arrasto ser instantâneo; o servidor só valida e grava.
 */
export async function moverCard(
	pedidoId: string,
	colunaDestinoId: string,
	ordem: number
) {
	validar(
		moverSchema,
		{ pedidoId, colunaDestinoId, ordem },
		"Não foi possível mover o card"
	);

	const coluna = colunaPorId(colunaDestinoId);
	if (!coluna) throw new Error("Coluna inexistente na esteira");

	const supabase = await createClient();

	const { data: atual, error: erroBusca } = await supabase
		.from("pedido")
		.select("status")
		.eq("pedido_id", pedidoId)
		.is("deleted_at", null)
		.single();

	if (erroBusca || !atual) throw new Error("Pedido não encontrado");

	// Preserva o status quando o card é solto na própria coluna — soltar um
	// AGUARDANDO_IMPRESSAO em "A fazer" não deve rebaixá-lo para NOVO.
	const novoStatus = statusAoMover(atual.status as PedidoStatus, colunaDestinoId);
	if (!novoStatus) throw new Error("Coluna inexistente na esteira");

	const { error } = await supabase
		.from("pedido")
		.update({
			status: novoStatus,
			ordem_esteira: ordem,
			...datasDoStatus(novoStatus),
		})
		.eq("pedido_id", pedidoId);

	if (error) throw new Error(error.message);
	revalidarEsteira(pedidoId);
	return { status: novoStatus };
}

// ─── Captura rápida ───────────────────────────────────────────────────────

const capturaSchema = z.object({
	titulo: zTexto(200),
	colunaId: z.string().min(1).max(50),
	clienteNome: zTextoOmitivel(200),
	clienteTelefone: zTextoOmitivel(50),
	canal: z.enum(CANAL_PEDIDO).optional(),
	dataPrazo: zDataISO.optional(),
});

export interface CapturaRapidaInput {
	titulo: string;
	colunaId: string;
	clienteNome?: string;
	clienteTelefone?: string;
	canal?: (typeof CANAL_PEDIDO)[number];
	dataPrazo?: string;
}

/**
 * Cria um card com o mínimo possível: um título e nada mais obrigatório.
 *
 * É a correção direta da dor que motivou a Fase 1 — pedido que passa sem
 * anotação porque abrir o formulário completo dá trabalho no meio do
 * atendimento. Itens, preço e custo entram depois, no card.
 */
export async function criarCardRapido(input: CapturaRapidaInput) {
	const dados = validar(
		capturaSchema,
		input,
		"Não foi possível criar o card"
	);

	const coluna = colunaPorId(dados.colunaId);
	if (!coluna) throw new Error("Coluna inexistente na esteira");

	const supabase = await createClient();
	const status = coluna.statusAoEntrar;

	// Card novo entra no topo da coluna: é o que acabou de acontecer.
	const { data: primeiro } = await supabase
		.from("pedido")
		.select("ordem_esteira")
		.eq("status", status)
		.is("deleted_at", null)
		.order("ordem_esteira", { ascending: true, nullsFirst: false })
		.limit(1)
		.maybeSingle();

	const ordem = (primeiro?.ordem_esteira ?? 0) - 1;

	const { data: pedido, error } = await supabase
		.from("pedido")
		.insert({
			numero_pedido: await gerarNumero(supabase),
			titulo: dados.titulo,
			data_pedido: hojeISO(),
			canal: dados.canal ?? "WHATSAPP",
			status,
			prioridade: "NORMAL",
			cliente_nome: dados.clienteNome ?? null,
			cliente_telefone: dados.clienteTelefone ?? null,
			data_prazo: dados.dataPrazo ?? null,
			status_pagamento: "PENDENTE",
			ordem_esteira: ordem,
			...datasDoStatus(status),
		})
		.select("pedido_id, numero_pedido")
		.single();

	if (error) throw new Error(error.message);
	revalidarEsteira();
	return {
		pedidoId: pedido.pedido_id as string,
		numeroPedido: pedido.numero_pedido as string,
	};
}

/**
 * Próximo número no formato PED-AAAA-NNNN.
 *
 * Roda sob RLS, então só vê os números do próprio workspace — é por isso que a
 * unicidade no banco é `(user_id, numero_pedido)` e não global.
 */
async function gerarNumero(
	supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
	const ano = new Date().getFullYear();
	const { data } = await supabase
		.from("pedido")
		.select("numero_pedido")
		.like("numero_pedido", `PED-${ano}-%`);

	let maior = 0;
	for (const row of data ?? []) {
		const seq = Number.parseInt(
			(row.numero_pedido as string).split("-")[2] ?? "0",
			10
		);
		if (Number.isFinite(seq) && seq > maior) maior = seq;
	}
	return `PED-${ano}-${String(maior + 1).padStart(4, "0")}`;
}

// ─── Campos do card ───────────────────────────────────────────────────────

const patchSchema = z.object({
	pedidoId: zUuid,
	campos: z.object({
		titulo: zTexto(200).optional(),
		descricao_md: zTextoOmitivel(20_000),
		data_prazo: zDataISO.nullable().optional(),
		prazo_concluido: z.boolean().optional(),
		prioridade: z.enum(PRIORIDADE).optional(),
		canal: z.enum(CANAL_PEDIDO).optional(),
		responsavel_id: zUuid.nullable().optional(),
		status: z.enum(PEDIDO_STATUS).optional(),
		cliente_nome: zTextoOmitivel(200),
		cliente_telefone: zTextoOmitivel(50),
	}),
});

/**
 * `Partial` de propósito: esta action é um patch — cada chamada manda só o
 * campo que mudou. O `z.infer` sozinho marcaria como obrigatórias as chaves
 * que passam por `.transform()`, mesmo aceitando `undefined`.
 */
export type CamposCard = Partial<z.infer<typeof patchSchema>["campos"]>;

/** Edição pontual de um campo do card, para salvar inline sem formulário. */
export async function atualizarCard(pedidoId: string, campos: CamposCard) {
	const dados = validar(
		patchSchema,
		{ pedidoId, campos },
		"Não foi possível salvar"
	);

	if (Object.keys(dados.campos).length === 0) return;

	const supabase = await createClient();
	const extra = dados.campos.status ? datasDoStatus(dados.campos.status) : {};

	const { error } = await supabase
		.from("pedido")
		.update({ ...dados.campos, ...extra })
		.eq("pedido_id", pedidoId)
		.is("deleted_at", null);

	if (error) throw new Error(error.message);
	revalidarEsteira(pedidoId);
}

// ─── Repetir pedido ───────────────────────────────────────────────────────

/**
 * Duplica um pedido com os mesmos itens e checklists.
 *
 * A maioria dos pedidos repete produtos já feitos; refazer tudo à mão é o tipo
 * de atrito que fazia o registro ser abandonado.
 */
export async function repetirPedido(pedidoId: string) {
	validar(z.object({ pedidoId: zUuid }), { pedidoId }, "Pedido inválido");

	const supabase = await createClient();

	const { data: origem, error: erroOrigem } = await supabase
		.from("pedido")
		.select(
			`titulo, descricao_md, canal, prioridade, cliente_nome, cliente_telefone,
			 cliente_email, cliente_referencia, forma_pagamento, desconto_valor,
			 taxa_marketplace_pct, custo_envio, outros_encargos, capa_url,
			 itens:pedido_item(tipo, modelo_id, descricao_custom, tempo_impressao_min,
				peso_g, num_placas, quantidade, preco_venda_unit, custo_unit, observacao)`
		)
		.eq("pedido_id", pedidoId)
		.is("deleted_at", null)
		.single();

	if (erroOrigem || !origem) throw new Error("Pedido não encontrado");

	const itens = (origem.itens ?? []) as Array<Record<string, unknown>>;

	const { data: novo, error } = await supabase
		.from("pedido")
		.insert({
			numero_pedido: await gerarNumero(supabase),
			titulo: origem.titulo,
			descricao_md: origem.descricao_md,
			data_pedido: hojeISO(),
			canal: origem.canal,
			// Entra como novo, não no status do original: é um pedido a fazer.
			status: "NOVO",
			prioridade: origem.prioridade,
			cliente_nome: origem.cliente_nome,
			cliente_telefone: origem.cliente_telefone,
			cliente_email: origem.cliente_email,
			cliente_referencia: origem.cliente_referencia,
			forma_pagamento: origem.forma_pagamento,
			status_pagamento: "PENDENTE",
			desconto_valor: origem.desconto_valor,
			taxa_marketplace_pct: origem.taxa_marketplace_pct,
			custo_envio: origem.custo_envio,
			outros_encargos: origem.outros_encargos,
			capa_url: origem.capa_url,
			data_inicio_producao: null,
			data_conclusao_producao: null,
			data_entrega: null,
		})
		.select("pedido_id, numero_pedido")
		.single();

	if (error) throw new Error(error.message);

	if (itens.length > 0) {
		const { error: erroItens } = await supabase.from("pedido_item").insert(
			itens.map(i => ({ ...i, pedido_id: novo.pedido_id }))
		);
		if (erroItens) throw new Error(erroItens.message);
	}

	// Copia as checklists sem marcar nada como feito.
	const { data: checklists } = await supabase
		.from("pedido_checklist")
		.select("titulo, ordem, itens:pedido_checklist_item(texto, ordem)")
		.eq("pedido_id", pedidoId)
		.is("deleted_at", null);

	for (const cl of checklists ?? []) {
		const { data: nova } = await supabase
			.from("pedido_checklist")
			.insert({
				pedido_id: novo.pedido_id,
				titulo: cl.titulo,
				ordem: cl.ordem,
			})
			.select("checklist_id")
			.single();

		const itensCl = (cl.itens ?? []) as Array<{ texto: string; ordem: number }>;
		if (nova && itensCl.length > 0) {
			await supabase.from("pedido_checklist_item").insert(
				itensCl.map(i => ({
					checklist_id: nova.checklist_id,
					texto: i.texto,
					ordem: i.ordem,
					concluido: false,
				}))
			);
		}
	}

	revalidarEsteira();
	return {
		pedidoId: novo.pedido_id as string,
		numeroPedido: novo.numero_pedido as string,
	};
}

// ─── Arquivar ─────────────────────────────────────────────────────────────

export async function arquivarCard(pedidoId: string) {
	validar(z.object({ pedidoId: zUuid }), { pedidoId }, "Pedido inválido");

	const supabase = await createClient();
	const { error } = await supabase
		.from("pedido")
		.update({ deleted_at: new Date().toISOString() })
		.eq("pedido_id", pedidoId);

	if (error) throw new Error(error.message);
	revalidarEsteira();
}
