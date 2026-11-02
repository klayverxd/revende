"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { arredondar } from "@/lib/format";
import { statusAposRecebimento } from "@/modules/envio/fechamento";

// ── Types ────────────────────────────────────────────────────────────────────

export type AcertoPendenteCard = {
	revendedor_id: string;
	revendedor_nome: string;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
	total_pendente: number;
	mais_antigo: string;
	acertos: Array<{
		acerto_id: string;
		envio_id: string;
		valor_calculado: number;
		valor_a_receber: number | null;
		valor_liquido: number | null;
		comissao_calculada: number | null;
		created_at: string;
	}>;
};

export type AcertoHistoricoRow = {
	acerto_id: string;
	envio_id: string | null;
	data_recebimento: string | null;
	revendedor_nome: string;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
	valor: number;
	observacao: string | null;
};

export type GraficoMes = {
	label: string;
	pedidos: number;
	acertos: number;
	custo: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcReceitaCusto(p: {
	desconto_valor: unknown;
	taxa_marketplace_pct: unknown;
	custo_envio: unknown;
	outros_encargos: unknown;
	pedido_item: Array<{ preco_venda_unit: number | null; custo_unit: number | null; quantidade: number }>;
}) {
	const itens = p.pedido_item ?? [];
	const subtotal = itens.reduce((s, i) => s + (i.preco_venda_unit ?? 0) * (i.quantidade ?? 1), 0);
	const desconto = (p.desconto_valor as number | null) ?? 0;
	const receita = Math.max(0, subtotal - desconto);
	const ci = itens.reduce((s, i) => s + (i.custo_unit ?? 0) * (i.quantidade ?? 1), 0);
	const taxa = (p.taxa_marketplace_pct as number | null) ?? 0;
	const custo = ci + (receita * taxa) / 100 + ((p.custo_envio as number | null) ?? 0) + ((p.outros_encargos as number | null) ?? 0);
	return { receita, custo };
}

// ── Comissão ─────────────────────────────────────────────────────────────────

export async function buscarFinanceiroComissao() {
	const supabase = await createClient();

	const [{ data: pendRaw }, { data: histRaw }] = await Promise.all([
		supabase
			.from("acerto")
			.select("acerto_id, envio_id, modelo_acerto, valor_a_receber, valor_liquido, comissao_calculada, created_at, revendedor:revendedor_id(revendedor_id, nome)")
			.eq("status", "PENDENTE")
			.is("deleted_at", null)
			.order("created_at"),
		supabase
			.from("acerto")
			.select("acerto_id, envio_id, data_recebimento, modelo_acerto, valor_repassado, observacao, revendedor:revendedor_id(nome)")
			.eq("status", "RECEBIDO")
			.is("deleted_at", null)
			.order("data_recebimento", { ascending: false })
			.limit(100),
	]);

	const porRev = new Map<string, AcertoPendenteCard>();
	for (const a of pendRaw ?? []) {
		const rev = a.revendedor as unknown as { revendedor_id: string; nome: string };
		const modelo = a.modelo_acerto as "COMISSAO" | "VALOR_MINIMO";
		const valorCalculado = modelo === "VALOR_MINIMO"
			? ((a.valor_a_receber as number | null) ?? 0)
			: ((a.valor_liquido as number | null) ?? 0);
		if (!porRev.has(rev.revendedor_id)) {
			porRev.set(rev.revendedor_id, {
				revendedor_id: rev.revendedor_id,
				revendedor_nome: rev.nome,
				modelo_acerto: modelo,
				total_pendente: 0,
				mais_antigo: a.created_at as string,
				acertos: [],
			});
		}
		const card = porRev.get(rev.revendedor_id)!;
		card.total_pendente += valorCalculado;
		card.acertos.push({
			acerto_id: a.acerto_id as string,
			envio_id: a.envio_id as string,
			valor_calculado: valorCalculado,
			valor_a_receber: a.valor_a_receber as number | null,
			valor_liquido: a.valor_liquido as number | null,
			comissao_calculada: a.comissao_calculada as number | null,
			created_at: a.created_at as string,
		});
	}

	const historico: AcertoHistoricoRow[] = (histRaw ?? []).map(a => ({
		acerto_id: a.acerto_id as string,
		envio_id: a.envio_id as string | null,
		data_recebimento: a.data_recebimento as string | null,
		revendedor_nome: (a.revendedor as unknown as { nome: string }).nome,
		modelo_acerto: a.modelo_acerto as "COMISSAO" | "VALOR_MINIMO",
		valor: (a.valor_repassado as number | null) ?? 0,
		observacao: a.observacao as string | null,
	}));

	return { pendentes: [...porRev.values()], historico };
}

// ── Pedidos financeiro ───────────────────────────────────────────────────────

export type PedidoFinanceiroRow = {
	pedido_id: string;
	numero_pedido: string;
	cliente_nome: string | null;
	canal: string;
	status: string;
	data_pedido: string;
	receita: number;
	custo: number;
	lucro: number;
};

export async function buscarFinanceiroPedidos(ano: number, mes: number) {
	const supabase = await createClient();
	const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
	const fim = new Date(ano, mes, 0).toISOString().slice(0, 10);

	const { data: raw } = await supabase
		.from("pedido")
		.select("pedido_id, numero_pedido, cliente_nome, canal, status, data_pedido, desconto_valor, taxa_marketplace_pct, custo_envio, outros_encargos, pedido_item(preco_venda_unit, custo_unit, quantidade)")
		.gte("data_pedido", inicio)
		.lte("data_pedido", fim)
		.neq("status", "CANCELADO")
		.is("deleted_at", null)
		.order("data_pedido", { ascending: false });

	let receitaTotal = 0, custoTotal = 0;
	const porCanal = new Map<string, { count: number; receita: number }>();

	const pedidos: PedidoFinanceiroRow[] = (raw ?? []).map(p => {
		const { receita, custo } = calcReceitaCusto(p);
		receitaTotal += receita;
		custoTotal += custo;
		const canal = p.canal as string;
		const c = porCanal.get(canal) ?? { count: 0, receita: 0 };
		porCanal.set(canal, { count: c.count + 1, receita: c.receita + receita });
		return {
			pedido_id: p.pedido_id as string,
			numero_pedido: p.numero_pedido as string,
			cliente_nome: p.cliente_nome as string | null,
			canal,
			status: p.status as string,
			data_pedido: p.data_pedido as string,
			receita,
			custo,
			lucro: receita - custo,
		};
	});

	const lucroTotal = receitaTotal - custoTotal;
	return {
		receitaTotal,
		custoTotal,
		lucroTotal,
		margem: receitaTotal > 0 ? lucroTotal / receitaTotal : null,
		porCanal: [...porCanal.entries()]
			.map(([canal, v]) => ({ canal, ...v }))
			.sort((a, b) => b.receita - a.receita),
		pedidos,
		periodo: { ano, mes },
	};
}

// ── Geral (consolidado) ──────────────────────────────────────────────────────

export async function buscarFinanceiroGeral(ano: number, mes: number) {
	const supabase = await createClient();

	const MESES_LABEL = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
	const meses6 = Array.from({ length: 6 }, (_, i) => {
		const d = new Date(ano, mes - 1 - (5 - i), 1);
		return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
	});
	const rangeInicio = `${meses6[0].ano}-${String(meses6[0].mes).padStart(2, "0")}-01`;
	const rangeFim = new Date(ano, mes, 0).toISOString().slice(0, 10);
	const mesAtual = `${ano}-${String(mes).padStart(2, "0")}`;

	const [{ data: pedRaw }, { data: pendRaw }, { data: recRaw }] = await Promise.all([
		supabase
			.from("pedido")
			.select("data_pedido, desconto_valor, taxa_marketplace_pct, custo_envio, outros_encargos, pedido_item(preco_venda_unit, custo_unit, quantidade)")
			.gte("data_pedido", rangeInicio)
			.lte("data_pedido", rangeFim)
			.neq("status", "CANCELADO")
			.is("deleted_at", null),
		supabase
			.from("acerto")
			.select("modelo_acerto, valor_a_receber, valor_liquido")
			.eq("status", "PENDENTE")
			.is("deleted_at", null),
		supabase
			.from("acerto")
			.select("data_recebimento, valor_repassado")
			.eq("status", "RECEBIDO")
			.gte("data_recebimento", rangeInicio)
			.lte("data_recebimento", rangeFim)
			.is("deleted_at", null),
	]);

	const grafico: GraficoMes[] = meses6.map(({ ano: a, mes: m }) => ({
		label: `${MESES_LABEL[m - 1]}/${String(a).slice(2)}`,
		anoMes: `${a}-${String(m).padStart(2, "0")}`,
		pedidos: 0,
		acertos: 0,
		custo: 0,
	})) as GraficoMes[];

	let receitaMes = 0, custoMes = 0;
	for (const p of pedRaw ?? []) {
		const dm = (p.data_pedido as string).slice(0, 7);
		const { receita, custo } = calcReceitaCusto(p);
		const b = (grafico as Array<GraficoMes & { anoMes: string }>).find(g => g.anoMes === dm);
		if (b) { b.pedidos += receita; b.custo += custo; }
		if (dm === mesAtual) { receitaMes += receita; custoMes += custo; }
	}

	let receitaAcertos = 0;
	for (const a of recRaw ?? []) {
		const dm = (a.data_recebimento as string | null)?.slice(0, 7);
		const v = (a.valor_repassado as number | null) ?? 0;
		const b = (grafico as Array<GraficoMes & { anoMes: string }>).find(g => g.anoMes === dm);
		if (b) b.acertos += v;
		if (dm === mesAtual) receitaAcertos += v;
	}

	let totalPendente = 0;
	for (const a of pendRaw ?? []) {
		totalPendente += (a.modelo_acerto as string) === "VALOR_MINIMO"
			? ((a.valor_a_receber as number | null) ?? 0)
			: ((a.valor_liquido as number | null) ?? 0);
	}

	return {
		receitaPedidos: receitaMes,
		custoPedidos: custoMes,
		lucroPedidos: receitaMes - custoMes,
		receitaAcertos,
		acertosPendentes: (pendRaw ?? []).length,
		totalPendenteAcertos: totalPendente,
		receitaTotal: receitaMes + receitaAcertos,
		custoTotal: custoMes,
		grafico: grafico.map(({ label, pedidos, acertos, custo }) => ({ label, pedidos, acertos, custo })),
		periodo: { ano, mes },
	};
}

export async function registrarRecebimento(
	acertoId: string,
	valorRepassado: number,
	observacao?: string
) {
	if (!acertoId) throw new Error("Acerto invalido");
	if (!Number.isFinite(valorRepassado) || valorRepassado < 0) {
		throw new Error("Valor recebido invalido");
	}

	const supabase = await createClient();

	const { data: acerto, error: acertoError } = await supabase
		.from("acerto")
		.select("acerto_id, envio_id, status")
		.eq("acerto_id", acertoId)
		.is("deleted_at", null)
		.single();

	if (acertoError || !acerto) throw new Error("Acerto nao encontrado");
	if ((acerto.status as string) === "RECEBIDO") {
		throw new Error("Acerto ja recebido");
	}

	const { error: updateAcertoError } = await supabase
		.from("acerto")
		.update({
			status: "RECEBIDO",
			data_recebimento: new Date().toISOString().slice(0, 10),
			valor_repassado: arredondar(valorRepassado, 2),
			observacao: observacao?.trim() || null,
		})
		.eq("acerto_id", acertoId);

	if (updateAcertoError) throw new Error(updateAcertoError.message);

	const { data: envioItens, error: itensError } = await supabase
		.from("envio_item")
		.select("qtd_enviada, qtd_vendida, qtd_devolvida")
		.eq("envio_id", acerto.envio_id as string)
		.is("deleted_at", null);

	if (itensError) throw new Error(itensError.message);

	const proximoStatus = statusAposRecebimento(
		(envioItens ?? []).map(i => ({
			qtd_enviada: i.qtd_enviada as number | null,
			qtd_vendida: i.qtd_vendida as number | null,
			qtd_devolvida: i.qtd_devolvida as number | null,
		}))
	);

	const { error: updateEnvioError } = await supabase
		.from("envio")
		.update({ status: proximoStatus })
		.eq("envio_id", acerto.envio_id as string);

	if (updateEnvioError) throw new Error(updateEnvioError.message);

	revalidatePath("/financeiro");
	revalidatePath("/financeiro/fluxo");
	revalidatePath("/conferencias");
	revalidatePath("/envios");
	revalidatePath("/estoque");
	revalidatePath("/dashboard");
}
