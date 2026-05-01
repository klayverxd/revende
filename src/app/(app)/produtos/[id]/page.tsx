import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProdutoDadosGerais from "./ProdutoDadosGerais";

interface Props {
	readonly params: Promise<{ id: string }>;
}

export default async function ProdutoPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const [{ data: modelo }, { data: precoRow }] = await Promise.all([
		supabase
			.from("modelo")
			.select(
				"modelo_id, codigo, nome, descricao, custo_producao, estoque_minimo, ativo"
			)
			.eq("modelo_id", id)
			.is("deleted_at", null)
			.single(),
		supabase
			.from("modelo_preco")
			.select("preco")
			.eq("modelo_id", id)
			.eq("quantidade_minima", 1)
			.maybeSingle(),
	]);

	if (!modelo) notFound();

	return (
		<ProdutoDadosGerais
			modelo={{
				...modelo,
				preco_unitario: (precoRow?.preco as number | null) ?? null,
			}}
		/>
	);
}
