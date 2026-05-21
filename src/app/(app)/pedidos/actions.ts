"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PedidoStatus =
	| "NOVO"
	| "EM_MODELAGEM"
	| "AGUARDANDO_IMPRESSAO"
	| "IMPRIMINDO"
	| "EM_ACABAMENTO"
	| "PRONTO"
	| "ENVIADO"
	| "ENTREGUE"
	| "CANCELADO";

export type CanalPedido =
	| "PRESENCIAL"
	| "WHATSAPP"
	| "INSTAGRAM"
	| "SHOPEE";

export type FormaPagamento = "PIX" | "DINHEIRO" | "CARTAO" | "OUTRO";
export type StatusPagamento = "PENDENTE" | "SINAL_RECEBIDO" | "PAGO";
export type Prioridade = "NORMAL" | "ALTA" | "URGENTE";
export type ItemTipo = "PRODUTO" | "CORINGA";

export interface PedidoItemInput {
	tipo: ItemTipo;
	modelo_id?: string | null;
	descricao_custom?: string | null;
	tempo_impressao_min?: number | null;
	peso_g?: number | null;
	num_placas?: number | null;
	quantidade: number;
	preco_venda_unit?: number | null;
	custo_unit?: number | null;
	observacao?: string | null;
}

export interface CriarPedidoInput {
	canal: CanalPedido;
	status?: PedidoStatus;
	prioridade?: Prioridade;
	cliente_nome?: string | null;
	cliente_telefone?: string | null;
	cliente_email?: string | null;
	cliente_referencia?: string | null;
	data_pedido?: string;
	data_prazo?: string | null;
	forma_pagamento?: FormaPagamento | null;
	status_pagamento?: StatusPagamento;
	valor_sinal?: number | null;
	desconto_valor?: number | null;
	taxa_marketplace_pct?: number | null;
	custo_envio?: number | null;
	outros_encargos?: number | null;
	observacao?: string | null;
	itens: PedidoItemInput[];
}

async function gerarNumeroPedido(): Promise<string> {
	const supabase = await createClient();
	const ano = new Date().getFullYear();
	const { data } = await supabase
		.from("pedido")
		.select("numero_pedido")
		.like("numero_pedido", `PED-${ano}-%`)
		.order("numero_pedido", { ascending: false })
		.limit(1);

	if (!data || data.length === 0) return `PED-${ano}-0001`;
	const last = data[0].numero_pedido as string;
	const seq = Number.parseInt(last.split("-")[2], 10);
	return `PED-${ano}-${String(seq + 1).padStart(4, "0")}`;
}

export async function criarPedido(input: CriarPedidoInput) {
	const supabase = await createClient();
	const numero_pedido = await gerarNumeroPedido();

	const { data: pedido, error } = await supabase
		.from("pedido")
		.insert({
			numero_pedido,
			data_pedido: input.data_pedido ?? new Date().toISOString().slice(0, 10),
			canal: input.canal,
			status: input.status ?? "NOVO",
			prioridade: input.prioridade ?? "NORMAL",
			cliente_nome: input.cliente_nome?.trim() || null,
			cliente_telefone: input.cliente_telefone?.trim() || null,
			cliente_email: input.cliente_email?.trim() || null,
			cliente_referencia: input.cliente_referencia?.trim() || null,
			data_prazo: input.data_prazo || null,
			forma_pagamento: input.forma_pagamento || null,
			status_pagamento: input.status_pagamento ?? "PENDENTE",
			valor_sinal: input.valor_sinal ?? null,
			desconto_valor: input.desconto_valor ?? null,
			taxa_marketplace_pct: input.taxa_marketplace_pct ?? null,
			custo_envio: input.custo_envio ?? null,
			outros_encargos: input.outros_encargos ?? null,
			observacao: input.observacao?.trim() || null,
		})
		.select("pedido_id")
		.single();

	if (error) throw new Error(error.message);

	for (const item of input.itens) {
		const { error: itemError } = await supabase.from("pedido_item").insert({
			pedido_id: pedido.pedido_id,
			tipo: item.tipo,
			modelo_id: item.modelo_id ?? null,
			descricao_custom: item.descricao_custom?.trim() || null,
			tempo_impressao_min: item.tempo_impressao_min ?? null,
			peso_g: item.peso_g ?? null,
			num_placas: item.num_placas ?? null,
			quantidade: item.quantidade,
			preco_venda_unit: item.preco_venda_unit ?? null,
			custo_unit: item.custo_unit ?? null,
			observacao: item.observacao?.trim() || null,
		});
		if (itemError) throw new Error(itemError.message);
	}

	revalidatePath("/pedidos");
	revalidatePath("/dashboard");
	return { pedidoId: pedido.pedido_id as string, numeroPedido: numero_pedido };
}

