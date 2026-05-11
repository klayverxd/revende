import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import { buscarEstoque } from "@/app/(app)/estoque/actions";
import NovoEnvioStepper, {
	type ProdutoDisponivel,
	type RevendedorAtivo,
} from "./NovoEnvioStepper";

export default async function NovoEnvioPage() {
	const supabase = await createClient();

	const [{ data: revendedores }, { data: produtos }, estoque] =
		await Promise.all([
			supabase
				.from("revendedor")
				.select("revendedor_id, nome, modelo_acerto")
				.eq("ativo", true)
				.is("deleted_at", null)
				.order("nome"),
			supabase
				.from("modelo")
				.select("modelo_id, codigo, nome, custo_producao")
				.eq("ativo", true)
				.is("deleted_at", null)
				.order("nome"),
			buscarEstoque(),
		]);

	const estoqueMap = new Map<string, number>();
	for (const row of estoque) {
		estoqueMap.set(row.modelo_id, row.disponivel);
	}

	const revendedoresAtivos: RevendedorAtivo[] = (revendedores ?? []).map(r => ({
		revendedor_id: r.revendedor_id as string,
		nome: r.nome as string,
		modelo_acerto: r.modelo_acerto as "COMISSAO" | "VALOR_MINIMO",
	}));

	const produtosDisponiveis: ProdutoDisponivel[] = (produtos ?? []).map(p => ({
		modelo_id: p.modelo_id as string,
		codigo: (p.codigo as string | null) ?? null,
		nome: p.nome as string,
		estoque_disponivel: estoqueMap.get(p.modelo_id as string) ?? 0,
		custo_producao: (p.custo_producao as number | null) ?? null,
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">Novo envio</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						Fluxo em 3 passos para enviar itens com precificacao automatica.
					</p>
				</div>
				<Link href="/envios">
					<Button variant="secondary" size="sm">
						Voltar
					</Button>
				</Link>
			</div>

			<NovoEnvioStepper
				revendedores={revendedoresAtivos}
				produtos={produtosDisponiveis}
			/>
		</div>
	);
}
