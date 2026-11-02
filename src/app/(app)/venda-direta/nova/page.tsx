import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buscarEstoqueCalculado } from "@/lib/queries/estoque";
import { Button } from "@/components/ui";
import NovaVendaDiretaForm, {
	type ProdutoDisponivel,
} from "./NovaVendaDiretaForm";
import type { ConfigCalculadora } from "./CustoCalculadoraInline";

export default async function NovaVendaDiretaPage() {
	const supabase = await createClient();

	const [
		estoque,
		{ data: produtos },
		{ data: equipamentos },
		{ data: materias },
		{ data: energiaConfig },
	] = await Promise.all([
		buscarEstoqueCalculado(),
		supabase
			.from("modelo")
			.select("modelo_id, codigo, nome")
			.eq("ativo", true)
			.is("deleted_at", null)
			.order("nome"),
		supabase
			.from("config_equipamento")
			.select("equipamento_id, nome, potencia_watts, depreciacao_hora")
			.eq("ativa", true)
			.is("deleted_at", null),
		supabase
			.from("config_materia_prima")
			.select("materia_prima_id, nome, preco_por_unidade, unidade_medida")
			.eq("ativo", true)
			.is("deleted_at", null),
		supabase
			.from("config_energia")
			.select("preco_kwh, pct_falhas")
			.order("atualizado_em", { ascending: false })
			.limit(1)
			.maybeSingle(),
	]);

	const estoqueMap = new Map(estoque.map(e => [e.modelo_id, e.disponivel]));

	const produtosDisponiveis: ProdutoDisponivel[] = (produtos ?? []).map(p => ({
		modelo_id: p.modelo_id as string,
		codigo: (p.codigo as string | null) ?? null,
		nome: p.nome as string,
		estoque_disponivel: estoqueMap.get(p.modelo_id as string) ?? 0,
	}));

	const configCalculadora: ConfigCalculadora = {
		equipamentos: (equipamentos ?? []).map(e => ({
			equipamento_id: e.equipamento_id as string,
			nome: e.nome as string,
			potencia_watts: e.potencia_watts as number,
			depreciacao_hora: e.depreciacao_hora as number,
		})),
		materias: (materias ?? []).map(m => ({
			materia_prima_id: m.materia_prima_id as string,
			nome: m.nome as string,
			preco_por_unidade: m.preco_por_unidade as number,
			unidade_medida: m.unidade_medida as string,
		})),
		preco_kwh: (energiaConfig?.preco_kwh as number | null) ?? 0,
		pct_falhas_padrao: (energiaConfig?.pct_falhas as number | null) ?? 0,
	};

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">Nova venda</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						Registre itens, canal e pagamento em um fluxo rapido mobile-first.
					</p>
				</div>
				<Link href="/venda-direta">
					<Button variant="secondary" size="sm">
						Voltar
					</Button>
				</Link>
			</div>

			<NovaVendaDiretaForm produtos={produtosDisponiveis} configCalculadora={configCalculadora} />
		</div>
	);
}
