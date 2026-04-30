import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConferenciaForm, {
	type ConferenciaItem,
	type FaixaPromocional,
	type RevendedorResumo,
} from "./ConferenciaForm";

interface PageProps {
	params: Promise<{ envio_id: string }>;
}

export default async function ConferenciaDetalhePage({ params }: PageProps) {
	const { envio_id } = await params;
	const supabase = await createClient();

	const { data: envio } = await supabase
		.from("envio")
		.select(
			"envio_id, data_envio, status, revendedor:revendedor_id(revendedor_id, nome, modelo_acerto)"
		)
		.eq("envio_id", envio_id)
		.is("deleted_at", null)
		.single();

	if (!envio) notFound();

	const { data: itensRaw } = await supabase
		.from("envio_item")
		.select(
			"envio_item_id, modelo_id, qtd_enviada, preco_unitario, preco_2mais, valor_minimo_unit, modelo:modelo_id(nome, codigo)"
		)
		.eq("envio_id", envio_id)
		.is("deleted_at", null);

	const modelosIds = Array.from(
		new Set((itensRaw ?? []).map(i => i.modelo_id as string))
	);

	let promosByModelo = new Map<string, FaixaPromocional[]>();
	if (modelosIds.length > 0) {
		const { data: promos } = await supabase
			.from("modelo_preco")
			.select("modelo_id, preco, rotulo, quantidade_minima")
			.in("modelo_id", modelosIds)
			.eq("eh_promocao", true)
			.eq("ativo", true)
			.is("deleted_at", null)
			.order("quantidade_minima", { ascending: true });

		for (const p of promos ?? []) {
			const modeloId = p.modelo_id as string;
			if (!promosByModelo.has(modeloId)) promosByModelo.set(modeloId, []);
			promosByModelo.get(modeloId)?.push({
				rotulo: (p.rotulo as string) ?? "Promocao",
				quantidade_minima: (p.quantidade_minima as number) ?? 1,
				preco: (p.preco as number) ?? 0,
			});
		}
	}

	const rev = envio.revendedor as unknown as {
		revendedor_id: string;
		nome: string;
		modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
	};

	const revendedor: RevendedorResumo = {
		revendedor_id: rev.revendedor_id,
		nome: rev.nome,
		modelo_acerto: rev.modelo_acerto,
	};

	const itens: ConferenciaItem[] = (itensRaw ?? []).map(i => {
		const modelo = i.modelo as unknown as {
			nome: string;
			codigo: string | null;
		} | null;
		const modeloId = i.modelo_id as string;
		return {
			envio_item_id: i.envio_item_id as string,
			modelo_id: modeloId,
			modelo_nome: modelo?.nome ?? "Produto",
			modelo_codigo: modelo?.codigo ?? null,
			qtd_enviada: (i.qtd_enviada as number) ?? 0,
			preco_unitario: (i.preco_unitario as number | null) ?? null,
			preco_2mais: (i.preco_2mais as number | null) ?? null,
			valor_minimo_unit: (i.valor_minimo_unit as number | null) ?? null,
			promocoes: promosByModelo.get(modeloId) ?? [],
		};
	});

	return (
		<ConferenciaForm
			envioId={envio.envio_id as string}
			dataEnvio={envio.data_envio as string}
			status={envio.status as string}
			revendedor={revendedor}
			itens={itens}
		/>
	);
}
