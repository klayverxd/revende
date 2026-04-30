import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import FinanceiroView, {
	type AcertoHistoricoRow,
	type AcertoPendenteCard,
} from "./FinanceiroView";

export default async function FinanceiroPage() {
	const supabase = await createClient();

	const [{ data: pendentesRaw }, { data: historicoRaw }] = await Promise.all([
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
				"acerto_id, data_recebimento, modelo_acerto, valor_repassado, valor_a_receber, valor_liquido, observacao, revendedor:revendedor_id(nome)"
			)
			.eq("status", "RECEBIDO")
			.is("deleted_at", null)
			.order("data_recebimento", { ascending: false }),
	]);

	const pendentesMap = new Map<string, AcertoPendenteCard>();
	for (const a of pendentesRaw ?? []) {
		const revNome = ((a.revendedor as unknown as { nome: string } | null)
			?.nome ?? "Revendedor") as string;
		const key = `${a.revendedor_id as string}`;
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
		data_recebimento: (a.data_recebimento as string | null) ?? null,
		revendedor_nome: ((a.revendedor as unknown as { nome: string } | null)
			?.nome ?? "Revendedor") as string,
		modelo_acerto: a.modelo_acerto as "COMISSAO" | "VALOR_MINIMO",
		valor: ((a.valor_repassado as number | null) ??
			(a.valor_a_receber as number | null) ??
			(a.valor_liquido as number | null) ??
			0) as number,
		observacao: (a.observacao as string | null) ?? null,
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">Financeiro</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						Gerencie acertos pendentes, recebimentos e historico financeiro.
					</p>
				</div>
				<Link href="/financeiro/fluxo">
					<Button variant="secondary" size="sm">
						Fluxo de caixa
					</Button>
				</Link>
			</div>

			<FinanceiroView pendentes={pendentes} historico={historico} />
		</div>
	);
}
