import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DevolucaoForm, { type DevolucaoItem } from "./DevolucaoForm";

interface Props {
	params: Promise<{ id: string }>;
}

export default async function DevolucaoPage({ params }: Props) {
	const { id: envioId } = await params;
	const supabase = await createClient();

	const { data: envio, error: envioError } = await supabase
		.from("envio")
		.select("envio_id, status, revendedor:revendedor_id(nome)")
		.eq("envio_id", envioId)
		.is("deleted_at", null)
		.single();

	if (envioError || !envio) notFound();
	if ((envio.status as string) !== "CONFERIDO") notFound();

	const { data: envioItensRaw } = await supabase
		.from("envio_item")
		.select(
			"envio_item_id, qtd_enviada, qtd_vendida, qtd_devolvida, modelo:modelo_id(nome, codigo)"
		)
		.eq("envio_id", envioId)
		.is("deleted_at", null);

	const itens: DevolucaoItem[] = (envioItensRaw ?? [])
		.map(i => {
			const modelo = i.modelo as unknown as {
				nome: string;
				codigo: string | null;
			} | null;
			const qtd_enviada = (i.qtd_enviada as number) ?? 0;
			const qtd_vendida = (i.qtd_vendida as number | null) ?? 0;
			const qtd_devolvida = (i.qtd_devolvida as number | null) ?? 0;
			const qtd_com_revendedor = qtd_enviada - qtd_vendida - qtd_devolvida;
			return {
				envio_item_id: i.envio_item_id as string,
				modelo_nome: modelo?.nome ?? "Produto",
				modelo_codigo: modelo?.codigo ?? null,
				qtd_enviada,
				qtd_vendida,
				qtd_devolvida,
				qtd_com_revendedor,
			};
		})
		.filter(i => i.qtd_com_revendedor > 0);

	const revendedorNome =
		(envio.revendedor as unknown as { nome: string } | null)?.nome ??
		"Revendedor";

	if (itens.length === 0) {
		return (
			<div className="flex flex-col gap-4">
				<h1 className="text-xl font-semibold text-gray-900">
					Registrar devolução
				</h1>
				<p className="text-gray-600">
					Não há itens pendentes com o revendedor para este envio.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-xl font-semibold text-gray-900">
					Registrar devolução
				</h1>
				<p className="text-sm text-gray-500 mt-0.5">
					Envio #{envioId.slice(0, 8)}
				</p>
			</div>
			<DevolucaoForm
				envioId={envioId}
				revendedorNome={revendedorNome}
				itens={itens}
			/>
		</div>
	);
}
