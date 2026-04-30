import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import NovaVendaDiretaForm, {
	type ProdutoDisponivel,
} from "./NovaVendaDiretaForm";

export default async function NovaVendaDiretaPage() {
	const supabase = await createClient();

	const [
		{ data: produtos },
		{ data: producoes },
		{ data: envioItens },
		{ data: vendasDiretas },
	] = await Promise.all([
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
		supabase
			.from("venda_direta_item")
			.select("modelo_id, quantidade, venda:venda_id(deleted_at)")
			.not("venda", "is", null),
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
		}
		if (envio.status === "CONFERIDO" || envio.status === "ENCERRADO") {
			estoqueMap.set(
				modeloId,
				(estoqueMap.get(modeloId) ?? 0) -
					((item.qtd_vendida as number | null) ?? 0)
			);
		}
	}

	for (const v of vendasDiretas ?? []) {
		const venda = v.venda as unknown as { deleted_at: string | null } | null;
		if (venda?.deleted_at) continue;
		const modeloId = v.modelo_id as string;
		estoqueMap.set(
			modeloId,
			(estoqueMap.get(modeloId) ?? 0) - ((v.quantidade as number | null) ?? 0)
		);
	}

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

			<NovaVendaDiretaForm produtos={produtosDisponiveis} />
		</div>
	);
}
