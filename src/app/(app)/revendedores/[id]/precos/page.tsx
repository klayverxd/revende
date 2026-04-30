import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PrecosPorRevendedorView, {
	type ProdutoPrecoRow,
} from "./PrecosPorRevendedorView";

interface Props {
	readonly params: Promise<{ id: string }>;
}

export default async function RevendedorPrecosPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: revendedor } = await supabase
		.from("revendedor")
		.select("revendedor_id, modelo_acerto")
		.eq("revendedor_id", id)
		.is("deleted_at", null)
		.single();

	if (!revendedor) notFound();

	const modeloAcerto = revendedor.modelo_acerto as "COMISSAO" | "VALOR_MINIMO";

	const [{ data: modelos }, { data: modeloPrecos }, { data: revPrecos }] =
		await Promise.all([
			supabase
				.from("modelo")
				.select("modelo_id, codigo, nome")
				.eq("ativo", true)
				.is("deleted_at", null)
				.order("nome"),
			supabase
				.from("modelo_preco")
				.select("modelo_id, preco, valor_minimo, quantidade_minima")
				.eq("ativo", true)
				.eq("quantidade_minima", 1),
			supabase
				.from("revendedor_modelo_preco")
				.select("modelo_id, preco, valor_minimo, quantidade_minima")
				.eq("revendedor_id", id)
				.eq("ativo", true)
				.eq("quantidade_minima", 1),
		]);

	// Build effective price per modelo
	const padrao = new Map<
		string,
		{ preco: number | null; valor_minimo: number | null }
	>();
	for (const mp of modeloPrecos ?? []) {
		padrao.set(mp.modelo_id as string, {
			preco: mp.preco as number | null,
			valor_minimo: mp.valor_minimo as number | null,
		});
	}

	const personalizado = new Map<
		string,
		{ preco: number | null; valor_minimo: number | null }
	>();
	for (const rp of revPrecos ?? []) {
		personalizado.set(rp.modelo_id as string, {
			preco: rp.preco as number | null,
			valor_minimo: rp.valor_minimo as number | null,
		});
	}

	const produtos: ProdutoPrecoRow[] = (modelos ?? []).map(m => {
		const p = personalizado.get(m.modelo_id as string);
		const d = padrao.get(m.modelo_id as string);
		const isPersonalizado = !!p;
		return {
			modelo_id: m.modelo_id as string,
			codigo: m.codigo as string,
			nome: m.nome as string,
			preco_efetivo: p?.preco ?? d?.preco ?? null,
			valor_minimo_efetivo: p?.valor_minimo ?? d?.valor_minimo ?? null,
			origem: isPersonalizado ? "PERSONALIZADO" : "PADRÃO",
		};
	});

	return (
		<PrecosPorRevendedorView
			revendedorId={id}
			modeloAcerto={modeloAcerto}
			produtos={produtos}
		/>
	);
}
