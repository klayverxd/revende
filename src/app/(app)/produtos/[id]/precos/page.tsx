import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import FaixasPrecoTable from "./FaixasPrecoTable";

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
		.select("quantidade_minima, preco")
		.eq("modelo_id", id)
		.order("quantidade_minima", { ascending: true });

	const faixas = raw ?? [];
	const unitRow = faixas.find(f => (f.quantidade_minima as number) === 1);
	const doisRow = faixas.find(f => (f.quantidade_minima as number) >= 2);

	return (
		<FaixasPrecoTable
			modeloId={id}
			precoUnit={(unitRow?.preco as number | null) ?? null}
			preco2mais={(doisRow?.preco as number | null) ?? null}
		/>
	);
}
