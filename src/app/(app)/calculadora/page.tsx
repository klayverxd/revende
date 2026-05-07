import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import CalculadoraView, {
	type EquipamentoAtivo,
	type MateriaPrimaAtiva,
	type ModeloOption,
	type CustoExtraAtivo,
} from "./CalculadoraView";

export default async function CalculadoraPage() {
	const supabase = await createClient();

	const [
		{ data: energia },
		{ data: equipamentos },
		{ data: materias },
		{ data: modelos },
		{ data: custosExtras },
	] = await Promise.all([
		supabase
			.from("config_energia")
			.select("preco_kwh, pct_falhas")
			.order("updated_at", { ascending: false })
			.limit(1)
			.maybeSingle(),
		supabase
			.from("config_equipamento")
			.select("equipamento_id, nome, potencia_watts, depreciacao_hora")
			.eq("ativa", true)
			.is("deleted_at", null)
			.order("nome"),
		supabase
			.from("config_materia_prima")
			.select("materia_prima_id, nome, preco_por_unidade, unidade_medida")
			.eq("ativo", true)
			.is("deleted_at", null)
			.order("nome"),
		supabase
			.from("modelo")
			.select("modelo_id, nome, codigo")
			.is("deleted_at", null)
			.order("nome"),
		supabase
			.from("config_custo_extra")
			.select("custo_extra_id, nome, valor")
			.eq("ativo", true)
			.is("deleted_at", null)
			.order("nome"),
	]);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">
						Calculadora de custo
					</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						Calcule custo de lote, custo unitário e sugestões de preço.
					</p>
				</div>
				<Link href="/calculadora/config">
					<Button variant="secondary" size="sm">
						Configurações
					</Button>
				</Link>
			</div>

			<CalculadoraView
				precoKwh={(energia?.preco_kwh as number | null) ?? 0}
				pctFalhasPadrao={(energia?.pct_falhas as number | null) ?? 0.05}
				equipamentos={(equipamentos ?? []) as unknown as EquipamentoAtivo[]}
				materias={(materias ?? []) as unknown as MateriaPrimaAtiva[]}
				modelos={(modelos ?? []) as unknown as ModeloOption[]}
				custosExtras={(custosExtras ?? []) as unknown as CustoExtraAtivo[]}
			/>
		</div>
	);
}
