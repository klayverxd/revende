import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EnviosTable, { type EnvioRow } from "./EnviosTable";
import { Button } from "@/components/ui";

interface SearchParams {
	revendedor?: string;
}

export default async function EnviosPage({
	searchParams,
}: {
	readonly searchParams: Promise<SearchParams>;
}) {
	const supabase = await createClient();
	const sp = await searchParams;
	const revendedorId = sp.revendedor;

	let query = supabase
		.from("envio")
		.select(
			"envio_id, revendedor_id, data_envio, status, revendedor:revendedor_id(nome), envio_item(envio_item_id, qtd_enviada)"
		)
		.is("deleted_at", null)
		.order("data_envio", { ascending: false });

	if (revendedorId) {
		query = query.eq("revendedor_id", revendedorId);
	}

	const { data: enviosRaw } = await query;

	const envios: EnvioRow[] = (enviosRaw ?? []).map(e => {
		const rev = e.revendedor as unknown as { nome: string } | null;
		const itens = e.envio_item as Array<{
			envio_item_id: string;
			qtd_enviada: number | null;
		}> | null;
		return {
			envio_id: e.envio_id as string,
			revendedor_id: e.revendedor_id as string,
			revendedor_nome: rev?.nome ?? "Revendedor",
			data_envio: e.data_envio as string,
			status: e.status as "ABERTO" | "CONFERIDO" | "ENCERRADO",
			total_itens: itens?.length ?? 0,
			total_unidades:
				itens?.reduce((acc, i) => acc + (i.qtd_enviada ?? 0), 0) ?? 0,
		};
	});

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">Envios</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						{revendedorId
							? "Envios filtrados por revendedor."
							: "Controle de envios para revendedores e acompanhamento de status."}
					</p>
				</div>
				<div className="flex items-center gap-2">
					{revendedorId && (
						<Link href="/envios">
							<Button size="sm" variant="ghost">
								Ver todos
							</Button>
						</Link>
					)}
					<Link href="/envios/novo">
						<Button size="sm">+ Novo envio</Button>
					</Link>
				</div>
			</div>
			<EnviosTable envios={envios} />
		</div>
	);
}
