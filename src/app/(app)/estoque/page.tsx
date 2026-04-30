import { createClient } from "@/lib/supabase/server";
import EstoqueView, {
	type ModeloOption,
	type MovimentoConsignacao,
	type MovimentoProducao,
	type RevendedorOption,
} from "./EstoqueView";
import { buscarEstoque } from "./actions";

export default async function EstoquePage() {
	const supabase = await createClient();

	const [
		estoque,
		{ data: modelosAtivos },
		{ data: producoesRaw },
		{ data: envioItensRaw },
		{ data: enviosRaw },
		{ data: revendedoresRaw },
	] = await Promise.all([
		buscarEstoque(),
		supabase
			.from("modelo")
			.select("modelo_id, nome, codigo, custo_producao")
			.eq("ativo", true)
			.is("deleted_at", null)
			.order("nome"),
		supabase
			.from("producao")
			.select(
				"producao_id, modelo_id, quantidade, custo_unitario, data_producao, observacao"
			)
			.is("deleted_at", null)
			.order("data_producao", { ascending: false }),
		supabase
			.from("envio_item")
			.select(
				"envio_item_id, envio_id, modelo_id, qtd_enviada, qtd_vendida, qtd_devolvida"
			)
			.is("deleted_at", null),
		supabase
			.from("envio")
			.select("envio_id, revendedor_id, data_envio, status")
			.is("deleted_at", null),
		supabase
			.from("revendedor")
			.select("revendedor_id, nome")
			.eq("ativo", true)
			.is("deleted_at", null)
			.order("nome"),
	]);

	const modelosMap = new Map<string, { nome: string; codigo: string | null }>();
	for (const m of estoque) {
		modelosMap.set(m.modelo_id, { nome: m.nome, codigo: m.codigo });
	}

	const enviosMap = new Map<
		string,
		{ revendedor_id: string; data_envio: string; status: string }
	>();
	for (const e of enviosRaw ?? []) {
		enviosMap.set(e.envio_id as string, {
			revendedor_id: e.revendedor_id as string,
			data_envio: e.data_envio as string,
			status: e.status as string,
		});
	}

	const revMap = new Map<string, string>();
	for (const r of revendedoresRaw ?? []) {
		revMap.set(r.revendedor_id as string, r.nome as string);
	}

	const modelos: ModeloOption[] = (modelosAtivos ?? []).map(m => ({
		modelo_id: m.modelo_id as string,
		nome: m.nome as string,
		codigo: (m.codigo as string | null) ?? null,
		custo_producao: (m.custo_producao as number | null) ?? null,
	}));

	const revendedores: RevendedorOption[] = (revendedoresRaw ?? []).map(r => ({
		revendedor_id: r.revendedor_id as string,
		nome: r.nome as string,
	}));

	const producoes: MovimentoProducao[] = (producoesRaw ?? []).map(p => ({
		producao_id: p.producao_id as string,
		modelo_id: p.modelo_id as string,
		quantidade: (p.quantidade as number) ?? 0,
		custo_unitario: (p.custo_unitario as number | null) ?? null,
		data_producao: p.data_producao as string,
		observacao: (p.observacao as string | null) ?? null,
	}));

	const consignacao: MovimentoConsignacao[] = (envioItensRaw ?? []).flatMap(
		i => {
			const envio = enviosMap.get(i.envio_id as string);
			if (!envio) return [];
			const modeloId = i.modelo_id as string;
			const modelo = modelosMap.get(modeloId);

			return [
				{
					envio_item_id: i.envio_item_id as string,
					modelo_id: modeloId,
					modelo_nome: modelo?.nome ?? "Produto",
					modelo_codigo: modelo?.codigo ?? null,
					revendedor_id: envio.revendedor_id,
					revendedor_nome: revMap.get(envio.revendedor_id) ?? "Revendedor",
					data_envio: envio.data_envio,
					status_envio: envio.status as "ABERTO" | "CONFERIDO" | "ENCERRADO",
					qtd_enviada: (i.qtd_enviada as number) ?? 0,
					qtd_vendida: (i.qtd_vendida as number | null) ?? null,
					qtd_devolvida: (i.qtd_devolvida as number | null) ?? null,
				},
			];
		}
	);

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-xl font-semibold text-gray-900">Estoque</h1>
				<p className="text-sm text-gray-500 mt-0.5">
					Acompanhe entradas, saidas e saldo em consignacao por produto.
				</p>
			</div>
			<EstoqueView
				estoque={estoque}
				modelos={modelos}
				revendedores={revendedores}
				producoes={producoes}
				consignacao={consignacao}
			/>
		</div>
	);
}
