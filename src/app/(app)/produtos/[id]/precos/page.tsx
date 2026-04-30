import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import FaixasPrecoTable, { type FaixaPreco } from "./FaixasPrecoTable";

interface Props {
	readonly params: Promise<{ id: string }>;
}

export default async function PrecosPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: modelo } = await supabase
		.from("modelo")
		.select("modelo_id, nome")
		.eq("modelo_id", id)
		.is("deleted_at", null)
		.single();

	if (!modelo) notFound();

	const { data: raw } = await supabase
		.from("modelo_preco")
		.select("preco_id, rotulo, quantidade_minima, preco, eh_promocao, ativo")
		.eq("modelo_id", id)
		.order("quantidade_minima", { ascending: true });

	const faixas: FaixaPreco[] = (raw ?? []).map(f => ({
		preco_id: f.preco_id as string,
		rotulo: f.rotulo as string,
		quantidade_minima: f.quantidade_minima as number,
		preco: f.preco as number,
		eh_promocao: f.eh_promocao as boolean,
		ativo: f.ativo as boolean,
	}));

	return <FaixasPrecoTable modeloId={id} faixas={faixas} />;
}
