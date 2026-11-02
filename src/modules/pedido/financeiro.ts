/**
 * Receita, custo e lucro de um pedido.
 *
 * A conta estava duplicada em `buscarPedidos` e `buscarDashboardPedidos`, e é
 * a mesma que o card da esteira precisa mostrar. Puro: recebe as linhas já
 * carregadas e devolve números.
 */

import { arredondar } from "@/lib/format";

export interface ItemFinanceiro {
	quantidade: number | null;
	preco_venda_unit: number | null;
	custo_unit: number | null;
}

export interface EncargosPedido {
	desconto_valor: number | null;
	taxa_marketplace_pct: number | null;
	custo_envio: number | null;
	outros_encargos: number | null;
}

export interface FinanceiroPedido {
	subtotal: number;
	desconto: number;
	receita: number;
	custoProducao: number;
	taxaCanal: number;
	custoEnvio: number;
	outrosEncargos: number;
	custoTotal: number;
	lucro: number;
	margemPct: number;
	/**
	 * `false` quando nenhum custo foi informado. Nesse caso o lucro é apenas a
	 * receita, o que seria enganoso mostrar como lucro — as telas exibem "—".
	 */
	temCustos: boolean;
}

const n = (v: number | null | undefined): number =>
	v != null && Number.isFinite(v) ? v : 0;

export function calcularFinanceiroPedido(
	encargos: EncargosPedido,
	itens: readonly ItemFinanceiro[]
): FinanceiroPedido {
	const subtotal = itens.reduce(
		(soma, i) => soma + n(i.preco_venda_unit) * (n(i.quantidade) || 1),
		0
	);
	const desconto = n(encargos.desconto_valor);
	const receita = Math.max(0, subtotal - desconto);

	const custoProducao = itens.reduce(
		(soma, i) => soma + n(i.custo_unit) * (n(i.quantidade) || 1),
		0
	);
	const taxaPct = n(encargos.taxa_marketplace_pct);
	// A taxa do marketplace incide sobre o que o cliente paga, ou seja sobre a
	// receita já com desconto — não sobre o subtotal.
	const taxaCanal = (receita * taxaPct) / 100;
	const custoEnvio = n(encargos.custo_envio);
	const outrosEncargos = n(encargos.outros_encargos);

	const custoTotal = custoProducao + taxaCanal + custoEnvio + outrosEncargos;
	const lucro = receita - custoTotal;

	return {
		subtotal: arredondar(subtotal, 2),
		desconto: arredondar(desconto, 2),
		receita: arredondar(receita, 2),
		custoProducao: arredondar(custoProducao, 2),
		taxaCanal: arredondar(taxaCanal, 2),
		custoEnvio: arredondar(custoEnvio, 2),
		outrosEncargos: arredondar(outrosEncargos, 2),
		custoTotal: arredondar(custoTotal, 2),
		lucro: arredondar(lucro, 2),
		margemPct: receita > 0 ? arredondar((lucro / receita) * 100, 1) : 0,
		temCustos:
			custoProducao > 0 || taxaPct > 0 || custoEnvio > 0 || outrosEncargos > 0,
	};
}

/** Soma o financeiro de vários pedidos, para painéis e totais de coluna. */
export function somarFinanceiro(
	pedidos: readonly FinanceiroPedido[]
): { receita: number; custoTotal: number; lucro: number; temCustos: boolean } {
	let receita = 0;
	let custoTotal = 0;
	let temCustos = false;

	for (const p of pedidos) {
		receita += p.receita;
		custoTotal += p.custoTotal;
		if (p.temCustos) temCustos = true;
	}

	return {
		receita: arredondar(receita, 2),
		custoTotal: arredondar(custoTotal, 2),
		lucro: arredondar(receita - custoTotal, 2),
		temCustos,
	};
}
