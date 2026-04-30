import { createClient } from "@/lib/supabase/server";
import ProdutosTable, { type ProdutoRow } from "./ProdutosTable";

export default async function ProdutosPage() {
	const supabase = await createClient();

	// Fetch modelos ativos com preços e estoque
	const [
		{ data: modelos },
		{ data: precos },
		{ data: producoes },
		{ data: envioItens },
	] = await Promise.all([
		supabase
			.from("modelo")
			.select("modelo_id, codigo, nome, custo_producao, estoque_minimo, ativo")
			.is("deleted_at", null)
			.order("nome"),
		supabase
			.from("modelo_preco")
			.select("modelo_id, quantidade_minima, preco")
			.eq("ativo", true),
		supabase.from("producao").select("modelo_id, quantidade"),
		supabase
			.from("envio_item")
			.select("modelo_id, qtd_enviada, qtd_vendida, envio:envio_id(status)")
			.not("envio", "is", null),
	]);

	// Calcula estoque disponível por modelo
	const estoqueMap: Record<string, number> = {};

	for (const p of producoes ?? []) {
		estoqueMap[p.modelo_id] = (estoqueMap[p.modelo_id] ?? 0) + p.quantidade;
	}

	for (const item of envioItens ?? []) {
		const envio = item.envio as unknown as { status: string } | null;
		if (!envio) continue;
		if (envio.status === "ABERTO") {
			estoqueMap[item.modelo_id] =
				(estoqueMap[item.modelo_id] ?? 0) - item.qtd_enviada;
		} else if (envio.status === "CONFERIDO" || envio.status === "ENCERRADO") {
			estoqueMap[item.modelo_id] =
				(estoqueMap[item.modelo_id] ?? 0) - (item.qtd_vendida ?? 0);
		}
	}

	// Resolve preço 1un e 2+ por modelo (menor qtd_minima e segunda faixa)
	const precoMap: Record<
		string,
		{ preco_1un: number | null; preco_2mais: number | null }
	> = {};

	for (const p of precos ?? []) {
		const id = p.modelo_id;
		if (!precoMap[id]) precoMap[id] = { preco_1un: null, preco_2mais: null };

		if (p.quantidade_minima === 1) {
			precoMap[id].preco_1un = p.preco;
		} else if (p.quantidade_minima === 2) {
			precoMap[id].preco_2mais = p.preco;
		}
	}

	const rows: ProdutoRow[] = (modelos ?? []).map(m => ({
		modelo_id: m.modelo_id,
		codigo: m.codigo,
		nome: m.nome,
		custo_producao: m.custo_producao,
		estoque_minimo: m.estoque_minimo ?? 0,
		ativo: m.ativo,
		preco_1un: precoMap[m.modelo_id]?.preco_1un ?? null,
		preco_2mais: precoMap[m.modelo_id]?.preco_2mais ?? null,
		estoque_disponivel: estoqueMap[m.modelo_id] ?? 0,
	}));

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-xl font-semibold text-gray-900">Produtos</h1>
				<p className="text-sm text-gray-500 mt-0.5">
					Gerencie os modelos de produtos e seus preços.
				</p>
			</div>
			<ProdutosTable produtos={rows} />
		</div>
	);
}
