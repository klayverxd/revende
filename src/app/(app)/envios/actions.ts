"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buscarDisponivelPorModelo } from "@/lib/queries/estoque";
import { envioEstaEncerrado } from "@/modules/envio/fechamento";
import { resolverPreco } from "@/lib/utils/preco";
import { z } from "zod";
import {
	validar,
	zDataISO,
	zQuantidade,
	zTextoOmitivel,
	zUuid,
	zValor,
} from "@/lib/validacao";

export interface CriarEnvioItemInput {
	modeloId: string;
	quantidade: number;
	preco?: number | null;
	origem?: "MODELO" | "REVENDEDOR" | "MANUAL";
}

export async function resolverPrecoEnvio(
	revendedorId: string,
	modeloId: string
) {
	return resolverPreco(modeloId, revendedorId);
}

const envioItemSchema = z.object({
	modeloId: zUuid,
	quantidade: zQuantidade,
	preco: zValor.nullable().optional(),
	origem: z.enum(["MODELO", "REVENDEDOR", "MANUAL"]).optional(),
});

const criarEnvioSchema = z.object({
	revendedorId: zUuid,
	itens: z
		.array(envioItemSchema)
		.min(1, "Adicione ao menos um item")
		.max(500, "Envio com itens demais"),
	observacao: zTextoOmitivel(),
	data: zDataISO.optional(),
});

export async function criarEnvio(
	revendedorId: string,
	itens: CriarEnvioItemInput[],
	observacao?: string,
	data?: string
): Promise<{ envioId: string }> {
	// Server Action é endpoint HTTP: valida aqui, não confia no formulário.
	({ revendedorId, itens, observacao, data } = validar(
		criarEnvioSchema,
		{ revendedorId, itens, observacao, data },
		"Não foi possível criar o envio"
	));

	const supabase = await createClient();

	const { data: revendedor, error: revError } = await supabase
		.from("revendedor")
		.select("revendedor_id, modelo_acerto")
		.eq("revendedor_id", revendedorId)
		.is("deleted_at", null)
		.single();

	if (revError || !revendedor) throw new Error("Revendedor nao encontrado");

	const { data: createdEnvio, error: envioError } = await supabase
		.from("envio")
		.insert({
			revendedor_id: revendedorId,
			data_envio: data ?? new Date().toISOString().slice(0, 10),
			status: "ABERTO",
			observacao: observacao?.trim() || null,
		})
		.select("envio_id")
		.single();

	if (envioError) throw new Error(envioError.message);
	const envioId = createdEnvio.envio_id as string;

	// Auto-create producao entries for items that exceed available stock
	const modeloIds = itens
		.filter(
			i => i.modeloId && Number.isFinite(i.quantidade) && i.quantidade > 0
		)
		.map(i => i.modeloId);

	if (modeloIds.length > 0) {
		// Fórmula canônica — inclui as vendas diretas, que a versão anterior
		// desta função ignorava (e por isso subestimava o déficit).
		const disponivelMap = await buscarDisponivelPorModelo(modeloIds);

		const producaoPayloads = [];
		const dataEnvio = data ?? new Date().toISOString().slice(0, 10);
		for (const item of itens) {
			if (
				!item.modeloId ||
				!Number.isFinite(item.quantidade) ||
				item.quantidade <= 0
			)
				continue;
			const disponivel = disponivelMap.get(item.modeloId) ?? 0;
			const deficit = item.quantidade - disponivel;
			if (deficit > 0) {
				producaoPayloads.push({
					modelo_id: item.modeloId,
					quantidade: deficit,
					data_producao: dataEnvio,
					observacao: `Entrada automática gerada pelo envio`,
				});
			}
		}

		if (producaoPayloads.length > 0) {
			const { error: prodError } = await supabase
				.from("producao")
				.insert(producaoPayloads);
			if (prodError) throw new Error(prodError.message);
		}
	}

	const payloads = [];
	for (const item of itens) {
		if (!item.modeloId) continue;
		if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) continue;

		const resolvido = await resolverPreco(item.modeloId, revendedorId);
		const origem = item.origem ?? resolvido.origem ?? "MANUAL";
		const precoFinal = item.preco ?? resolvido.preco;
		const modeloAcerto = revendedor.modelo_acerto as
			| "COMISSAO"
			| "VALOR_MINIMO";

		payloads.push({
			envio_id: envioId,
			modelo_id: item.modeloId,
			modelo_acerto: modeloAcerto,
			qtd_enviada: item.quantidade,
			preco_unitario:
				modeloAcerto === "COMISSAO"
					? origem === "MANUAL"
						? precoFinal
						: resolvido.precoUnitario
					: null,
			preco_2mais: null,
			valor_minimo_unit:
				modeloAcerto === "VALOR_MINIMO"
					? origem === "MANUAL"
						? precoFinal
						: (resolvido.valorMinimoUnit ?? precoFinal)
					: null,
			preco_origem: origem,
			qtd_vendida: null,
			qtd_devolvida: null,
			valor_total_venda: null,
			valor_a_receber: null,
			preco_cliente: null,
			modo_valor: "CALCULADO" as const,
		});
	}

	if (payloads.length > 0) {
		const { error: itemError } = await supabase
			.from("envio_item")
			.insert(payloads);
		if (itemError) throw new Error(itemError.message);
	}

	revalidatePath("/envios");
	revalidatePath("/conferencias");
	revalidatePath("/estoque");

	return { envioId };
}

