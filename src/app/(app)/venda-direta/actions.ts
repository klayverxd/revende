"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buscarDisponivelPorModelo } from "@/lib/queries/estoque";
import { resolverPrecoModelo } from "@/lib/utils/preco";

export interface VendaDiretaItemInput {
	modelId?: string | null;
	descricaoLivre?: string | null;
	quantidade: number;
	preco?: number | null;
	origem?: "MODELO" | "MANUAL";
}

export interface CriarVendaDiretaInput {
	itens: VendaDiretaItemInput[];
	desconto?: number;
	canal: "PRESENCIAL" | "WHATSAPP" | "FEIRA" | "EVENTO" | "INSTAGRAM" | "OUTRO";
	forma_pagamento: "PIX" | "DINHEIRO" | "CARTAO" | "OUTRO";
	cliente_nome?: string;
	cliente_contato?: string;
	observacao?: string;
	data_venda?: string;
}

export async function resolverPrecoVendaDireta(modelId: string) {
	return resolverPrecoModelo(modelId);
}

export async function criarVendaDireta(data: CriarVendaDiretaInput) {
	if (!data.itens.length) throw new Error("Adicione ao menos um item");

	const supabase = await createClient();

	// Só itens de catálogo têm controle de estoque; personalizados não entram.
	const modeloIds = data.itens
		.map(i => i.modelId)
		.filter((id): id is string => Boolean(id));
	const estoqueMap = await buscarDisponivelPorModelo(modeloIds);

	// Validar estoque apenas para itens de catálogo
	for (const item of data.itens) {
		if (!item.modelId) continue; // item personalizado — sem controle de estoque
		const disponivel = estoqueMap.get(item.modelId) ?? 0;
		if (item.quantidade > disponivel) {
			throw new Error("Estoque insuficiente para um ou mais itens");
		}
		estoqueMap.set(item.modelId, disponivel - item.quantidade);
	}

	let subtotal = 0;
	const itensResolvidos: Array<{
		modelo_id: string | null;
		descricao_livre: string | null;
		quantidade: number;
		preco_unitario: number;
		preco_origem: "MODELO" | "MANUAL";
		subtotal: number;
	}> = [];

	for (const item of data.itens) {
		let precoUnit: number;
		let origem: "MODELO" | "MANUAL";

		if (item.modelId) {
			const resolved = await resolverPrecoModelo(item.modelId);
			origem = (item.origem ?? (resolved.origem ? "MODELO" : "MANUAL")) as
				| "MODELO"
				| "MANUAL";
			precoUnit =
				origem === "MANUAL"
					? (item.preco ?? 0)
					: (resolved.preco ?? item.preco ?? 0);
		} else {
			// Item personalizado — preço sempre manual
			origem = "MANUAL";
			precoUnit = item.preco ?? 0;
		}

		const itemSubtotal = Number((precoUnit * item.quantidade).toFixed(2));
		subtotal += itemSubtotal;

		itensResolvidos.push({
			modelo_id: item.modelId ?? null,
			descricao_livre: item.descricaoLivre ?? null,
			quantidade: item.quantidade,
			preco_unitario: Number(precoUnit.toFixed(2)),
			preco_origem: origem,
			subtotal: itemSubtotal,
		});
	}

	const desconto = Math.max(0, data.desconto ?? 0);
	const valorTotal = Math.max(0, Number((subtotal - desconto).toFixed(2)));

	const { data: venda, error: vendaError } = await supabase
		.from("venda_direta")
		.insert({
			data_venda: data.data_venda ?? new Date().toISOString().slice(0, 10),
			canal: data.canal,
			forma_pagamento: data.forma_pagamento,
			desconto,
			valor_total: valorTotal,
			observacao: data.observacao?.trim() || null,
			cliente_nome: data.cliente_nome?.trim() || null,
			cliente_contato: data.cliente_contato?.trim() || null,
		})
		.select("venda_id")
		.single();

	if (vendaError) throw new Error(vendaError.message);

	for (const item of itensResolvidos) {
		const { error: itemError } = await supabase
			.from("venda_direta_item")
			.insert({
				venda_id: venda.venda_id,
				modelo_id: item.modelo_id,
				descricao_livre: item.descricao_livre,
				quantidade: item.quantidade,
				preco_unitario: item.preco_unitario,
				preco_origem: item.preco_origem,
				subtotal: item.subtotal,
			});
		if (itemError) throw new Error(itemError.message);
	}

	revalidatePath("/venda-direta");
	revalidatePath("/estoque");
	revalidatePath("/dashboard");

	return { vendaId: venda.venda_id as string };
}
