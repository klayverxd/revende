import { createClient } from "@/lib/supabase/server";
import { buscarEstoque } from "@/app/(app)/estoque/actions";
import ProdutosTable, { type ProdutoRow } from "./ProdutosTable";

export default async function ProdutosPage() {
	const supabase = await createClient();

	// Fetch modelos ativos com preços e estoque
	const [{ data: modelos }, { data: precos }, estoque] = await Promise.all([
		supabase
			.from("modelo")
			.select("modelo_id, codigo, nome, custo_producao, estoque_minimo, ativo")
			.is("deleted_at", null)
			.order("nome"),
		supabase
			.from("modelo_preco")
			.select("modelo_id, quantidade_minima, preco, rotulo")
			.eq("ativo", true)
			.is("deleted_at", null),
		buscarEstoque(),
	]);

	// Calcula estoque disponível por modelo
	const estoqueMap: Record<string, number> = {};
	for (const row of estoque) {
		estoqueMap[row.modelo_id] = row.disponivel;
	}

	// Resolve preços por modelo
	const precoMap: Record<string, number | null> = {};
	const atacadoMap: Record<string, { preco: number; qtd: number } | null> = {};
	for (const p of precos ?? []) {
		if (p.quantidade_minima === 1) {
			precoMap[p.modelo_id] = p.preco;
		} else if (p.rotulo === "Atacado") {
			atacadoMap[p.modelo_id] = { preco: p.preco, qtd: p.quantidade_minima };
		}
	}

	const rows: ProdutoRow[] = (modelos ?? []).map(m => ({
		modelo_id: m.modelo_id,
		codigo: m.codigo,
		nome: m.nome,
		custo_producao: m.custo_producao,
		estoque_minimo: m.estoque_minimo ?? 0,
		ativo: m.ativo,
		preco_1un: precoMap[m.modelo_id] ?? null,
		preco_atacado: atacadoMap[m.modelo_id]?.preco ?? null,
		qtd_atacado: atacadoMap[m.modelo_id]?.qtd ?? null,
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
