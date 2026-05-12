import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProdutoDadosGerais from "./ProdutoDadosGerais";

interface Props {
	readonly params: Promise<{ id: string }>;
}

export default async function ProdutoPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const [{ data: modelo }, { data: precoRow }, { data: ultimoCalculo }] =
		await Promise.all([
			supabase
				.from("modelo")
				.select(
					"modelo_id, codigo, nome, descricao, custo_producao, estoque_minimo, ativo, foto_url"
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
			supabase
				.from("calculo_custo")
				.select(
					"calculo_id, created_at, equipamento_id, materias_primas, custo_extra_id, tempo_impressao_min, quantidade, num_placas, custo_energia, custo_materias_primas, custo_depreciacao, custo_falhas, custo_extra, custo_total, custo_unitario, pct_falhas, config_equipamento(nome)"
				)
				.eq("salvo_em_modelo_id", id)
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle(),
		]);

	if (!modelo) notFound();

	type RawCalculo = Omit<
		NonNullable<typeof ultimoCalculo>,
		"config_equipamento"
	> & {
		config_equipamento: { nome: unknown }[] | null;
	};

	const raw = ultimoCalculo as RawCalculo | null;
	const calculoNormalizado = raw
		? {
				...raw,
				config_equipamento:
					Array.isArray(raw.config_equipamento) &&
					raw.config_equipamento.length > 0
						? ({ nome: String(raw.config_equipamento[0].nome) } as {
								nome: string;
							})
						: null,
			}
		: null;

	return (
		<ProdutoDadosGerais
			modelo={{
				...modelo,
				preco_unitario: (precoRow?.preco as number | null) ?? null,
			}}
			ultimoCalculo={calculoNormalizado}
		/>
	);
}
