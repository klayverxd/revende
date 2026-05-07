"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface MateriaInput {
	materia_prima_id: string;
	quantidade: number;
}

export interface SalvarCalculoInput {
	equipamento_id: string;
	tempo_impressao_min: number;
	materias_primas: MateriaInput[];
	pct_falhas: number;
	custo_energia: number;
	custo_materias_primas: number;
	custo_depreciacao: number;
	custo_falhas: number;
	custo_total: number;
	quantidade: number;
	custo_unitario: number;
	salvo_em_modelo_id?: string | null;
}

async function gerarCodigo(): Promise<string> {
	const supabase = await createClient();
	const { data } = await supabase
		.from("modelo")
		.select("codigo")
		.like("codigo", "M%")
		.order("codigo", { ascending: false })
		.limit(1);
	if (!data || data.length === 0) return "M01";
	const last = data[0].codigo as string;
	const num = Number.parseInt(last.replace("M", ""), 10);
	return `M${String(num + 1).padStart(2, "0")}`;
}

export async function salvarPrecoKwh(precoKwh: number) {
	if (!Number.isFinite(precoKwh) || precoKwh <= 0)
		throw new Error("Preco kWh invalido");
	const supabase = await createClient();
	const { data: atual } = await supabase
		.from("config_energia")
		.select("id")
		.order("updated_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (atual?.id) {
		const { error } = await supabase
			.from("config_energia")
			.update({ preco_kwh: precoKwh, atualizado_em: new Date().toISOString() })
			.eq("id", atual.id);
		if (error) throw new Error(error.message);
	} else {
		const { error } = await supabase.from("config_energia").insert({
			preco_kwh: precoKwh,
			atualizado_em: new Date().toISOString(),
		});
		if (error) throw new Error(error.message);
	}

	revalidatePath("/calculadora");
	revalidatePath("/calculadora/config");
}

export async function salvarPctFalhas(pctFalhas: number) {
	if (!Number.isFinite(pctFalhas) || pctFalhas < 0 || pctFalhas > 100)
		throw new Error("Percentual de falhas inválido");
	const supabase = await createClient();
	const valor = pctFalhas / 100;
	const { data: atual } = await supabase
		.from("config_energia")
		.select("id")
		.order("updated_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (atual?.id) {
		const { error } = await supabase
			.from("config_energia")
			.update({ pct_falhas: valor, atualizado_em: new Date().toISOString() })
			.eq("id", atual.id);
		if (error) throw new Error(error.message);
	} else {
		const { error } = await supabase.from("config_energia").insert({
			preco_kwh: 0,
			pct_falhas: valor,
			atualizado_em: new Date().toISOString(),
		});
		if (error) throw new Error(error.message);
	}

	revalidatePath("/calculadora");
	revalidatePath("/calculadora/config");
}

export async function salvarEquipamento(input: {
	equipamento_id?: string;
	nome: string;
	potencia_kw: number;
	valor_maquina: number;
	tempo_meses: number;
	horas_por_dia: number;
	dias_por_mes: number;
}) {
	const supabase = await createClient();
	const horasTotais =
		input.horas_por_dia * input.dias_por_mes * input.tempo_meses;
	const depreciacao_hora =
		horasTotais > 0 ? input.valor_maquina / horasTotais : 0;
	const dados = {
		nome: input.nome,
		potencia_watts: input.potencia_kw * 1000,
		depreciacao_hora,
		valor_maquina: input.valor_maquina,
		tempo_meses: input.tempo_meses,
		horas_por_dia: input.horas_por_dia,
		dias_por_mes: input.dias_por_mes,
	};
	if (input.equipamento_id) {
		const { error } = await supabase
			.from("config_equipamento")
			.update(dados)
			.eq("equipamento_id", input.equipamento_id);
		if (error) throw new Error(error.message);
	} else {
		const { error } = await supabase.from("config_equipamento").insert({
			...dados,
			ativa: true,
		});
		if (error) throw new Error(error.message);
	}
	revalidatePath("/calculadora/config");
	revalidatePath("/calculadora");
}

