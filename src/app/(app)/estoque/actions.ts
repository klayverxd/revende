"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buscarEstoqueCalculado } from "@/lib/queries/estoque";
import { gerarCodigoModelo } from "@/lib/queries/modelo";
import { envioEstaEncerrado } from "@/modules/envio/fechamento";
import type { EstoqueCalculadoRow } from "@/modules/estoque/calcular";

export type { EstoqueCalculadoRow };

export interface RegistrarProducaoData {
	modelo_id: string;
	quantidade: number;
	data_producao?: string;
	observacao?: string;
}

export async function registrarProducao(data: RegistrarProducaoData) {
	if (!data.modelo_id) throw new Error("Produto obrigatorio");
	if (!Number.isFinite(data.quantidade) || data.quantidade <= 0) {
		throw new Error("Quantidade invalida");
	}

	const supabase = await createClient();
	const { error } = await supabase.from("producao").insert({
		modelo_id: data.modelo_id,
		quantidade: data.quantidade,
		data_producao: data.data_producao ?? new Date().toISOString().slice(0, 10),
		observacao: data.observacao?.trim() || null,
	});

	if (error) throw new Error(error.message);

	revalidatePath("/estoque");
	revalidatePath("/produtos");
}

export interface CriarProdutoEProducaoData {
	produto: {
		nome: string;
		codigo?: string;
		custo_producao?: number | null;
		estoque_minimo?: number;
	};
	producao: {
		quantidade: number;
		data_producao?: string;
		observacao?: string;
	};
}

export async function criarProdutoERegistrarProducao(
	data: CriarProdutoEProducaoData
) {
	if (!data.produto.nome?.trim())
		throw new Error("Nome do produto obrigatorio");
	if (
		!Number.isFinite(data.producao.quantidade) ||
		data.producao.quantidade <= 0
	) {
		throw new Error("Quantidade invalida");
	}

	const supabase = await createClient();

	const codigo = data.produto.codigo?.trim() || (await gerarCodigoModelo());

	const { data: novoModelo, error: errModelo } = await supabase
		.from("modelo")
		.insert({
			nome: data.produto.nome.trim(),
			codigo,
			custo_producao: data.produto.custo_producao ?? null,
			estoque_minimo: data.produto.estoque_minimo ?? 0,
			ativo: true,
		})
		.select("modelo_id")
		.single();

	if (errModelo || !novoModelo) {
		throw new Error(errModelo?.message ?? "Erro ao criar produto");
	}

	const { error: errProd } = await supabase.from("producao").insert({
		modelo_id: novoModelo.modelo_id,
		quantidade: data.producao.quantidade,
		data_producao:
			data.producao.data_producao ?? new Date().toISOString().slice(0, 10),
		observacao: data.producao.observacao?.trim() || null,
	});

	if (errProd) throw new Error(errProd.message);

	revalidatePath("/estoque");
	revalidatePath("/produtos");
}

/**
 * Mantida como server action para não quebrar os chamadores existentes; o
 * cálculo mora em `@/modules/estoque/calcular` e o carregamento em
 * `@/lib/queries/estoque`.
 */
export async function buscarEstoque(): Promise<EstoqueCalculadoRow[]> {
	return buscarEstoqueCalculado();
}

export async function registrarBaixaConsignacao(
	envioItemId: string,
	quantidade: number
) {
	if (!envioItemId) throw new Error("Item de consignacao invalido");
	if (!Number.isFinite(quantidade) || quantidade <= 0) {
		throw new Error("Quantidade invalida");
	}

	const supabase = await createClient();

	const { data: item, error: itemError } = await supabase
		.from("envio_item")
		.select("envio_item_id, envio_id, qtd_enviada, qtd_vendida, qtd_devolvida")
		.eq("envio_item_id", envioItemId)
		.is("deleted_at", null)
		.single();

	if (itemError || !item) throw new Error("Item de consignacao nao encontrado");

	const { data: envio, error: envioError } = await supabase
		.from("envio")
		.select("envio_id, status")
		.eq("envio_id", item.envio_id as string)
		.is("deleted_at", null)
		.single();

	if (envioError || !envio) throw new Error("Envio nao encontrado");
	if (!["CONFERIDO", "ENCERRADO"].includes(envio.status as string)) {
		throw new Error(
			"A baixa individual so pode ser feita em envios conferidos"
		);
	}

	const qtdEnviada = (item.qtd_enviada as number) ?? 0;
	const qtdVendida = (item.qtd_vendida as number | null) ?? 0;
	const qtdDevolvida = (item.qtd_devolvida as number | null) ?? 0;
	const disponivelBaixa = qtdEnviada - qtdVendida - qtdDevolvida;

	if (disponivelBaixa <= 0) {
		throw new Error("Nao ha saldo para baixa neste item");
	}

	const qtdBaixa = Math.min(Math.floor(quantidade), disponivelBaixa);
	const novoQtdDevolvida = qtdDevolvida + qtdBaixa;

	const { error: updateItemError } = await supabase
		.from("envio_item")
		.update({ qtd_devolvida: novoQtdDevolvida })
		.eq("envio_item_id", envioItemId);

	if (updateItemError) throw new Error(updateItemError.message);

	const { data: envioItens } = await supabase
		.from("envio_item")
		.select("qtd_enviada, qtd_vendida, qtd_devolvida")
		.eq("envio_id", item.envio_id as string)
		.is("deleted_at", null);

	const tudoEncerrado = envioEstaEncerrado(
		(envioItens ?? []).map(i => ({
			qtd_enviada: i.qtd_enviada as number | null,
			qtd_vendida: i.qtd_vendida as number | null,
			qtd_devolvida: i.qtd_devolvida as number | null,
		}))
	);

	if (tudoEncerrado) {
		const { error: updateEnvioError } = await supabase
			.from("envio")
			.update({ status: "ENCERRADO" })
			.eq("envio_id", item.envio_id as string);
		if (updateEnvioError) throw new Error(updateEnvioError.message);
	}

	revalidatePath("/estoque");
	revalidatePath("/envios");
	revalidatePath("/financeiro");
	revalidatePath("/dashboard");
}
