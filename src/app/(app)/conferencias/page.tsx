import { createClient } from "@/lib/supabase/server";
import ConferenciasView, {
	type RevendedorConferencia,
	type AcertoPendenteCard,
	type AcertoHistoricoRow,
} from "./ConferenciasView";

function diasEmAberto(dataEnvio: string) {
	const hoje = new Date();
	const envio = new Date(`${dataEnvio}T00:00:00`);
	return Math.max(
		0,
		Math.floor((hoje.getTime() - envio.getTime()) / (1000 * 60 * 60 * 24))
	);
}

export default async function ConferenciasPage() {
	const supabase = await createClient();

	const [{ data: enviosRaw }, { data: pendentesRaw }, { data: historicoRaw }, { data: itensAbertosRaw }] =
		await Promise.all([
			supabase
				.from("envio")
				.select(
					"envio_id, data_envio, revendedor_id, revendedor:revendedor_id(revendedor_id, nome, modelo_acerto), envio_item(envio_item_id)"
				)
				.in("status", ["ABERTO", "CONFERIDO"])
				.is("deleted_at", null)
				.order("data_envio", { ascending: true }),
			supabase
				.from("acerto")
				.select(
					"acerto_id, revendedor_id, envio_id, modelo_acerto, valor_a_receber, valor_liquido, comissao_calculada, created_at, revendedor:revendedor_id(nome)"
				)
				.eq("status", "PENDENTE")
				.is("deleted_at", null)
				.order("created_at", { ascending: true }),
			supabase
				.from("acerto")
				.select(
					"acerto_id, envio_id, data_recebimento, modelo_acerto, valor_repassado, valor_a_receber, valor_liquido, observacao, revendedor:revendedor_id(nome)"
				)
				.eq("status", "RECEBIDO")
				.is("deleted_at", null)
				.order("data_recebimento", { ascending: false }),
			supabase
				.from("envio_item")
				.select("envio_id, qtd_enviada, qtd_vendida, qtd_devolvida")
				.is("deleted_at", null),
		]);

	// Índice: envio_id → unidades restantes (baseado em query separada para não quebrar o select principal)
	const restanteByEnvio = new Map<string, number>();
	for (const i of itensAbertosRaw ?? []) {
		const envioId = i.envio_id as string;
		const r = ((i.qtd_enviada as number) ?? 0) - ((i.qtd_vendida as number | null) ?? 0) - ((i.qtd_devolvida as number | null) ?? 0);
		restanteByEnvio.set(envioId, (restanteByEnvio.get(envioId) ?? 0) + r);
	}

	// Agrupar envios abertos por revendedor
	const revMap = new Map<string, RevendedorConferencia>();
	for (const e of enviosRaw ?? []) {
		const rev = e.revendedor as unknown as {
			revendedor_id: string;
			nome: string;
			modelo_acerto: string;
		} | null;
		const revId = (rev?.revendedor_id ?? e.revendedor_id) as string;
		const itens = e.envio_item as Array<{ envio_item_id: string }> | null;
		const numItens = itens?.length ?? 0;
		const restante = restanteByEnvio.get(e.envio_id as string) ?? 0;
		const diasAberto = diasEmAberto(e.data_envio as string);

		if (!revMap.has(revId)) {
			revMap.set(revId, {
				revendedor_id: revId,
				revendedor_nome: rev?.nome ?? "Revendedor",
				modelo_acerto: (rev?.modelo_acerto ?? "COMISSAO") as
					| "COMISSAO"
					| "VALOR_MINIMO",
				num_envios: 0,
				total_itens: 0,
				total_restante: 0,
				dias_mais_antigo: 0,
				envios: [],
			});
		}
		const card = revMap.get(revId)!;
		card.num_envios += 1;
		card.total_itens += numItens;
		card.total_restante += restante;
		card.dias_mais_antigo = Math.max(card.dias_mais_antigo, diasAberto);
		card.envios.push({
			envio_id: e.envio_id as string,
			data_envio: e.data_envio as string,
			num_itens: numItens,
		});
	}
	const revendedoresComEnvios: RevendedorConferencia[] = Array.from(
		revMap.values()
	).filter(r => r.total_restante > 0);

	const pendentesMap = new Map<string, AcertoPendenteCard>();
	for (const a of pendentesRaw ?? []) {
		const revNome =
			(a.revendedor as unknown as { nome: string } | null)?.nome ??
			"Revendedor";
		const key = a.revendedor_id as string;
		const valorCalculado =
			(a.modelo_acerto as string) === "COMISSAO"
				? ((a.valor_liquido as number | null) ?? 0)
				: ((a.valor_a_receber as number | null) ?? 0);

		if (!pendentesMap.has(key)) {
			pendentesMap.set(key, {
				revendedor_id: a.revendedor_id as string,
				revendedor_nome: revNome,
				modelo_acerto: a.modelo_acerto as "COMISSAO" | "VALOR_MINIMO",
				total_pendente: 0,
				mais_antigo: a.created_at as string,
				acertos: [],
			});
		}
		const card = pendentesMap.get(key)!;
		card.total_pendente += valorCalculado;
		if (
			new Date(a.created_at as string).getTime() <
			new Date(card.mais_antigo).getTime()
		) {
			card.mais_antigo = a.created_at as string;
		}
		card.acertos.push({
			acerto_id: a.acerto_id as string,
			envio_id: a.envio_id as string,
			valor_calculado: valorCalculado,
			valor_a_receber: (a.valor_a_receber as number | null) ?? null,
			valor_liquido: (a.valor_liquido as number | null) ?? null,
			comissao_calculada: (a.comissao_calculada as number | null) ?? null,
			created_at: a.created_at as string,
		});
	}

	const pendentes: AcertoPendenteCard[] = Array.from(pendentesMap.values()).map(
		c => ({
			...c,
			total_pendente: Number(c.total_pendente.toFixed(2)),
		})
	);

	const historico: AcertoHistoricoRow[] = (historicoRaw ?? []).map(a => ({
		acerto_id: a.acerto_id as string,
		envio_id: (a.envio_id as string | null) ?? null,
		data_recebimento: (a.data_recebimento as string | null) ?? null,
		revendedor_nome:
			(a.revendedor as unknown as { nome: string } | null)?.nome ??
			"Revendedor",
		modelo_acerto: a.modelo_acerto as "COMISSAO" | "VALOR_MINIMO",
		valor:
			(a.valor_repassado as number | null) ??
			(a.valor_a_receber as number | null) ??
			(a.valor_liquido as number | null) ??
			0,
		observacao: (a.observacao as string | null) ?? null,
	}));

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-xl font-semibold text-gray-900">Conferencias</h1>
				<p className="text-sm text-gray-600 mt-0.5">
					Confira envios, registre recebimentos e consulte o historico.
				</p>
			</div>

			<ConferenciasView
				revendedoresComEnvios={revendedoresComEnvios}
				pendentes={pendentes}
				historico={historico}
			/>
		</div>
	);
}