export interface DevolucaoItemInput {
	envioItemId: string;
	qtdDevolvida: number;
}

export async function registrarDevolucao(
	envioId: string,
	itens: DevolucaoItemInput[]
): Promise<void> {
	if (!envioId) throw new Error("Envio inválido");
	if (!itens.length) throw new Error("Informe as quantidades devolvidas");

	const supabase = await createClient();
	const { data: envio, error: envioError } = await supabase
		.from("envio")
		.select("status")
		.eq("envio_id", envioId)
		.is("deleted_at", null)
		.single();

	if (envioError || !envio) throw new Error("Envio não encontrado");
	if (!["CONFERIDO", "ENCERRADO"].includes(envio.status as string)) {
		throw new Error(
			"A devolução só pode ser registrada para envios conferidos"
		);
	}

	// Busca os itens do envio para validar
	const { data: envioItens, error: fetchError } = await supabase
		.from("envio_item")
		.select("envio_item_id, qtd_enviada, qtd_vendida, qtd_devolvida")
		.eq("envio_id", envioId)
		.is("deleted_at", null);

	if (fetchError) throw new Error(fetchError.message);

	const itemMap = new Map(
		(envioItens ?? []).map(i => [i.envio_item_id as string, i])
	);

	for (const input of itens) {
		const dbItem = itemMap.get(input.envioItemId);
		if (!dbItem) continue;

		const qtdEnviada = (dbItem.qtd_enviada as number) ?? 0;
		const qtdVendida = (dbItem.qtd_vendida as number | null) ?? 0;
		const qtdDevolvidaAtual = (dbItem.qtd_devolvida as number | null) ?? 0;
		const maxDevolvivel = qtdEnviada - qtdVendida - qtdDevolvidaAtual;
		const qtdNova = Math.min(
			Math.max(0, Math.floor(input.qtdDevolvida)),
			maxDevolvivel
		);
		const qtdTotalDevolvida = qtdDevolvidaAtual + qtdNova;

		const { error: updateError } = await supabase
			.from("envio_item")
			.update({ qtd_devolvida: qtdTotalDevolvida })
			.eq("envio_item_id", input.envioItemId);

		if (updateError) throw new Error(updateError.message);
	}

	// Verifica se todos os itens estão fully encerrados (vendido + devolvido = enviado)
	const { data: updatedItens } = await supabase
		.from("envio_item")
		.select("qtd_enviada, qtd_vendida, qtd_devolvida")
		.eq("envio_id", envioId)
		.is("deleted_at", null);

	const tudo_encerrado = envioEstaEncerrado(
		(updatedItens ?? []).map(i => ({
			qtd_enviada: i.qtd_enviada as number | null,
			qtd_vendida: i.qtd_vendida as number | null,
			qtd_devolvida: i.qtd_devolvida as number | null,
		}))
	);

	if (tudo_encerrado) {
		const { error: envioError } = await supabase
			.from("envio")
			.update({ status: "ENCERRADO" })
			.eq("envio_id", envioId);
		if (envioError) throw new Error(envioError.message);
	}

	revalidatePath("/envios");
	revalidatePath("/estoque");
	revalidatePath("/financeiro");
	revalidatePath("/dashboard");
}

