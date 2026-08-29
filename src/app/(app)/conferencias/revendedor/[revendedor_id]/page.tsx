import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConferenciaRevendedorForm, {
	type EnvioComItens,
	type ConferenciaItemMulti,
	type HistoricoEnvio,
} from "./ConferenciaRevendedorForm";
import type { RevendedorResumo } from "../../types";

interface PageProps {
	params: Promise<{ revendedor_id: string }>;
}

export default async function ConferenciaRevendedorPage({
	params,
}: Readonly<PageProps>) {
	const { revendedor_id } = await params;
	const supabase = await createClient();

	const [{ data: revendedor }, { data: todosEnviosRaw }, { data: acertosRaw }] =
		await Promise.all([
			supabase
				.from("revendedor")
				.select("revendedor_id, nome, modelo_acerto, comissao_fixa, comissao_pct")
				.eq("revendedor_id", revendedor_id)
				.is("deleted_at", null)
				.single(),
			supabase
				.from("envio")
				.select("envio_id, data_envio, status")
				.eq("revendedor_id", revendedor_id)
				.is("deleted_at", null)
				.order("data_envio", { ascending: false }),
			supabase
				.from("acerto")
				.select("acerto_id, envio_id, status, valor_a_receber, valor_liquido, data_conferencia")
				.eq("revendedor_id", revendedor_id)
				.is("deleted_at", null),
		]);

	if (!revendedor) notFound();
	if (!todosEnviosRaw?.length) notFound();

	const allEnvioIds = todosEnviosRaw.map(e => e.envio_id as string);

	const { data: todosItensRaw } = await supabase
		.from("envio_item")
		.select(
			"envio_item_id, envio_id, modelo_id, qtd_enviada, qtd_vendida, qtd_devolvida, preco_unitario, valor_minimo_unit, modelo:modelo_id(nome, codigo)"
		)
		.in("envio_id", allEnvioIds)
		.is("deleted_at", null);

	// Índice: acerto por envio_id
	const acertoByEnvio = new Map<string, { acerto_id: string; valor: number; status: string; data_conferencia: string | null }>();
	for (const a of acertosRaw ?? []) {
		const valor = ((a.valor_liquido ?? a.valor_a_receber) as number | null) ?? 0;
		acertoByEnvio.set(a.envio_id as string, {
			acerto_id: a.acerto_id as string,
			valor,
			status: a.status as string,
			data_conferencia: (a.data_conferencia as string | null) ?? null,
		});
	}

	// Índice: itens por envio_id
	type ItemRaw = NonNullable<typeof todosItensRaw>[number];
	const itensByEnvio = new Map<string, ItemRaw[]>();
	for (const i of todosItensRaw ?? []) {
		const eid = i.envio_id as string;
		if (!itensByEnvio.has(eid)) itensByEnvio.set(eid, []);
		itensByEnvio.get(eid)!.push(i);
	}

	// Histórico completo (todos os envios, mais recentes primeiro)
	const historicoEnvios: HistoricoEnvio[] = todosEnviosRaw.map(e => {
		const envioId = e.envio_id as string;
		const itens = (itensByEnvio.get(envioId) ?? []).map(i => {
			const modelo = i.modelo as unknown as { nome: string; codigo: string | null } | null;
			return {
				modelo_nome: modelo?.nome ?? "Produto",
				modelo_codigo: modelo?.codigo ?? null,
				qtd_enviada: (i.qtd_enviada as number) ?? 0,
				qtd_vendida: (i.qtd_vendida as number | null) ?? 0,
				qtd_devolvida: (i.qtd_devolvida as number | null) ?? 0,
			};
		});
		const acerto = acertoByEnvio.get(envioId);
		return {
			envio_id: envioId,
			data_envio: e.data_envio as string,
			status: e.status as "ABERTO" | "CONFERIDO" | "ENCERRADO",
			itens,
			acerto_id: acerto?.acerto_id ?? null,
			acerto_valor: acerto ? acerto.valor : null,
			acerto_status: (acerto?.status as "PENDENTE" | "RECEBIDO") ?? null,
			data_conferencia: acerto?.data_conferencia ?? null,
		};
	});

	// Envios ativos (com itens restantes) para o formulário de conferência
	const envioMap = new Map<string, EnvioComItens>();
	for (const e of todosEnviosRaw) {
		if (!["ABERTO", "CONFERIDO"].includes(e.status as string)) continue;
		envioMap.set(e.envio_id as string, {
			envio_id: e.envio_id as string,
			data_envio: e.data_envio as string,
			itens: [],
		});
	}
	for (const i of todosItensRaw ?? []) {
		const envioId = i.envio_id as string;
		const envioEntry = envioMap.get(envioId);
		if (!envioEntry) continue;
		const modelo = i.modelo as unknown as { nome: string; codigo: string | null } | null;
		const item: ConferenciaItemMulti = {
			envio_item_id: i.envio_item_id as string,
			envio_id: envioId,
			modelo_id: i.modelo_id as string,
			modelo_nome: modelo?.nome ?? "Produto",
			modelo_codigo: modelo?.codigo ?? null,
			qtd_enviada: (i.qtd_enviada as number) ?? 0,
			qtd_vendida: (i.qtd_vendida as number | null) ?? 0,
			qtd_devolvida: (i.qtd_devolvida as number | null) ?? 0,
			preco_unitario: (i.preco_unitario as number | null) ?? null,
			valor_minimo_unit: (i.valor_minimo_unit as number | null) ?? null,
		};
		envioEntry.itens.push(item);
	}
	const envios: EnvioComItens[] = Array.from(envioMap.values()).filter(
		e => e.itens.some(i => i.qtd_enviada - i.qtd_vendida - i.qtd_devolvida > 0)
	);

	if (envios.length === 0) notFound();

	const rev: RevendedorResumo = {
		revendedor_id: revendedor.revendedor_id as string,
		nome: revendedor.nome as string,
		modelo_acerto: revendedor.modelo_acerto as "COMISSAO" | "VALOR_MINIMO",
		comissao_fixa: (revendedor.comissao_fixa as number | null) ?? null,
		comissao_pct: (revendedor.comissao_pct as number | null) ?? null,
	};

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="text-xl font-semibold text-gray-900">
					Conferencia — {rev.nome}
				</h1>
				<p className="text-sm text-gray-600 mt-0.5">
					{envios.length === 1
						? "1 envio em aberto"
						: `${envios.length} envios em aberto`}
				</p>
			</div>
			<ConferenciaRevendedorForm
				revendedor={rev}
				envios={envios}
				historicoEnvios={historicoEnvios}
			/>
		</div>
	);
}