export async function atualizarStatusPedido(
	pedidoId: string,
	status: PedidoStatus,
	extraFields?: {
		data_inicio_producao?: string | null;
		data_conclusao_producao?: string | null;
		data_entrega?: string | null;
	}
) {
	const supabase = await createClient();

	const hoje = new Date().toISOString().slice(0, 10);
	const updates: Record<string, unknown> = { status };

	if (status === "EM_MODELAGEM" || status === "IMPRIMINDO") {
		updates.data_inicio_producao = extraFields?.data_inicio_producao ?? hoje;
	}
	if (status === "PRONTO") {
		updates.data_conclusao_producao =
			extraFields?.data_conclusao_producao ?? hoje;
	}
	if (status === "ENTREGUE") {
		updates.data_entrega = extraFields?.data_entrega ?? hoje;
	}

	const { error } = await supabase
		.from("pedido")
		.update(updates)
		.eq("pedido_id", pedidoId);

	if (error) throw new Error(error.message);
	revalidatePath("/pedidos");
	revalidatePath(`/pedidos/${pedidoId}`);
	revalidatePath("/dashboard");
}

export async function atualizarPedido(
	pedidoId: string,
	input: Omit<CriarPedidoInput, "itens"> & { itens?: PedidoItemInput[] }
) {
	const supabase = await createClient();

	const { error } = await supabase
		.from("pedido")
		.update({
			canal: input.canal,
			status: input.status,
			prioridade: input.prioridade ?? "NORMAL",
			cliente_nome: input.cliente_nome?.trim() || null,
			cliente_telefone: input.cliente_telefone?.trim() || null,
			cliente_email: input.cliente_email?.trim() || null,
			cliente_referencia: input.cliente_referencia?.trim() || null,
			data_pedido: input.data_pedido,
			data_prazo: input.data_prazo || null,
			forma_pagamento: input.forma_pagamento || null,
			status_pagamento: input.status_pagamento ?? "PENDENTE",
			valor_sinal: input.valor_sinal ?? null,
			desconto_valor: input.desconto_valor ?? null,
			taxa_marketplace_pct: input.taxa_marketplace_pct ?? null,
			custo_envio: input.custo_envio ?? null,
			outros_encargos: input.outros_encargos ?? null,
			observacao: input.observacao?.trim() || null,
		})
		.eq("pedido_id", pedidoId);

	if (error) throw new Error(error.message);

	if (input.itens != null) {
		await supabase
			.from("pedido_item")
			.delete()
			.eq("pedido_id", pedidoId);

		for (const item of input.itens) {
			const { error: itemError } = await supabase.from("pedido_item").insert({
				pedido_id: pedidoId,
				tipo: item.tipo,
				modelo_id: item.modelo_id ?? null,
				descricao_custom: item.descricao_custom?.trim() || null,
				tempo_impressao_min: item.tempo_impressao_min ?? null,
				peso_g: item.peso_g ?? null,
				num_placas: item.num_placas ?? null,
				quantidade: item.quantidade,
				preco_venda_unit: item.preco_venda_unit ?? null,
				custo_unit: item.custo_unit ?? null,
				observacao: item.observacao?.trim() || null,
			});
			if (itemError) throw new Error(itemError.message);
		}
	}

	revalidatePath("/pedidos");
	revalidatePath(`/pedidos/${pedidoId}`);
}

export async function patchPedido(
	pedidoId: string,
	campos: Partial<{
		canal: CanalPedido;
		data_prazo: string | null;
		cliente_nome: string | null;
		prioridade: Prioridade;
	}>
) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("pedido")
		.update(campos)
		.eq("pedido_id", pedidoId);
	if (error) throw new Error(error.message);
	revalidatePath("/pedidos");
	revalidatePath(`/pedidos/${pedidoId}`);
}

export async function deletarPedido(pedidoId: string) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("pedido")
		.update({ deleted_at: new Date().toISOString() })
		.eq("pedido_id", pedidoId);
	if (error) throw new Error(error.message);
	revalidatePath("/pedidos");
	revalidatePath("/dashboard");
}

