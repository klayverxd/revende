import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CadastroRevendedorForm from "./CadastroRevendedorForm";

interface Props {
	readonly params: Promise<{ id: string }>;
}

export default async function CadastroRevendedorPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data } = await supabase
		.from("revendedor")
		.select(
			"revendedor_id, nome, telefone, email, endereco, modelo_acerto, comissao_fixa, comissao_pct, valor_minimo_padrao"
		)
		.eq("revendedor_id", id)
		.is("deleted_at", null)
		.single();

	if (!data) notFound();

	return (
		<CadastroRevendedorForm
			revendedor={{
				revendedor_id: data.revendedor_id as string,
				nome: data.nome as string,
				telefone: (data.telefone as string | null) ?? null,
				email: (data.email as string | null) ?? null,
				endereco: (data.endereco as string | null) ?? null,
				modelo_acerto: data.modelo_acerto as "COMISSAO" | "VALOR_MINIMO",
				comissao_fixa: (data.comissao_fixa as number | null) ?? null,
				comissao_pct: (data.comissao_pct as number | null) ?? null,
				valor_minimo_padrao: (data.valor_minimo_padrao as number | null) ?? null,
			}}
		/>
	);
}
