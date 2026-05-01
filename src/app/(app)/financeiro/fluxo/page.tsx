import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const MESES = [
	"Jan",
	"Fev",
	"Mar",
	"Abr",
	"Mai",
	"Jun",
	"Jul",
	"Ago",
	"Set",
	"Out",
	"Nov",
	"Dez",
] as const;

type Linha = {
	nome: string;
	valores: number[];
	total: number;
};

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mesIndex(d: string | null | undefined) {
	if (!d) return -1;
	return new Date(d).getMonth();
}

interface SearchParams {
	ano?: string;
}

export default async function FluxoPage({
	searchParams,
}: {
	readonly searchParams: Promise<SearchParams>;
}) {
	const supabase = await createClient();
	const sp = await searchParams;
	const ano = parseInt(sp.ano ?? "", 10) || new Date().getFullYear();
	const anoStart = `${ano}-01-01`;
	const anoEnd = `${ano}-12-31`;

	const [{ data: vendas }, { data: producoes }, { data: acertos }] =
		await Promise.all([
			supabase
				.from("venda_direta")
				.select("data_venda, valor_total")
				.gte("data_venda", anoStart)
				.lte("data_venda", anoEnd)
				.is("deleted_at", null),
			supabase
				.from("producao")
				.select("data_producao, quantidade, custo_unitario")
				.gte("data_producao", anoStart)
				.lte("data_producao", anoEnd)
				.is("deleted_at", null),
			supabase
				.from("acerto")
				.select(
					"data_recebimento, valor_repassado, comissao_calculada, valor_a_receber, modelo_acerto"
				)
				.eq("status", "RECEBIDO")
				.gte("data_recebimento", anoStart)
				.lte("data_recebimento", anoEnd)
				.is("deleted_at", null),
		]);

	const receita = new Array(12).fill(0) as number[];
	const custoProducao = new Array(12).fill(0) as number[];
	const acertosPagos = new Array(12).fill(0) as number[];

	for (const v of vendas ?? []) {
		const m = mesIndex(v.data_venda as string);
		if (m >= 0) receita[m] += (v.valor_total as number | null) ?? 0;
	}

	for (const p of producoes ?? []) {
		const m = mesIndex(p.data_producao as string);
		if (m < 0) continue;
		const qtd = (p.quantidade as number | null) ?? 0;
		const custo = (p.custo_unitario as number | null) ?? 0;
		custoProducao[m] += qtd * custo;
	}

	for (const a of acertos ?? []) {
		const m = mesIndex(a.data_recebimento as string | null);
		if (m >= 0) {
			receita[m] += (a.valor_repassado as number | null) ?? 0;
			// VALOR_MINIMO: cost = valor_a_receber (agreed minimum); COMISSAO: cost = comissao_calculada
			const custo =
				(a.modelo_acerto as string) === "VALOR_MINIMO"
					? ((a.valor_a_receber as number | null) ?? 0)
					: ((a.comissao_calculada as number | null) ?? 0);
			acertosPagos[m] += custo;
		}
	}

	const lucroLiquido = receita.map(
		(v, i) => v - custoProducao[i] - acertosPagos[i]
	);

	const linhas: Linha[] = [
		{
			nome: "Receita bruta",
			valores: receita,
			total: receita.reduce((a, b) => a + b, 0),
		},
		{
			nome: "Custo producao",
			valores: custoProducao,
			total: custoProducao.reduce((a, b) => a + b, 0),
		},
		{
			nome: "Acertos pagos",
			valores: acertosPagos,
			total: acertosPagos.reduce((a, b) => a + b, 0),
		},
		{
			nome: "Lucro liquido",
			valores: lucroLiquido,
			total: lucroLiquido.reduce((a, b) => a + b, 0),
		},
	];

	const prevYear = ano - 1;
	const nextYear = ano + 1;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-3 flex-wrap">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">
						Fluxo de caixa
					</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						Visao mensal de receita, custos, acertos e lucro liquido.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Link
						href="/financeiro"
						className="px-3 py-1.5 rounded-lg border border-[#B5D4F4] text-sm text-gray-700 hover:bg-[#E6F1FB] transition-colors"
					>
						Voltar
					</Link>
					<Link
						href={`?ano=${prevYear}`}
						className="px-3 py-1.5 rounded-lg border border-[#B5D4F4] text-sm text-[#185FA5] hover:bg-[#E6F1FB] transition-colors"
					>
						← {prevYear}
					</Link>
					<span className="px-3 py-1.5 rounded-lg bg-[#185FA5] text-white text-sm font-semibold">
						{ano}
					</span>
					<Link
						href={`?ano=${nextYear}`}
						className="px-3 py-1.5 rounded-lg border border-[#B5D4F4] text-sm text-[#185FA5] hover:bg-[#E6F1FB] transition-colors"
					>
						{nextYear} →
					</Link>
				</div>
			</div>
			<div className="rounded-xl border border-[#B5D4F4] bg-white overflow-x-auto">
				<table className="w-full text-sm">
					<thead className="border-b border-[#B5D4F4]">
						<tr>
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Categoria
							</th>
							{MESES.map(m => (
								<th
									key={m}
									className="px-3 py-2.5 text-right font-medium text-gray-600"
								>
									{m}
								</th>
							))}
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Total
							</th>
						</tr>
					</thead>
					<tbody>
						{linhas.map(linha => (
							<tr
								key={linha.nome}
								className="border-b border-[#B5D4F4] last:border-0"
							>
								<td className="px-3 py-2.5 font-medium text-gray-900">
									{linha.nome}
								</td>
								{linha.valores.map((v, idx) => (
									<td
										key={`${linha.nome}-${idx}`}
										className="px-3 py-2.5 text-right text-gray-700"
									>
										{fmtCurrency(v)}
									</td>
								))}
								<td className="px-3 py-2.5 text-right font-semibold text-gray-900">
									{fmtCurrency(linha.total)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