export async function toggleEquipamento(equipamentoId: string, ativa: boolean) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("config_equipamento")
		.update({ ativa })
		.eq("equipamento_id", equipamentoId);
	if (error) throw new Error(error.message);
	revalidatePath("/calculadora/config");
	revalidatePath("/calculadora");
}

export async function salvarMateriaPrima(input: {
	materia_prima_id?: string;
	nome: string;
	preco_por_unidade: number;
	unidade_medida: "kg" | "litro" | "metro" | "unidade";
}) {
	const supabase = await createClient();
	if (input.materia_prima_id) {
		const { error } = await supabase
			.from("config_materia_prima")
			.update({
				nome: input.nome,
				preco_por_unidade: input.preco_por_unidade,
				unidade_medida: input.unidade_medida,
			})
			.eq("materia_prima_id", input.materia_prima_id);
		if (error) throw new Error(error.message);
	} else {
		const { error } = await supabase.from("config_materia_prima").insert({
			nome: input.nome,
			preco_por_unidade: input.preco_por_unidade,
			unidade_medida: input.unidade_medida,
			ativo: true,
		});
		if (error) throw new Error(error.message);
	}
	revalidatePath("/calculadora/config");
	revalidatePath("/calculadora");
}

export async function toggleMateriaPrima(
	materiaPrimaId: string,
	ativo: boolean
) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("config_materia_prima")
		.update({ ativo })
		.eq("materia_prima_id", materiaPrimaId);
	if (error) throw new Error(error.message);
	revalidatePath("/calculadora/config");
	revalidatePath("/calculadora");
}

export async function salvarCalculo(input: SalvarCalculoInput) {
	const supabase = await createClient();
	const { error } = await supabase.from("calculo_custo").insert({
		equipamento_id: input.equipamento_id,
		tempo_impressao_min: input.tempo_impressao_min,
		materias_primas: input.materias_primas,
		pct_falhas: input.pct_falhas,
		custo_energia: input.custo_energia,
		custo_materias_primas: input.custo_materias_primas,
		custo_depreciacao: input.custo_depreciacao,
		custo_falhas: input.custo_falhas,
		custo_total: input.custo_total,
		quantidade: input.quantidade,
		custo_unitario: input.custo_unitario,
		salvo_em_modelo_id: input.salvo_em_modelo_id ?? null,
	});
	if (error) throw new Error(error.message);
	revalidatePath("/calculadora");
}

export async function salvarComoNovoProduto(input: {
	nome: string;
	codigo?: string;
	descricao?: string;
	custo_producao: number;
}) {
	const supabase = await createClient();
	const codigo = input.codigo?.trim() || (await gerarCodigo());
	const { data, error } = await supabase
		.from("modelo")
		.insert({
			nome: input.nome,
			codigo,
			descricao: input.descricao ?? null,
			custo_producao: input.custo_producao,
			estoque_minimo: 0,
			ativo: true,
		})
		.select("modelo_id")
		.single();
	if (error) throw new Error(error.message);
	revalidatePath("/produtos");
	return { modelo_id: data.modelo_id as string };
}

export async function atualizarCustoProduto(
	modeloId: string,
	custoProducao: number
) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("modelo")
		.update({ custo_producao: custoProducao })
		.eq("modelo_id", modeloId);
	if (error) throw new Error(error.message);
	revalidatePath("/produtos");
}

export async function salvarCustoExtra(input: {
	custo_extra_id?: string;
	nome: string;
	valor: number;
}) {
	const supabase = await createClient();
	if (input.custo_extra_id) {
		const { error } = await supabase
			.from("config_custo_extra")
			.update({ nome: input.nome, valor: input.valor })
			.eq("custo_extra_id", input.custo_extra_id);
		if (error) throw new Error(error.message);
	} else {
		const { error } = await supabase.from("config_custo_extra").insert({
			nome: input.nome,
			valor: input.valor,
			ativo: true,
		});
		if (error) throw new Error(error.message);
	}
	revalidatePath("/calculadora/config");
	revalidatePath("/calculadora");
}

export async function toggleCustoExtra(custoExtraId: string, ativo: boolean) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("config_custo_extra")
		.update({ ativo })
		.eq("custo_extra_id", custoExtraId);
	if (error) throw new Error(error.message);
	revalidatePath("/calculadora/config");
	revalidatePath("/calculadora");
}
