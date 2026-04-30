"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ConfirmarConferenciaItemInput {
	envioItemId: string;
	qtdContada: number;
	precoCliente?: number | null;
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function precoPorFaixa(
	qtdVendida: number,
	precoUnitario: number | null,
	preco2mais: number | null
) {
	if (qtdVendida <= 0) return 0;
	if (qtdVendida >= 2 && Number.isFinite(preco2mais)) {
		return qtdVendida * (preco2mais ?? 0);
	}
	return qtdVendida * (precoUnitario ?? 0);
}

async function salvarAcertoPorEnvio(
	supabase: Awaited<ReturnType<typeof createClient>>,
	envioId: string,
	payload: {
		revendedor_id: string;
		modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
		comissao_calculada: number | null;
		valor_liquido: number | null;
		valor_a_receber: number | null;
		status: "PENDENTE";
	}
) {
	const { data: existente, error: buscaError } = await supabase
		.from("acerto")
		.select("acerto_id")
		.eq("envio_id", envioId)
		.is("deleted_at", null)
		.maybeSingle();

	if (buscaError) throw new Error(buscaError.message);

	if (existente?.acerto_id) {
		const { error: updateError } = await supabase
			.from("acerto")
			.update({
				revendedor_id: payload.revendedor_id,
				envio_id: envioId,
				modelo_acerto: payload.modelo_acerto,
				comissao_calculada: payload.comissao_calculada,
				valor_liquido: payload.valor_liquido,
				valor_a_receber: payload.valor_a_receber,
				status: payload.status,
			})
			.eq("acerto_id", existente.acerto_id);

		if (updateError) throw new Error(updateError.message);
		return;
	}

	const { error: insertError } = await supabase.from("acerto").insert({
		revendedor_id: payload.revendedor_id,
		envio_id: envioId,
		modelo_acerto: payload.modelo_acerto,
		comissao_calculada: payload.comissao_calculada,
		valor_liquido: payload.valor_liquido,
		valor_a_receber: payload.valor_a_receber,
		status: payload.status,
	});

	if (insertError) throw new Error(insertError.message);
}

