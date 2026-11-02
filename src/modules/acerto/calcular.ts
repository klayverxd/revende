/**
 * Cálculo de acerto financeiro por envio.
 *
 * Os dois modelos convivem porque ambos são usados na prática:
 *
 * - `COMISSAO`     — você define o preço de venda; o revendedor fica com
 *                    `comissao_fixa + valor_total × comissao_pct`.
 * - `VALOR_MINIMO` — você cobra um valor fixo por unidade vendida; o que o
 *                    revendedor cobra do cliente final não te afeta.
 *
 * Antes desta extração a lógica estava inline em `conferencias/actions.ts` e
 * duplicada nos testes. Puro: nada de Supabase.
 */

import { arredondar } from "@/lib/format";

export type ModeloAcerto = "COMISSAO" | "VALOR_MINIMO";

export interface AcertoComissao {
	comissaoCalculada: number;
	valorLiquido: number;
}

/** Valor da venda de `qtdVendida` unidades ao preço unitário do snapshot. */
export function precoPorFaixa(
	qtdVendida: number,
	precoUnitario: number | null | undefined
): number {
	if (qtdVendida <= 0) return 0;
	return qtdVendida * (precoUnitario ?? 0);
}

/**
 * Modelo COMISSAO.
 *
 * `comissaoPct` é **fração** (0,3 = 30%), como está gravado no banco —
 * as telas convertem de/para pontos percentuais na borda.
 */
export function calcularAcertoComissao(
	valorTotalVenda: number,
	comissaoFixa: number,
	comissaoPct: number
): AcertoComissao {
	const comissaoCalculada = comissaoFixa + valorTotalVenda * comissaoPct;
	return {
		comissaoCalculada,
		valorLiquido: valorTotalVenda - comissaoCalculada,
	};
}

/** Modelo VALOR_MINIMO. */
export function calcularAcertoValorMinimo(
	qtdVendida: number,
	valorMinimoUnit: number
): number {
	if (qtdVendida <= 0) return 0;
	return qtdVendida * valorMinimoUnit;
}

/**
 * Redistribui um valor total informado à mão entre os itens, proporcionalmente
 * ao valor calculado de cada um. O último item absorve a diferença de
 * arredondamento, para que a soma feche exatamente com `manual`.
 *
 * Quando o total calculado é zero não há proporção possível: o valor inteiro
 * vai para o primeiro item.
 */
export function ratearValorManual(
	valoresCalculados: number[],
	manual: number
): number[] {
	if (valoresCalculados.length === 0) return [];

	const alvo = arredondar(Math.max(0, manual), 2);
	const total = valoresCalculados.reduce((s, v) => s + v, 0);

	if (total <= 0) {
		return valoresCalculados.map((_, i) => (i === 0 ? alvo : 0));
	}

	const fator = alvo / total;
	const out: number[] = [];
	let distribuido = 0;

	for (let i = 0; i < valoresCalculados.length - 1; i++) {
		const v = arredondar(valoresCalculados[i] * fator, 2);
		out.push(v);
		distribuido = arredondar(distribuido + v, 2);
	}
	out.push(arredondar(alvo - distribuido, 2));

	return out;
}

/**
 * Quanto ainda resta a conferir num item: o que foi enviado menos o que já
 * foi vendido ou devolvido em conferências anteriores.
 */
export function qtdRestanteItem(item: {
	qtd_enviada: number | null;
	qtd_vendida: number | null;
	qtd_devolvida: number | null;
}): number {
	const enviada = item.qtd_enviada ?? 0;
	const vendida = item.qtd_vendida ?? 0;
	const devolvida = item.qtd_devolvida ?? 0;
	return Math.max(0, enviada - vendida - devolvida);
}