export async function buscarModelos() {
	const supabase = await createClient();
	const { data } = await supabase
		.from("modelo")
		.select(
			"modelo_id, codigo, nome, custo_producao, preco:modelo_preco(quantidade_minima, preco, ativo)"
		)
		.eq("ativo", true)
		.is("deleted_at", null)
		.order("nome");
	return (data ?? []) as Array<{
		modelo_id: string;
		codigo: string;
		nome: string;
		custo_producao: number | null;
		preco: Array<{ quantidade_minima: number; preco: number; ativo: boolean }>;
	}>;
}

export async function buscarPedidos(filtros?: {
	status?: PedidoStatus;
	canal?: CanalPedido;
}) {
	const supabase = await createClient();
	let query = supabase
		.from("pedido")
		.select(
			`pedido_id, numero_pedido, data_pedido, data_prazo, canal, status, prioridade,
			cliente_nome, status_pagamento, created_at,
			itens:pedido_item(descricao_custom, modelo:modelo_id(nome))`
		)
		.is("deleted_at", null)
		.order("created_at", { ascending: false });

	if (filtros?.status) query = query.eq("status", filtros.status);
	if (filtros?.canal) query = query.eq("canal", filtros.canal);

	const { data } = await query;

	return (data ?? []).map(p => {
		const itens = (p.itens ?? []) as Array<{
			descricao_custom: string | null;
			modelo: { nome: string } | { nome: string }[] | null;
		}>;
		const produtos = itens.map(i => {
			const m = Array.isArray(i.modelo) ? i.modelo[0] : i.modelo;
			return m?.nome ?? i.descricao_custom ?? "";
		}).filter(Boolean);
		return {
			pedido_id: p.pedido_id as string,
			numero_pedido: p.numero_pedido as string,
			data_pedido: p.data_pedido as string,
			data_prazo: p.data_prazo as string | null,
			canal: p.canal as CanalPedido,
			status: p.status as PedidoStatus,
			prioridade: p.prioridade as Prioridade,
			cliente_nome: p.cliente_nome as string | null,
			status_pagamento: p.status_pagamento as StatusPagamento,
			created_at: p.created_at as string,
			produtos,
		};
	});
}

export async function buscarPedido(pedidoId: string) {
	const supabase = await createClient();
	const { data } = await supabase
		.from("pedido")
		.select(
			`pedido_id, numero_pedido, data_pedido, data_prazo, data_inicio_producao,
			data_conclusao_producao, data_entrega, canal, status, prioridade,
			cliente_nome, cliente_telefone, cliente_email, cliente_referencia,
			forma_pagamento, status_pagamento, valor_sinal, desconto_valor,
			taxa_marketplace_pct, custo_envio, outros_encargos,
			observacao, created_at, updated_at,
			itens:pedido_item(item_id, tipo, modelo_id, descricao_custom,
				tempo_impressao_min, peso_g, num_placas, quantidade,
				preco_venda_unit, custo_unit, observacao,
				modelo:modelo_id(codigo, nome))`
		)
		.eq("pedido_id", pedidoId)
		.is("deleted_at", null)
		.single();
	return data;
}

export async function buscarDashboardPedidos() {
	const supabase = await createClient();

	const mesInicio = new Date(
		new Date().getFullYear(),
		new Date().getMonth(),
		1
	)
		.toISOString()
		.slice(0, 10);

	const [{ data: pedidos }, { data: itensMes }] = await Promise.all([
		supabase
			.from("pedido")
			.select("status, canal, prioridade")
			.is("deleted_at", null),
		supabase
			.from("pedido_item")
			.select("preco_venda_unit, quantidade, pedido:pedido_id(data_pedido, status, deleted_at)")
			.gte("pedido.data_pedido", mesInicio),
	]);

	const statusCounts: Record<string, number> = {};
	const canalCounts: Record<string, number> = {};
	let receitaTotal = 0;
	let pedidosMes = 0;
	const pedidosMesIds = new Set<string>();

	for (const p of pedidos ?? []) {
		statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
		canalCounts[p.canal] = (canalCounts[p.canal] ?? 0) + 1;
	}

	for (const item of itensMes ?? []) {
		const pedido = Array.isArray(item.pedido) ? item.pedido[0] : item.pedido;
		if (!pedido || pedido.deleted_at || pedido.status === "CANCELADO") continue;
		receitaTotal += (item.preco_venda_unit ?? 0) * (item.quantidade ?? 1);
		pedidosMesIds.add(JSON.stringify(pedido));
	}
	pedidosMes = pedidosMesIds.size;

	const ativos = (pedidos ?? []).filter(
		p => p.status !== "ENTREGUE" && p.status !== "CANCELADO"
	).length;

	return { statusCounts, canalCounts, receitaTotal, pedidosMes, ativos };
}