export async function confirmarConferencia(
	envioId: string,
	itens: ConfirmarConferenciaItemInput[],
	valorManual?: number
) {
	if (!envioId) throw new Error("Envio invalido");
	if (!itens.length) throw new Error("Informe as quantidades contadas");

	const supabase = await createClient();

	const { data: envio, error: envioError } = await supabase
		.from("envio")
		.select(
			"envio_id, status, revendedor_id, revendedor:revendedor_id(modelo_acerto, comissao_fixa, comissao_pct)"
		)
		.eq("envio_id", envioId)
		.is("deleted_at", null)
		.single();

	if (envioError || !envio) throw new Error("Envio nao encontrado");
	if ((envio.status as string) !== "ABERTO") {
		throw new Error("Apenas envios ABERTOS podem ser conferidos");
	}

	const { data: envioItens, error: itensError } = await supabase
		.from("envio_item")
		.select(
			"envio_item_id, qtd_enviada, preco_unitario, preco_2mais, valor_minimo_unit, modelo_acerto"
		)
		.eq("envio_id", envioId)
		.is("deleted_at", null);

	if (itensError) throw new Error(itensError.message);
	if (!envioItens || envioItens.length === 0) {
		throw new Error("Envio sem itens");
	}

	const itemInputMap = new Map(itens.map(i => [i.envioItemId, i]));

	const modeloAcerto = envioItens[0].modelo_acerto as
		| "COMISSAO"
		| "VALOR_MINIMO";
	let totalCalculadoComissao = 0;
	let totalValorMinimo = 0;
	const updates: Array<{
		envio_item_id: string;
		qtd_vendida: number;
		qtd_devolvida: number;
		valor_total_venda: number | null;
		valor_a_receber: number | null;
		preco_cliente: number | null;
		modo_valor: "CALCULADO" | "MANUAL";
	}> = [];

	for (const dbItem of envioItens) {
		const input = itemInputMap.get(dbItem.envio_item_id as string);
		if (!input) {
			throw new Error("Todos os itens do envio precisam ser conferidos");
		}

		const qtdEnviada = (dbItem.qtd_enviada as number) ?? 0;
		const qtdContada = clamp(Math.floor(input.qtdContada ?? 0), 0, qtdEnviada);
		const qtdVendida = qtdEnviada - qtdContada;
		const qtdDevolvida = qtdContada;

		if (modeloAcerto === "COMISSAO") {
			const valorItem = precoPorFaixa(
				qtdVendida,
				(dbItem.preco_unitario as number | null) ?? null,
				(dbItem.preco_2mais as number | null) ?? null
			);
			totalCalculadoComissao += valorItem;
			updates.push({
				envio_item_id: dbItem.envio_item_id as string,
				qtd_vendida: qtdVendida,
				qtd_devolvida: qtdDevolvida,
				valor_total_venda: valorItem,
				valor_a_receber: null,
				preco_cliente: Number.isFinite(input.precoCliente as number)
					? (input.precoCliente as number)
					: null,
				modo_valor: "CALCULADO",
			});
		} else {
			const valorMinimoUnit = (dbItem.valor_minimo_unit as number | null) ?? 0;
			const valorReceberItem = qtdVendida * valorMinimoUnit;
			totalValorMinimo += valorReceberItem;
			updates.push({
				envio_item_id: dbItem.envio_item_id as string,
				qtd_vendida: qtdVendida,
				qtd_devolvida: qtdDevolvida,
				valor_total_venda: null,
				valor_a_receber: valorReceberItem,
				preco_cliente: Number.isFinite(input.precoCliente as number)
					? (input.precoCliente as number)
					: null,
				modo_valor: "CALCULADO",
			});
		}
	}

	if (modeloAcerto === "COMISSAO" && Number.isFinite(valorManual as number)) {
		const manual = Math.max(0, valorManual as number);
		if (totalCalculadoComissao > 0) {
			const fator = manual / totalCalculadoComissao;
			for (const item of updates) {
				item.valor_total_venda = Number(
					((item.valor_total_venda ?? 0) * fator).toFixed(2)
				);
				item.modo_valor = "MANUAL";
			}
		} else if (updates.length > 0) {
			updates[0].valor_total_venda = manual;
			updates[0].modo_valor = "MANUAL";
		}
		totalCalculadoComissao = updates.reduce(
			(acc, item) => acc + (item.valor_total_venda ?? 0),
			0
		);
	}

	for (const up of updates) {
		const { error } = await supabase
			.from("envio_item")
			.update({
				qtd_vendida: up.qtd_vendida,
				qtd_devolvida: up.qtd_devolvida,
				valor_total_venda: up.valor_total_venda,
				valor_a_receber: up.valor_a_receber,
				preco_cliente: up.preco_cliente,
				modo_valor: up.modo_valor,
			})
			.eq("envio_item_id", up.envio_item_id);

		if (error) throw new Error(error.message);
	}

	if (modeloAcerto === "COMISSAO") {
		const rev = envio.revendedor as unknown as {
			comissao_fixa: number | null;
			comissao_pct: number | null;
		};
		const comissaoFixa = rev?.comissao_fixa ?? 0;
		const comissaoPct = rev?.comissao_pct ?? 0;
		const comissaoCalculada =
			comissaoFixa + totalCalculadoComissao * comissaoPct;
		const valorLiquido = totalCalculadoComissao - comissaoCalculada;

		await salvarAcertoPorEnvio(supabase, envioId, {
			revendedor_id: envio.revendedor_id as string,
			modelo_acerto: "COMISSAO",
			comissao_calculada: Number(comissaoCalculada.toFixed(2)),
			valor_liquido: Number(valorLiquido.toFixed(2)),
			valor_a_receber: null,
			status: "PENDENTE",
		});
	} else {
		await salvarAcertoPorEnvio(supabase, envioId, {
			revendedor_id: envio.revendedor_id as string,
			modelo_acerto: "VALOR_MINIMO",
			comissao_calculada: null,
			valor_liquido: null,
			valor_a_receber: Number(totalValorMinimo.toFixed(2)),
			status: "PENDENTE",
		});
	}

	const { error: statusError } = await supabase
		.from("envio")
		.update({ status: "CONFERIDO" })
		.eq("envio_id", envioId);
	if (statusError) throw new Error(statusError.message);

	revalidatePath("/conferencias");
	revalidatePath(`/conferencias/${envioId}`);
	revalidatePath("/financeiro");
	revalidatePath("/estoque");
}
