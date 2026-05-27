"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ConfirmarConferenciaItemInput {
	envioItemId: string;
	qtdContada: number;
	qtdDevolvida?: number;
	precoCliente?: number | null;
	/** Valor total pré-calculado pelo cliente (qtd_vendida × preço editado pelo usuário). */
	valorVenda?: number;
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function precoPorFaixa(qtdVendida: number, precoUnitario: number | null) {
	if (qtdVendida <= 0) return 0;
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

// ─── Internal core — processa um envio já validado ────────────────────────
async function processarUmEnvio(
	supabase: Awaited<ReturnType<typeof createClient>>,
	envioId: string,
	itens: ConfirmarConferenciaItemInput[],
	valorManual?: number
) {
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
		throw new Error(`Envio ${envioId} nao esta ABERTO`);
	}

	const { data: envioItens, error: itensError } = await supabase
		.from("envio_item")
		.select(
			"envio_item_id, qtd_enviada, qtd_vendida, qtd_devolvida, valor_total_venda, preco_unitario, valor_minimo_unit, modelo_acerto"
		)
		.eq("envio_id", envioId)
		.is("deleted_at", null);

	if (itensError) throw new Error(itensError.message);
	if (!envioItens || envioItens.length === 0)
		throw new Error("Envio sem itens");

	const itemInputMap = new Map(itens.map(i => [i.envioItemId, i]));
	const modeloAcerto = envioItens[0].modelo_acerto as
		| "COMISSAO"
		| "VALOR_MINIMO";
	let totalCalculadoComissao = 0;
	let totalValorMinimo = 0;
	let totalRemanentes = 0;
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
		if (!input)
			throw new Error("Todos os itens do envio precisam ser conferidos");

		const qtdEnviada = (dbItem.qtd_enviada as number) ?? 0;
		const existingQtdVendida = (dbItem.qtd_vendida as number | null) ?? 0;
		const existingQtdDevolvida = (dbItem.qtd_devolvida as number | null) ?? 0;
		const qtdRestante = qtdEnviada - existingQtdVendida - existingQtdDevolvida;
		const qtdContada = clamp(Math.floor(input.qtdContada ?? 0), 0, qtdRestante);
		const qtdNovaDevolvida = clamp(
			Math.floor(input.qtdDevolvida ?? 0),
			0,
			qtdRestante - qtdContada
		);
		const qtdVendidaNova = qtdRestante - qtdContada - qtdNovaDevolvida;
		const qtdVendidaTotal = existingQtdVendida + qtdVendidaNova;
		const qtdDevolvida = existingQtdDevolvida + qtdNovaDevolvida;
		totalRemanentes += qtdContada;

		if (modeloAcerto === "COMISSAO") {
			const existingValorVenda =
				(dbItem.valor_total_venda as number | null) ?? 0;
			// Prefer client-provided value (uses user-edited prices); fall back to DB snapshot.
			const valorNovo =
				input.valorVenda !== undefined
					? input.valorVenda
					: precoPorFaixa(qtdVendidaNova, (dbItem.preco_unitario as number | null) ?? null);
			const valorItemTotal = existingValorVenda + valorNovo;
			totalCalculadoComissao += valorItemTotal;
			updates.push({
				envio_item_id: dbItem.envio_item_id as string,
				qtd_vendida: qtdVendidaTotal,
				qtd_devolvida: qtdDevolvida,
				valor_total_venda: valorItemTotal,
				valor_a_receber: null,
				preco_cliente: typeof input.precoCliente === "number" && Number.isFinite(input.precoCliente)
					? input.precoCliente
					: null,
				modo_valor: "CALCULADO",
			});
		} else {
			const valorMinimoUnit = (dbItem.valor_minimo_unit as number | null) ?? 0;
			const valorReceberTotal = qtdVendidaTotal * valorMinimoUnit;
			totalValorMinimo += valorReceberTotal;
			updates.push({
				envio_item_id: dbItem.envio_item_id as string,
				qtd_vendida: qtdVendidaTotal,
				qtd_devolvida: qtdDevolvida,
				valor_total_venda: null,
				valor_a_receber: valorReceberTotal,
				preco_cliente: typeof input.precoCliente === "number" && Number.isFinite(input.precoCliente)
					? input.precoCliente
					: null,
				modo_valor: "CALCULADO",
			});
		}
	}

	if (modeloAcerto === "COMISSAO" && Number.isFinite(valorManual ?? NaN)) {
		const manual = Number(Math.max(0, valorManual!).toFixed(2));
		if (totalCalculadoComissao > 0) {
			const fator = manual / totalCalculadoComissao;
			let distribuido = 0;
			for (let i = 0; i < updates.length - 1; i++) {
				const v = Number(((updates[i].valor_total_venda ?? 0) * fator).toFixed(2));
				updates[i].valor_total_venda = v;
				updates[i].modo_valor = "MANUAL";
				distribuido = Number((distribuido + v).toFixed(2));
			}
			const last = updates.at(-1)!;
			last.valor_total_venda = Number((manual - distribuido).toFixed(2));
			last.modo_valor = "MANUAL";
		} else if (updates.length > 0) {
			updates[0].valor_total_venda = manual;
			updates[0].modo_valor = "MANUAL";
		}
		totalCalculadoComissao = manual;
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

	const newStatus = totalRemanentes === 0 ? "CONFERIDO" : "ABERTO";
	const { error: statusError } = await supabase
		.from("envio")
		.update({ status: newStatus })
		.eq("envio_id", envioId);
	if (statusError) throw new Error(statusError.message);
}

