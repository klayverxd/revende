/**
 * A tela "Hoje" — o que fazer agora.
 *
 * Puramente derivada: nenhuma tabela nova. Junta o que hoje exige abrir 5
 * telas diferentes (esteira, envios, conferências, estoque) numa lista só,
 * ordenada por urgência.
 */
import { hojeISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { exigirSemErro } from "@/lib/queries/erro";
import { buscarCardsEsteira, type CardEsteira } from "@/lib/queries/esteira";
import { buscarEstoqueCalculado } from "@/lib/queries/estoque";
import {
	STATUS_A_ENTREGAR,
	situacaoPrazo,
} from "@/modules/pedido/status";
import type { EstoqueCalculadoRow } from "@/modules/estoque/calcular";

export interface EnvioVencido {
	envio_id: string;
	revendedor_id: string;
	revendedor_nome: string;
	data_envio: string;
	dias: number;
	unidades: number;
}

export interface PainelHoje {
	hoje: string;
	atrasados: CardEsteira[];
	paraHoje: CardEsteira[];
	aImprimir: CardEsteira[];
	acabamento: CardEsteira[];
	aEntregar: CardEsteira[];
	enviosVencidos: EnvioVencido[];
	estoqueCritico: EstoqueCalculadoRow[];
	/** Verdadeiro quando não há nada pendente em nenhuma seção. */
	tudoEmDia: boolean;
}

/** Dias entre duas datas `YYYY-MM-DD`, sem construir Date local. */
function diasCorridos(de: string, ate: string): number {
	const a = Date.parse(`${de.slice(0, 10)}T00:00:00Z`);
	const b = Date.parse(`${ate.slice(0, 10)}T00:00:00Z`);
	if (Number.isNaN(a) || Number.isNaN(b)) return 0;
	return Math.round((b - a) / 86_400_000);
}

export async function buscarPainelHoje(
	{ diasEnvioAberto = 21 }: { diasEnvioAberto?: number } = {}
): Promise<PainelHoje> {
	const hoje = hojeISO();
	const supabase = await createClient();

	const [cards, estoque, { data: enviosAbertos, error: erroEnvios }] =
		await Promise.all([
		buscarCardsEsteira({ limiteFinalizados: 0 }),
		buscarEstoqueCalculado(),
		supabase
			.from("envio")
			.select(
				`envio_id, data_envio, revendedor_id,
				 revendedor:revendedor_id(nome),
				 itens:envio_item(qtd_enviada, qtd_vendida, qtd_devolvida)`
			)
			.eq("status", "ABERTO")
			.is("deleted_at", null)
			.order("data_envio", { ascending: true }),
	]);

	exigirSemErro(erroEnvios, "Não foi possível carregar os envios em aberto");

	const ativos = cards.filter(
		c => c.status !== "ENTREGUE" && c.status !== "CANCELADO"
	);

	const porPrazo = (c: CardEsteira) =>
		situacaoPrazo(c.data_prazo, hoje, {
			prazoConcluido: c.prazo_concluido,
			status: c.status,
		});

	// Atraso vem primeiro na tela, e dentro dele o mais antigo primeiro.
	const atrasados = ativos
		.filter(c => porPrazo(c) === "ATRASADO")
		.sort((a, b) => (a.data_prazo ?? "").localeCompare(b.data_prazo ?? ""));

	const paraHoje = ativos.filter(c => porPrazo(c) === "HOJE");

	// Ideia e orçamento não são trabalho ainda: ficam fora das filas de fazer.
	const emFila = ativos.filter(
		c => c.status !== "IDEIA" && c.status !== "ORCAMENTO"
	);

	const ordenarPorPrazo = (a: CardEsteira, b: CardEsteira) => {
		// Sem prazo vai para o fim, não para o começo.
		const pa = a.data_prazo ?? "9999-12-31";
		const pb = b.data_prazo ?? "9999-12-31";
		return pa.localeCompare(pb);
	};

	const aImprimir = emFila
		.filter(
			c =>
				c.status === "NOVO" ||
				c.status === "EM_MODELAGEM" ||
				c.status === "AGUARDANDO_IMPRESSAO" ||
				c.status === "IMPRIMINDO"
		)
		.sort(ordenarPorPrazo);

	const acabamento = emFila
		.filter(c => c.status === "EM_ACABAMENTO" || c.status === "MIDIA")
		.sort(ordenarPorPrazo);

	const aEntregar = emFila
		.filter(c => STATUS_A_ENTREGAR.includes(c.status))
		.sort(ordenarPorPrazo);

	const enviosVencidos: EnvioVencido[] = [];
	for (const e of enviosAbertos ?? []) {
		const dias = diasCorridos(e.data_envio as string, hoje);
		if (dias < diasEnvioAberto) continue;

		const itens = (e.itens ?? []) as Array<{
			qtd_enviada: number | null;
			qtd_vendida: number | null;
			qtd_devolvida: number | null;
		}>;
		const unidades = itens.reduce(
			(soma, i) =>
				soma +
				Math.max(
					0,
					(i.qtd_enviada ?? 0) - (i.qtd_vendida ?? 0) - (i.qtd_devolvida ?? 0)
				),
			0
		);
		if (unidades === 0) continue;

		const rev = e.revendedor as unknown as { nome: string } | null;
		enviosVencidos.push({
			envio_id: e.envio_id as string,
			revendedor_id: e.revendedor_id as string,
			revendedor_nome:
				(Array.isArray(rev) ? rev[0]?.nome : rev?.nome) ?? "Revendedor",
			data_envio: e.data_envio as string,
			dias,
			unidades,
		});
	}
	enviosVencidos.sort((a, b) => b.dias - a.dias);

	const estoqueCritico = estoque
		.filter(e => e.status === "SEM_ESTOQUE" || e.status === "REPOR")
		.sort((a, b) => a.disponivel - b.disponivel)
		.slice(0, 8);

	return {
		hoje,
		atrasados,
		paraHoje,
		aImprimir,
		acabamento,
		aEntregar,
		enviosVencidos,
		estoqueCritico,
		tudoEmDia:
			atrasados.length === 0 &&
			paraHoje.length === 0 &&
			aImprimir.length === 0 &&
			acabamento.length === 0 &&
			aEntregar.length === 0 &&
			enviosVencidos.length === 0 &&
			estoqueCritico.length === 0,
	};
}
