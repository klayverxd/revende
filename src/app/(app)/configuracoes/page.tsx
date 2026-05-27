import { createClient } from "@/lib/supabase/server";
import { buscarEquipe } from "./actions";
import ConfiguracoesView, {
	type ConferenciaRecente,
	type AcertoRecebidoRecente,
} from "./ConfiguracoesView";

export default async function ConfiguracoesPage() {
	const supabase = await createClient();

	// Envios CONFERIDO/ENCERRADO — max 20
	const { data: conferenciasRaw } = await supabase
		.from("envio")
		.select(
			`envio_id, revendedor_id, status, data_envio, updated_at,
			 revendedor:revendedor_id(nome)`
		)
		.in("status", ["CONFERIDO", "ENCERRADO"])
		.is("deleted_at", null)
		.order("updated_at", { ascending: false })
		.limit(20);

	// Acertos PENDENTES — cobrem envios ABERTO com conferência parcial
	const { data: acertosPendentesRaw } = await supabase
		.from("acerto")
		.select(
			`acerto_id, envio_id, revendedor_id, updated_at,
			 revendedor:revendedor_id(nome),
			 envio:envio_id(envio_id, status, data_envio)`
		)
		.eq("status", "PENDENTE")
		.is("deleted_at", null)
		.order("updated_at", { ascending: false })
		.limit(20);

	// Últimos acertos RECEBIDO — max 10
	const { data: acertosRaw } = await supabase
		.from("acerto")
		.select(
			`acerto_id, status, data_recebimento, valor_repassado, updated_at,
			 revendedor:revendedor_id(nome)`
		)
		.eq("status", "RECEBIDO")
		.is("deleted_at", null)
		.order("updated_at", { ascending: false })
		.limit(10);

	// Merge: envios CONFERIDO/ENCERRADO + envios referenciados por acertos PENDENTES
	const conferenciasMap = new Map<string, ConferenciaRecente>();

	for (const r of conferenciasRaw ?? []) {
		const envio_id = r.envio_id as string;
		if (!conferenciasMap.has(envio_id)) {
			conferenciasMap.set(envio_id, {
				envio_id,
				revendedor_id: r.revendedor_id as string,
				status: r.status as "CONFERIDO" | "ENCERRADO",
				data_envio: r.data_envio as string,
				updated_at: r.updated_at as string,
				revendedor_nome:
					(r.revendedor as unknown as { nome: string } | null)?.nome ?? "—",
			});
		}
	}

	for (const a of acertosPendentesRaw ?? []) {
		const envio = a.envio as unknown as {
			envio_id: string;
			status: string;
			data_envio: string;
		} | null;
		if (!envio) continue;
		const envio_id = envio.envio_id;
		if (!conferenciasMap.has(envio_id)) {
			conferenciasMap.set(envio_id, {
				envio_id,
				revendedor_id: a.revendedor_id as string,
				status: envio.status as "CONFERIDO" | "ENCERRADO",
				data_envio: envio.data_envio,
				updated_at: a.updated_at as string,
				revendedor_nome:
					(a.revendedor as unknown as { nome: string } | null)?.nome ?? "—",
			});
		}
	}

	const conferencias = [...conferenciasMap.values()].sort(
		(a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
	);

	const acertos: AcertoRecebidoRecente[] = (acertosRaw ?? []).map(r => ({
		acerto_id: r.acerto_id as string,
		data_recebimento: r.data_recebimento as string | null,
		valor_repassado: r.valor_repassado as number | null,
		updated_at: r.updated_at as string,
		revendedor_nome:
			(r.revendedor as unknown as { nome: string } | null)?.nome ?? "—",
	}));

	const equipe = await buscarEquipe();

	return (
		<ConfiguracoesView
			conferencias={conferencias}
			acertos={acertos}
			equipe={equipe}
		/>
	);
}
