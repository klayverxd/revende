import { createClient } from "@/lib/supabase/server";
import ConfiguracoesView, {
	type ConferenciaRecente,
	type AcertoRecebidoRecente,
} from "./ConfiguracoesView";

export default async function ConfiguracoesPage() {
	const supabase = await createClient();

	// Últimas conferências (CONFERIDO ou ENCERRADO) — max 10
	const { data: conferenciasRaw } = await supabase
		.from("envio")
		.select(
			`envio_id, status, data_envio, updated_at,
			 revendedor:revendedor_id(nome)`
		)
		.in("status", ["CONFERIDO", "ENCERRADO"])
		.is("deleted_at", null)
		.order("updated_at", { ascending: false })
		.limit(10);

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

	const conferencias: ConferenciaRecente[] = (conferenciasRaw ?? []).map(r => ({
		envio_id: r.envio_id as string,
		status: r.status as "CONFERIDO" | "ENCERRADO",
		data_envio: r.data_envio as string,
		updated_at: r.updated_at as string,
		revendedor_nome:
			(r.revendedor as unknown as { nome: string } | null)?.nome ?? "—",
	}));

	const acertos: AcertoRecebidoRecente[] = (acertosRaw ?? []).map(r => ({
		acerto_id: r.acerto_id as string,
		data_recebimento: r.data_recebimento as string | null,
		valor_repassado: r.valor_repassado as number | null,
		updated_at: r.updated_at as string,
		revendedor_nome:
			(r.revendedor as unknown as { nome: string } | null)?.nome ?? "—",
	}));

	return <ConfiguracoesView conferencias={conferencias} acertos={acertos} />;
}