export async function trocarRevendedor(
	envioId: string,
	novoRevendedorId: string
): Promise<void> {
	if (!envioId || !novoRevendedorId) throw new Error("Parâmetros inválidos");

	const supabase = await createClient();

	// Busca envio
	const { data: envio, error: envioError } = await supabase
		.from("envio")
		.select("envio_id, status")
		.eq("envio_id", envioId)
		.is("deleted_at", null)
		.single();

	if (envioError || !envio) throw new Error("Envio não encontrado");
	if (envio.status !== "ABERTO")
		throw new Error("Só é possível trocar o revendedor de envios ABERTOS");

	// Busca novo revendedor
	const { data: novoRev, error: revError } = await supabase
		.from("revendedor")
		.select("revendedor_id, modelo_acerto")
		.eq("revendedor_id", novoRevendedorId)
		.is("deleted_at", null)
		.single();

	if (revError || !novoRev) throw new Error("Revendedor não encontrado");

	const novoModeloAcerto = novoRev.modelo_acerto as "COMISSAO" | "VALOR_MINIMO";

	// Busca itens do envio
	const { data: itens } = await supabase
		.from("envio_item")
		.select("envio_item_id, modelo_id, qtd_enviada")
		.eq("envio_id", envioId)
		.is("deleted_at", null);

	// Re-resolve preços para cada item com o novo revendedor
	for (const item of itens ?? []) {
		const modeloId = item.modelo_id as string;
		const resolvido = await resolverPreco(modeloId, novoRevendedorId);
		const origem = resolvido.origem ?? "MANUAL";

		await supabase
			.from("envio_item")
			.update({
				modelo_acerto: novoModeloAcerto,
				preco_unitario:
					novoModeloAcerto === "COMISSAO" ? resolvido.precoUnitario : null,
				valor_minimo_unit:
					novoModeloAcerto === "VALOR_MINIMO"
						? resolvido.valorMinimoUnit
						: null,
				preco_origem: origem,
			})
			.eq("envio_item_id", item.envio_item_id as string);
	}

	// Atualiza o revendedor do envio
	const { error } = await supabase
		.from("envio")
		.update({ revendedor_id: novoRevendedorId })
		.eq("envio_id", envioId);

	if (error) throw new Error(error.message);

	revalidatePath(`/envios/${envioId}`);
	revalidatePath("/envios");
	revalidatePath("/conferencias");
}

export async function editarEnvio(
	envioId: string,
	data: { dataEnvio: string; observacao: string }
): Promise<void> {
	if (!envioId) throw new Error("ID inválido");
	if (!data.dataEnvio) throw new Error("Data obrigatória");

	const supabase = await createClient();

	const { data: envio, error: fetchError } = await supabase
		.from("envio")
		.select("status")
		.eq("envio_id", envioId)
		.is("deleted_at", null)
		.single();

	if (fetchError || !envio) throw new Error("Envio não encontrado");
	if (envio.status !== "ABERTO")
		throw new Error("Só é possível editar envios ABERTOS");

	const { error } = await supabase
		.from("envio")
		.update({
			data_envio: data.dataEnvio,
			observacao: data.observacao.trim() || null,
		})
		.eq("envio_id", envioId);

	if (error) throw new Error(error.message);

	revalidatePath(`/envios/${envioId}`);
	revalidatePath("/envios");
}
