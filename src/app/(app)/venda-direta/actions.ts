"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolverPrecoModelo } from "@/lib/utils/preco";

export interface VendaDiretaItemInput {
	modeloId: string;
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

function disponibilidadeBaseMap(
	producoes: Array<{ modelo_id: string; quantidade: number }>,
	envioItens: Array<{
		modelo_id: string;
		qtd_enviada: number | null;
		qtd_vendida: number | null;
		qtd_devolvida: number | null;
		envio: unknown;
	}>,
	vendasDiretas: Array<{ modelo_id: string; quantidade: number | null }>
) {
	const map = new Map<string, number>();

	for (const p of producoes) {
		map.set(p.modelo_id, (map.get(p.modelo_id) ?? 0) + (p.quantidade ?? 0));
	}

	for (const item of envioItens) {
		const envioRaw = item.envio as
			| { status: string }
			| Array<{ status: string }>
			| null;
		const envio = Array.isArray(envioRaw) ? envioRaw[0] : envioRaw;
		if (!envio) continue;
		if (envio.status === "ABERTO") {
			map.set(
				item.modelo_id,
				(map.get(item.modelo_id) ?? 0) - (item.qtd_enviada ?? 0)
			);
		} else if (envio.status === "CONFERIDO" || envio.status === "ENCERRADO") {
			const qtdDevolvida = item.qtd_devolvida ?? 0;
			map.set(
				item.modelo_id,
				(map.get(item.modelo_id) ?? 0) -
					((item.qtd_enviada ?? 0) - qtdDevolvida)
			);
		}
	}

	for (const v of vendasDiretas) {
		map.set(v.modelo_id, (map.get(v.modelo_id) ?? 0) - (v.quantidade ?? 0));
	}

	return map;
}

export async function resolverPrecoVendaDireta(
	modeloId: string,
	quantidade: number
) {
	return resolverPrecoModelo(modeloId, quantidade);
}

export async function criarVendaDireta(data: CriarVendaDiretaInput) {
	if (!data.itens.length) throw new Error("Adicione ao menos um item");

	const supabase = await createClient();

	const [{ data: producoes }, { data: envioItens }, { data: vendasDiretas }] =
		await Promise.all([
			supabase
				.from("producao")
				.select("modelo_id, quantidade")
				.is("deleted_at", null),
			supabase
				.from("envio_item")
				.select(
					"modelo_id, qtd_enviada, qtd_vendida, qtd_devolvida, envio:envio_id(status)"
				)
				.is("deleted_at", null)
				.not("envio", "is", null),
			supabase
				.from("venda_direta_item")
				.select("modelo_id, quantidade, venda:venda_id(deleted_at)")
				.not("venda", "is", null),
		]);

	const vendasValidas = (vendasDiretas ?? [])
		.filter(v => {
			const venda = v.venda as unknown as { deleted_at: string | null } | null;
			return !venda?.deleted_at;
		})
		.map(v => ({
			modelo_id: v.modelo_id as string,
			quantidade: (v.quantidade as number | null) ?? 0,
		}));

	const estoqueMap = disponibilidadeBaseMap(
		(producoes ?? []) as Array<{ modelo_id: string; quantidade: number }>,
		(envioItens ?? []) as Array<{
			modelo_id: string;
			qtd_enviada: number | null;
			qtd_vendida: number | null;
			qtd_devolvida: number | null;
			envio: unknown;
		}>,
		vendasValidas
	);

	for (const item of data.itens) {
		const disponivel = estoqueMap.get(item.modeloId) ?? 0;
		if (item.quantidade > disponivel) {
			throw new Error("Estoque insuficiente para um ou mais itens");
		}
		estoqueMap.set(item.modeloId, disponivel - item.quantidade);
	}

	let subtotal = 0;
	const itensResolvidos: Array<{
		modelo_id: string;
		quantidade: number;
		preco_unitario: number;
		preco_origem: "MODELO" | "MANUAL";
		subtotal: number;
	}> = [];

	for (const item of data.itens) {
		const resolved = await resolverPrecoModelo(item.modeloId, item.quantidade);
		const origem = (item.origem ?? (resolved.origem ? "MODELO" : "MANUAL")) as
			| "MODELO"
			| "MANUAL";
		const precoUnit =
			origem === "MANUAL"
				? (item.preco ?? 0)
				: (resolved.preco ?? item.preco ?? 0);
		const itemSubtotal = Number((precoUnit * item.quantidade).toFixed(2));
		subtotal += itemSubtotal;

		itensResolvidos.push({
			modelo_id: item.modeloId,
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
