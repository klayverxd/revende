"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface RegistrarProducaoData {
	modelo_id: string;
	quantidade: number;
	custo_unitario?: number | null;
	data_producao?: string;
	observacao?: string;
}

export interface EstoqueCalculadoRow {
	modelo_id: string;
	codigo: string;
	nome: string;
	estoque_inicial: number;
	entradas: number;
	saidas: number;
	estoque_minimo: number;
	disponivel: number;
	status: "OK" | "ATENCAO" | "REPOR" | "SEM_ESTOQUE";
}

function calcularStatus(
	disponivel: number,
	minimo: number
): EstoqueCalculadoRow["status"] {
	if (disponivel <= 0) return "SEM_ESTOQUE";
	if (disponivel <= minimo) return "REPOR";
	if (disponivel <= minimo * 1.5) return "ATENCAO";
	return "OK";
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
		custo_unitario: data.custo_unitario ?? null,
		data_producao: data.data_producao ?? new Date().toISOString().slice(0, 10),
		observacao: data.observacao?.trim() || null,
	});

	if (error) throw new Error(error.message);

	revalidatePath("/estoque");
	revalidatePath("/produtos");
}

export async function buscarEstoque(): Promise<EstoqueCalculadoRow[]> {
	const supabase = await createClient();

	const [{ data: modelos }, { data: producoes }, { data: envioItens }] =
		await Promise.all([
			supabase
				.from("modelo")
				.select("modelo_id, codigo, nome, estoque_minimo")
				.is("deleted_at", null)
				.order("nome"),
			supabase
				.from("producao")
				.select("modelo_id, quantidade")
				.is("deleted_at", null),
			supabase
				.from("envio_item")
				.select("modelo_id, qtd_enviada, qtd_vendida, envio:envio_id(status)")
				.is("deleted_at", null)
				.not("envio", "is", null),
		]);

	const entradasMap = new Map<string, number>();
	const saidasMap = new Map<string, number>();

	for (const p of producoes ?? []) {
		const modeloId = p.modelo_id as string;
		entradasMap.set(
			modeloId,
			(entradasMap.get(modeloId) ?? 0) + (p.quantidade ?? 0)
		);
	}

	for (const item of envioItens ?? []) {
		const modeloId = item.modelo_id as string;
		const envio = item.envio as unknown as { status: string } | null;
		if (!envio) continue;

		if (envio.status === "ABERTO") {
			saidasMap.set(
				modeloId,
				(saidasMap.get(modeloId) ?? 0) + (item.qtd_enviada ?? 0)
			);
		}
		if (envio.status === "CONFERIDO" || envio.status === "ENCERRADO") {
			saidasMap.set(
				modeloId,
				(saidasMap.get(modeloId) ?? 0) + (item.qtd_vendida ?? 0)
			);
		}
	}

	return (modelos ?? []).map(m => {
		const modeloId = m.modelo_id as string;
		const entradas = entradasMap.get(modeloId) ?? 0;
		const saidas = saidasMap.get(modeloId) ?? 0;
		const disponivel = entradas - saidas;
		const minimo = (m.estoque_minimo as number | null) ?? 0;

		return {
			modelo_id: modeloId,
			codigo: (m.codigo as string | null) ?? "-",
			nome: m.nome as string,
			estoque_inicial: 0,
			entradas,
			saidas,
			estoque_minimo: minimo,
			disponivel,
			status: calcularStatus(disponivel, minimo),
		};
	});
}
