import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConferenciaRevendedorForm, {
	type EnvioComItens,
	type ConferenciaItemMulti,
} from "./ConferenciaRevendedorForm";
import type { RevendedorResumo } from "../../[envio_id]/ConferenciaForm";

interface PageProps {
	params: Promise<{ revendedor_id: string }>;
}

export default async function ConferenciaRevendedorPage({
	params,
}: Readonly<PageProps>) {
	const { revendedor_id } = await params;
	const supabase = await createClient();

	// Busca dados do revendedor
	const { data: revendedor } = await supabase
		.from("revendedor")
		.select("revendedor_id, nome, modelo_acerto")
		.eq("revendedor_id", revendedor_id)
		.is("deleted_at", null)
		.single();

	if (!revendedor) notFound();

	// Busca todos os envios ABERTOS do revendedor
	const { data: enviosRaw } = await supabase
		.from("envio")
		.select("envio_id, data_envio, status")
		.eq("revendedor_id", revendedor_id)
		.eq("status", "ABERTO")
		.is("deleted_at", null)
		.order("data_envio", { ascending: true });

	if (!enviosRaw || enviosRaw.length === 0) notFound();

	const envioIds = enviosRaw.map(e => e.envio_id as string);

	// Busca todos os itens de todos os envios abertos
	const { data: itensRaw } = await supabase
		.from("envio_item")
		.select(
			"envio_item_id, envio_id, modelo_id, qtd_enviada, qtd_vendida, qtd_devolvida, preco_unitario, valor_minimo_unit, modelo:modelo_id(nome, codigo)"
		)
		.in("envio_id", envioIds)
		.is("deleted_at", null);

	// Monta estrutura agrupada por envio
	const envioMap = new Map<string, EnvioComItens>();
	for (const e of enviosRaw) {
		envioMap.set(e.envio_id as string, {
			envio_id: e.envio_id as string,
			data_envio: e.data_envio as string,
			itens: [],
		});
	}

	for (const i of itensRaw ?? []) {
		const envioId = i.envio_id as string;
		const envioEntry = envioMap.get(envioId);
		if (!envioEntry) continue;
		const modelo = i.modelo as unknown as {
			nome: string;
			codigo: string | null;
		} | null;
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
		e => e.itens.length > 0
	);

	const rev: RevendedorResumo = {
		revendedor_id: revendedor.revendedor_id as string,
		nome: revendedor.nome as string,
		modelo_acerto: revendedor.modelo_acerto as "COMISSAO" | "VALOR_MINIMO",
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
			<ConferenciaRevendedorForm revendedor={rev} envios={envios} />
		</div>
	);
}
