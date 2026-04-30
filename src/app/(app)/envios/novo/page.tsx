import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import NovoEnvioStepper, {
	type ProdutoDisponivel,
	type RevendedorAtivo,
} from "./NovoEnvioStepper";

export default async function NovoEnvioPage() {
	const supabase = await createClient();

	const [
		{ data: revendedores },
		{ data: produtos },
		{ data: producoes },
		{ data: envioItens },
	] = await Promise.all([
		supabase
			.from("revendedor")
			.select("revendedor_id, nome, modelo_acerto")
			.eq("ativo", true)
			.is("deleted_at", null)
			.order("nome"),
		supabase
			.from("modelo")
			.select("modelo_id, codigo, nome")
			.eq("ativo", true)
			.is("deleted_at", null)
			.order("nome"),
		supabase
			.from("producao")
			.select("modelo_id, quantidade")
			.is("deleted_at", null),
		supabase
			.from("envio_item")
			.select("modelo_id, qtd_enviada, qtd_vendida, envio:envio_id(status)")
			.is("deleted_at", null)
			.not("envio", "is", null),
	]);

	const estoqueMap = new Map<string, number>();
	for (const p of producoes ?? []) {
		estoqueMap.set(
			p.modelo_id as string,
			(estoqueMap.get(p.modelo_id as string) ?? 0) +
				((p.quantidade as number) ?? 0)
		);
	}
	for (const item of envioItens ?? []) {
		const envio = item.envio as unknown as { status: string } | null;
		if (!envio) continue;
		const modeloId = item.modelo_id as string;
		if (envio.status === "ABERTO") {
			estoqueMap.set(
				modeloId,
				(estoqueMap.get(modeloId) ?? 0) - ((item.qtd_enviada as number) ?? 0)
			);
		} else if (envio.status === "CONFERIDO" || envio.status === "ENCERRADO") {
			estoqueMap.set(
				modeloId,
				(estoqueMap.get(modeloId) ?? 0) -
					((item.qtd_vendida as number | null) ?? 0)
			);
		}
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
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">Novo envio</h1>
					<p className="text-sm text-gray-500 mt-0.5">
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