export async function confirmarConferencia(
	envioId: string,
	itens: ConfirmarConferenciaItemInput[],
	valorManual?: number
) {
	if (!envioId) throw new Error("Envio invalido");
	if (!itens.length) throw new Error("Informe as quantidades contadas");

	const supabase = await createClient();
	await processarUmEnvio(supabase, envioId, itens, valorManual);

	revalidatePath("/conferencias");
	revalidatePath(`/conferencias/${envioId}`);
	revalidatePath("/financeiro");
	revalidatePath("/estoque");
}

// ─── Confirmar conferência de múltiplos envios de um revendedor ──────────────
export interface EnvioConferenciaInput {
	envioId: string;
	itens: ConfirmarConferenciaItemInput[];
	/** Valor manual já rateado para este envio (calculado pelo cliente) */
	valorManual?: number;
}

export async function confirmarConferenciaRevendedor(
	revendedorId: string,
	enviosInput: EnvioConferenciaInput[]
) {
	if (!revendedorId) throw new Error("Revendedor invalido");
	if (!enviosInput.length) throw new Error("Nenhum envio informado");

	const supabase = await createClient();

	for (const envio of enviosInput) {
		if (!envio.itens.length) continue;
		await processarUmEnvio(
			supabase,
			envio.envioId,
			envio.itens,
			envio.valorManual
		);
	}

	revalidatePath("/conferencias");
	revalidatePath(`/conferencias/revendedor/${revendedorId}`);
	revalidatePath("/financeiro");
	revalidatePath("/estoque");
}

// ─── Detalhe de conferência para relatório ───────────────────────────────────

export interface ConferenciaDetalheItem {
	modelo_nome: string;
	modelo_codigo: string | null;
	qtd_enviada: number;
	qtd_vendida: number;
	qtd_devolvida: number;
	preco_unitario: number | null;
	valor_minimo_unit: number | null;
	valor_total_venda: number | null;
	valor_a_receber: number | null;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
}

export interface ConferenciaDetalheEnvio {
	envio_id: string;
	data_envio: string;
	updated_at: string;
	itens: ConferenciaDetalheItem[];
}

export async function buscarDetalheConferencia(
	envioIds: string[]
): Promise<ConferenciaDetalheEnvio[]> {
	if (!envioIds.length) return [];
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("envio")
		.select(
			`envio_id, data_envio, updated_at,
			 envio_item(
				modelo_acerto, qtd_enviada, qtd_vendida, qtd_devolvida,
				preco_unitario, valor_minimo_unit, valor_total_venda, valor_a_receber,
				modelo:modelo_id(nome, codigo)
			 )`
		)
		.in("envio_id", envioIds)
		.is("deleted_at", null)
		.order("data_envio", { ascending: true });

	if (error) throw new Error(error.message);

	return (data ?? []).map(e => ({
		envio_id: e.envio_id as string,
		data_envio: e.data_envio as string,
		updated_at: e.updated_at as string,
		itens: ((e.envio_item as unknown as Array<{
			modelo_acerto: string;
			qtd_enviada: number;
			qtd_vendida: number | null;
			qtd_devolvida: number | null;
			preco_unitario: number | null;
			valor_minimo_unit: number | null;
			valor_total_venda: number | null;
			valor_a_receber: number | null;
			modelo: { nome: string; codigo: string | null } | null;
		}>) ?? [])
			.filter(i => (i.qtd_vendida ?? 0) > 0)
			.map(i => ({
				modelo_nome: i.modelo?.nome ?? "—",
				modelo_codigo: i.modelo?.codigo ?? null,
				qtd_enviada: i.qtd_enviada ?? 0,
				qtd_vendida: i.qtd_vendida ?? 0,
				qtd_devolvida: i.qtd_devolvida ?? 0,
				preco_unitario: i.preco_unitario,
				valor_minimo_unit: i.valor_minimo_unit,
				valor_total_venda: i.valor_total_venda,
				valor_a_receber: i.valor_a_receber,
				modelo_acerto: i.modelo_acerto as "COMISSAO" | "VALOR_MINIMO",
			})),
	}));
}

export interface SalvarPrecoInput {
	modelo_id: string;
	revendedor_id: string;
	preco: number;
	tipo: "COMISSAO" | "VALOR_MINIMO";
}

export async function salvarPrecoNoCadastro(itens: SalvarPrecoInput[]) {
	if (!itens.length) return;
	const supabase = await createClient();

	for (const item of itens) {
		const { data: existing } = await supabase
			.from("revendedor_modelo_preco")
			.select("rev_preco_id")
			.eq("revendedor_id", item.revendedor_id)
			.eq("modelo_id", item.modelo_id)
			.eq("quantidade_minima", 1)
			.eq("eh_promocao", false)
			.is("deleted_at", null)
			.maybeSingle();

		if (existing) {
			await supabase
				.from("revendedor_modelo_preco")
				.update(
					item.tipo === "VALOR_MINIMO"
						? { valor_minimo: item.preco }
						: { preco: item.preco }
				)
				.eq("rev_preco_id", existing.rev_preco_id);
		} else {
			await supabase.from("revendedor_modelo_preco").insert({
				revendedor_id: item.revendedor_id,
				modelo_id: item.modelo_id,
				rotulo: "Padrão",
				quantidade_minima: 1,
				preco: item.tipo === "COMISSAO" ? item.preco : null,
				valor_minimo: item.tipo === "VALOR_MINIMO" ? item.preco : null,
				eh_promocao: false,
				ativo: true,
			});
		}
	}

	revalidatePath("/revendedores");
	revalidatePath("/envios");
}
