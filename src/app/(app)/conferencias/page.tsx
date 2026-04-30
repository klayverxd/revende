import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";

function fmtDate(date: string) {
	return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function diasEmAberto(dataEnvio: string) {
	const hoje = new Date();
	const envio = new Date(`${dataEnvio}T00:00:00`);
	const diffMs = hoje.getTime() - envio.getTime();
	return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default async function ConferenciasPage() {
	const supabase = await createClient();

	const { data: envios } = await supabase
		.from("envio")
		.select(
			"envio_id, data_envio, revendedor:revendedor_id(nome), envio_item(envio_item_id)"
		)
		.eq("status", "ABERTO")
		.is("deleted_at", null)
		.order("data_envio", { ascending: true });

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-xl font-semibold text-gray-900">Conferencias</h1>
				<p className="text-sm text-gray-600 mt-0.5">
					Selecione um envio aberto para iniciar a conferencia no celular.
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{(envios ?? []).length === 0 && (
					<div className="rounded-xl border border-[#B5D4F4] bg-white p-6 text-center text-gray-600 text-sm">
						Nenhum envio aberto para conferencia.
					</div>
				)}

				{(envios ?? []).map(e => {
					const rev = e.revendedor as unknown as { nome: string } | null;
					const itens = e.envio_item as Array<{ envio_item_id: string }> | null;
					const dias = diasEmAberto(e.data_envio as string);

					return (
						<Link
							key={e.envio_id as string}
							href={`/conferencias/${e.envio_id as string}`}
							className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-2 hover:bg-[#F4F8FD] transition-colors"
						>
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="text-sm font-semibold text-gray-900">
										{rev?.nome ?? "Revendedor"}
									</p>
									<p className="text-xs text-gray-700 mt-0.5">
										Envio: {fmtDate(e.data_envio as string)}
									</p>
								</div>
								{dias > 30 ? (
									<Badge variant="danger">{dias} dias</Badge>
								) : (
									<Badge variant="warning">{dias} dias</Badge>
								)}
							</div>
							<div className="text-sm text-gray-700">
								{itens?.length ?? 0} item(ns) · toque para conferir
							</div>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
