/**
 * Carregamento dos movimentos de estoque.
 *
 * Separa I/O de cálculo: aqui ficam as queries, e a aritmética fica em
 * `@/modules/estoque/calcular` (puro e testado). Todo lugar que precisa saber
 * o disponível de um produto passa por aqui — antes eram 5 implementações
 * divergentes, e a de dentro de `criarEnvio` esquecia as vendas diretas.
 */
import { createClient } from "@/lib/supabase/server";
import {
	calcularDisponivelPorModelo,
	calcularEstoque,
	type EnvioItemEstoque,
	type EnvioStatus,
	type EstoqueCalculadoRow,
	type ProducaoEstoque,
	type VendaDiretaItemEstoque,
} from "@/modules/estoque/calcular";

interface Movimentos {
	producoes: ProducaoEstoque[];
	envioItens: EnvioItemEstoque[];
	vendaDiretaItens: VendaDiretaItemEstoque[];
}

/** Junções to-one do Supabase às vezes chegam como array de um elemento. */
function umDe<T>(v: T | T[] | null | undefined): T | null {
	if (v == null) return null;
	return Array.isArray(v) ? (v[0] ?? null) : v;
}

const STATUS_VALIDOS: readonly string[] = ["ABERTO", "CONFERIDO", "ENCERRADO"];

/**
 * Carrega produções, itens de envio e itens de venda direta.
 * Passe `modeloIds` para restringir — sem isso, varre tudo.
 */
async function carregarMovimentos(modeloIds?: string[]): Promise<Movimentos> {
	const supabase = await createClient();
	const filtrar = modeloIds != null && modeloIds.length > 0;

	let qProducao = supabase
		.from("producao")
		.select("modelo_id, quantidade")
		.is("deleted_at", null);

	let qEnvioItem = supabase
		.from("envio_item")
		.select(
			"modelo_id, qtd_enviada, qtd_vendida, qtd_devolvida, envio:envio_id(status)"
		)
		.is("deleted_at", null)
		.not("envio", "is", null);

	let qVendaItem = supabase
		.from("venda_direta_item")
		.select("modelo_id, quantidade, venda:venda_id(deleted_at)")
		.not("venda", "is", null);

	if (filtrar) {
		qProducao = qProducao.in("modelo_id", modeloIds);
		qEnvioItem = qEnvioItem.in("modelo_id", modeloIds);
		qVendaItem = qVendaItem.in("modelo_id", modeloIds);
	}

	const [{ data: producoes }, { data: envioItens }, { data: vendaItens }] =
		await Promise.all([qProducao, qEnvioItem, qVendaItem]);

	const producoesOut: ProducaoEstoque[] = (producoes ?? []).map(p => ({
		modelo_id: p.modelo_id as string,
		quantidade: p.quantidade as number | null,
	}));

	const envioItensOut: EnvioItemEstoque[] = [];
	for (const item of envioItens ?? []) {
		const envio = umDe(item.envio as unknown as { status: string } | null);
		const status = envio?.status;
		// Itens de envio sem status conhecido não movimentam estoque.
		if (!status || !STATUS_VALIDOS.includes(status)) continue;
		envioItensOut.push({
			modelo_id: item.modelo_id as string,
			qtd_enviada: item.qtd_enviada as number | null,
			qtd_vendida: item.qtd_vendida as number | null,
			qtd_devolvida: item.qtd_devolvida as number | null,
			envio_status: status as EnvioStatus,
		});
	}

	const vendaDiretaItensOut: VendaDiretaItemEstoque[] = [];
	for (const v of vendaItens ?? []) {
		const venda = umDe(v.venda as unknown as { deleted_at: string | null } | null);
		if (venda?.deleted_at) continue;
		// Item livre (sem modelo cadastrado) não movimenta estoque.
		if (!v.modelo_id) continue;
		vendaDiretaItensOut.push({
			modelo_id: v.modelo_id as string,
			quantidade: v.quantidade as number | null,
		});
	}

	return {
		producoes: producoesOut,
		envioItens: envioItensOut,
		vendaDiretaItens: vendaDiretaItensOut,
	};
}

/** Linha completa de estoque para todos os produtos ativos. */
export async function buscarEstoqueCalculado(): Promise<EstoqueCalculadoRow[]> {
	const supabase = await createClient();

	const [{ data: modelos }, movimentos] = await Promise.all([
		supabase
			.from("modelo")
			.select("modelo_id, codigo, nome, estoque_minimo")
			.is("deleted_at", null)
			.order("nome"),
		carregarMovimentos(),
	]);

	return calcularEstoque({
		modelos: (modelos ?? []).map(m => ({
			modelo_id: m.modelo_id as string,
			codigo: m.codigo as string | null,
			nome: m.nome as string,
			estoque_minimo: m.estoque_minimo as number | null,
		})),
		...movimentos,
	});
}

/**
 * Só o disponível por modelo, para validações — bem mais leve que a linha
 * completa porque não carrega o cadastro de produtos.
 */
export async function buscarDisponivelPorModelo(
	modeloIds: string[]
): Promise<Map<string, number>> {
	if (modeloIds.length === 0) return new Map();
	const movimentos = await carregarMovimentos(modeloIds);
	return calcularDisponivelPorModelo(movimentos);
}
