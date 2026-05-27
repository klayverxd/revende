import { createClient } from "@/lib/supabase/server";
import RevendedoresTable, { type RevendedorRow } from "./RevendedoresTable";

export default async function RevendedoresPage() {
	const supabase = await createClient();

	const [{ data: revs }, { data: enviosRaw }, { data: acertosRaw }] =
		await Promise.all([
			supabase
				.from("revendedor")
				.select(
					"revendedor_id, nome, modelo_acerto, ativo, telefone, email, endereco, comissao_fixa, comissao_pct, valor_minimo_padrao"
				)
				.is("deleted_at", null)
				.order("nome"),
			supabase
				.from("envio")
				.select("revendedor_id, status, envio_item(qtd_enviada, qtd_vendida)")
				.is("deleted_at", null),
			supabase
				.from("acerto")
				.select("revendedor_id, valor_a_receber, valor_liquido, modelo_acerto")
				.eq("status", "PENDENTE")
				.is("deleted_at", null),
		]);

	// Aggregate stats per revendedor
	type Stats = { enviado: number; vendido: number; pendente: number };
	const statsMap = new Map<string, Stats>();
	for (const r of revs ?? []) {
		statsMap.set(r.revendedor_id as string, {
			enviado: 0,
			vendido: 0,
			pendente: 0,
		});
	}

	for (const envio of enviosRaw ?? []) {
		const revId = envio.revendedor_id as string;
		const stats = statsMap.get(revId);
		if (!stats) continue;
		const items = envio.envio_item as Array<{
			qtd_enviada: number;
			qtd_vendida: number | null;
		}>;
		for (const item of items ?? []) {
			stats.enviado += item.qtd_enviada ?? 0;
			if (["CONFERIDO", "ENCERRADO"].includes(envio.status as string)) {
				stats.vendido += item.qtd_vendida ?? 0;
			}
		}
	}

	for (const acerto of acertosRaw ?? []) {
		const revId = acerto.revendedor_id as string;
		const stats = statsMap.get(revId);
		if (!stats) continue;
		const val =
			acerto.modelo_acerto === "COMISSAO"
				? ((acerto.valor_liquido as number) ?? 0)
				: ((acerto.valor_a_receber as number) ?? 0);
		stats.pendente += val;
	}

	const revendedores: RevendedorRow[] = (revs ?? []).map(r => {
		const stats = statsMap.get(r.revendedor_id as string) ?? {
			enviado: 0,
			vendido: 0,
			pendente: 0,
		};
		return {
			revendedor_id: r.revendedor_id as string,
			nome: r.nome as string,
			modelo_acerto: r.modelo_acerto as "COMISSAO" | "VALOR_MINIMO",
			ativo: r.ativo as boolean,
			total_enviado: stats.enviado,
			total_vendido: stats.vendido,
			comissao_pendente: stats.pendente,
			telefone: r.telefone as string | null,
			email: r.email as string | null,
			endereco: r.endereco as string | null,
			comissao_fixa: r.comissao_fixa as number | null,
			comissao_pct: r.comissao_pct as number | null,
			valor_minimo_padrao: r.valor_minimo_padrao as number | null,
		};
	});

	return <RevendedoresTable revendedores={revendedores} />;
}
