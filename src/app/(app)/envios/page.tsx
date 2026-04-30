import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EnviosTable, { type EnvioRow } from "./EnviosTable";
import { Button } from "@/components/ui";

export default async function EnviosPage() {
	const supabase = await createClient();

	const { data: enviosRaw } = await supabase
		.from("envio")
		.select(
			"envio_id, revendedor_id, data_envio, status, revendedor:revendedor_id(nome), envio_item(envio_item_id)"
		)
		.is("deleted_at", null)
		.order("data_envio", { ascending: false });

	const envios: EnvioRow[] = (enviosRaw ?? []).map(e => {
		const rev = e.revendedor as unknown as { nome: string } | null;
		const itens = e.envio_item as Array<{ envio_item_id: string }> | null;
		return {
			envio_id: e.envio_id as string,
			revendedor_nome: rev?.nome ?? "Revendedor",
			data_envio: e.data_envio as string,
			status: e.status as "ABERTO" | "CONFERIDO" | "ENCERRADO",
			total_itens: itens?.length ?? 0,
		};
	});

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">Envios</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						Controle de envios para revendedores e acompanhamento de status.
					</p>
				</div>
				<Link href="/envios/novo">
					<Button size="sm">+ Novo envio</Button>
				</Link>
			</div>
			<EnviosTable envios={envios} />
		</div>
	);
}
