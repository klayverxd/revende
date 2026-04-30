"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolverPreco } from "@/lib/utils/preco";

export interface CriarEnvioItemInput {
	modeloId: string;
	quantidade: number;
	preco?: number | null;
	origem?: "MODELO" | "REVENDEDOR" | "MANUAL";
}

export async function resolverPrecoEnvio(
	revendedorId: string,
	modeloId: string,
	quantidade: number
) {
	return resolverPreco(modeloId, revendedorId, quantidade);
}

export async function criarEnvio(
	revendedorId: string,
	itens: CriarEnvioItemInput[],
	observacao?: string,
	data?: string
): Promise<{ envioId: string }> {
	if (!revendedorId) throw new Error("Revendedor obrigatorio");
	if (!itens.length) throw new Error("Adicione ao menos um item");

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

	for (const item of itens) {
		if (!item.modeloId) continue;
		if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) continue;

		const resolvido = await resolverPreco(
			item.modeloId,
			revendedorId,
			item.quantidade
		);
		const origem = item.origem ?? resolvido.origem ?? "MANUAL";
		const precoFinal = item.preco ?? resolvido.preco;
		const modeloAcerto = revendedor.modelo_acerto as
			| "COMISSAO"
			| "VALOR_MINIMO";

		const payload = {
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
			preco_2mais:
				modeloAcerto === "COMISSAO"
					? origem === "MANUAL"
						? precoFinal
						: resolvido.preco2mais
					: null,
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
		};

		const { error: itemError } = await supabase
			.from("envio_item")
			.insert(payload);
		if (itemError) throw new Error(itemError.message);
	}

	revalidatePath("/envios");
	revalidatePath("/conferencias");
	revalidatePath("/estoque");

	return { envioId };
}
