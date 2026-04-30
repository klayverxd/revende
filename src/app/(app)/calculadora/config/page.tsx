import ConfigCalculadoraView, {
	type EquipamentoRow,
	type MateriaPrimaRow,
} from "./ConfigCalculadoraView";
import { createClient } from "@/lib/supabase/server";

export default async function ConfigCalculadoraPage() {
	const supabase = await createClient();

	const [{ data: energia }, { data: equipamentos }, { data: materias }] =
		await Promise.all([
			supabase
				.from("config_energia")
				.select("id, preco_kwh")
				.order("updated_at", { ascending: false })
				.limit(1)
				.maybeSingle(),
			supabase
				.from("config_equipamento")
				.select("equipamento_id, nome, potencia_watts, depreciacao_hora, ativa")
				.is("deleted_at", null)
				.order("nome"),
			supabase
				.from("config_materia_prima")
				.select(
					"materia_prima_id, nome, preco_por_unidade, unidade_medida, ativo"
				)
				.is("deleted_at", null)
				.order("nome"),
		]);

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-xl font-semibold text-gray-900">
					Configurações da calculadora
				</h1>
				<p className="text-sm text-gray-600 mt-0.5">
					Cadastre energia, equipamentos e matérias-primas.
				</p>
			</div>

			<ConfigCalculadoraView
				precoKwh={(energia?.preco_kwh as number | null) ?? 0}
				equipamentos={(equipamentos ?? []) as unknown as EquipamentoRow[]}
				materias={(materias ?? []) as unknown as MateriaPrimaRow[]}
			/>
		</div>
	);
}
