import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import FaixasRevendedorTab, {
	type FaixaRevendedor,
	type RevendedorOpcao,
} from "../FaixasRevendedorTab";

interface Props {
	readonly params: Promise<{ id: string }>;
}

export default async function PrecosRevendedorPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: modelo } = await supabase
		.from("modelo")
		.select("modelo_id")
		.eq("modelo_id", id)
		.is("deleted_at", null)
		.single();

	if (!modelo) notFound();

	const [{ data: revs }, { data: raw }] = await Promise.all([
		supabase
			.from("revendedor")
			.select("revendedor_id, nome, modelo_acerto")
			.eq("ativo", true)
			.is("deleted_at", null)
			.order("nome"),
		supabase
			.from("revendedor_modelo_preco")
			.select(
				"rev_preco_id, revendedor_id, rotulo, quantidade_minima, preco, valor_minimo, eh_promocao, ativo"
			)
			.eq("modelo_id", id)
			.order("quantidade_minima", { ascending: true }),
	]);

	const revendedores: RevendedorOpcao[] = (revs ?? []).map(r => ({
		revendedor_id: r.revendedor_id as string,
		nome: r.nome as string,
		modelo_acerto: r.modelo_acerto as string,
	}));

	const faixasPorRevendedor: Record<string, FaixaRevendedor[]> = {};
	for (const f of raw ?? []) {
		const revId = f.revendedor_id as string;
		if (!faixasPorRevendedor[revId]) faixasPorRevendedor[revId] = [];
		faixasPorRevendedor[revId].push({
			rev_preco_id: f.rev_preco_id as string,
			rotulo: f.rotulo as string,
			quantidade_minima: f.quantidade_minima as number,
			preco: f.preco as number | null,
			valor_minimo: f.valor_minimo as number | null,
			eh_promocao: f.eh_promocao as boolean,
			ativo: f.ativo as boolean,
		});
	}

	return (
		<FaixasRevendedorTab
			modeloId={id}
			revendedores={revendedores}
			faixasPorRevendedor={faixasPorRevendedor}
		/>
	);
}
