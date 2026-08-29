import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buscarEstoqueCalculado } from "@/lib/queries/estoque";
import { Badge } from "@/components/ui";
import BarChart8Months, { type MonthBar } from "./BarChart8Months";

const PERIODOS = [7, 30, 90] as const;

function toDayStart(days: number) {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - days + 1);
	return d;
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(v: string) {
	return new Date(v).toLocaleDateString("pt-BR");
}

function monthKey(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage({
	searchParams,
}: {
	searchParams?: Promise<{ period?: string }>;
}) {
	const params = (await searchParams) ?? {};
	const periodo = PERIODOS.includes(Number(params.period) as 7 | 30 | 90)
		? Number(params.period)
		: 30;
	const startDate = toDayStart(periodo).toISOString().slice(0, 10);
	const monthStart = new Date();
	monthStart.setDate(1);
	monthStart.setHours(0, 0, 0, 0);

	const supabase = await createClient();

	const [
		{ data: vendasMes },
		{ data: acertosMes },
		{ data: vendasPeriodo },
		{ data: acertosPendentes },
		{ data: acertosRecebidosPeriodo },
		{ data: revendedores },
		{ data: enviosAbertos },
		estoque,
		{ data: vendasDiretas8m },
		{ data: acertos8m },
		{ data: producoesTimeline },
		{ data: vendasTimeline },
		{ data: acertosTimeline },
		{ data: enviosTimeline },
	] = await Promise.all([
		supabase
			.from("venda_direta")
			.select("valor_total")
			.gte("data_venda", monthStart.toISOString().slice(0, 10))
			.is("deleted_at", null),
		supabase
			.from("acerto")
			.select("valor_repassado")
			.eq("status", "RECEBIDO")
			.gte("data_recebimento", monthStart.toISOString().slice(0, 10))
			.is("deleted_at", null),
		supabase
			.from("venda_direta")
			.select("valor_total")
			.gte("data_venda", startDate)
			.is("deleted_at", null),
		supabase
			.from("acerto")
			.select("modelo_acerto, valor_a_receber, valor_liquido")
			.eq("status", "PENDENTE")
			.is("deleted_at", null),
		supabase
			.from("acerto")
			.select("revendedor_id, valor_repassado")
			.eq("status", "RECEBIDO")
			.gte("data_recebimento", startDate)
			.is("deleted_at", null),
		supabase
			.from("revendedor")
			.select("revendedor_id, nome")
			.is("deleted_at", null),
		supabase
			.from("envio")
			.select("envio_id, data_envio, revendedor:revendedor_id(nome)")
			.eq("status", "ABERTO")
			.is("deleted_at", null),
		buscarEstoqueCalculado(),
		supabase
			.from("venda_direta")
			.select("data_venda, valor_total")
			.gte(
				"data_venda",
				new Date(new Date().getFullYear(), new Date().getMonth() - 7, 1)
					.toISOString()
					.slice(0, 10)
			)
			.is("deleted_at", null),
		supabase
			.from("acerto")
			.select("data_recebimento, valor_repassado")
			.eq("status", "RECEBIDO")
			.gte(
				"data_recebimento",
				new Date(new Date().getFullYear(), new Date().getMonth() - 7, 1)
					.toISOString()
					.slice(0, 10)
			)
			.is("deleted_at", null),
		supabase
			.from("producao")
			.select("data_producao, quantidade, modelo:modelo_id(nome)")
			.order("data_producao", { ascending: false })
			.limit(10),
		supabase
			.from("venda_direta")
			.select("data_venda, valor_total")
			.order("data_venda", { ascending: false })
			.limit(10),
		supabase
			.from("acerto")
			.select(
				"data_recebimento, valor_repassado, revendedor:revendedor_id(nome)"
			)
			.eq("status", "RECEBIDO")
			.is("deleted_at", null)
			.order("data_recebimento", { ascending: false })
			.limit(10),
		supabase
			.from("envio")
			.select("data_envio, revendedor:revendedor_id(nome)")
			.order("data_envio", { ascending: false })
			.limit(10),
	]);

	const faturamentoMesVendasDiretas = (vendasMes ?? []).reduce(
		(acc, v) => acc + ((v.valor_total as number | null) ?? 0),
		0
	);
	const faturamentoMesAcertos = (acertosMes ?? []).reduce(
		(acc, a) => acc + ((a.valor_repassado as number | null) ?? 0),
		0
	);
	const faturamentoMes = faturamentoMesVendasDiretas + faturamentoMesAcertos;
	const totalPendente = (acertosPendentes ?? []).reduce((acc, a) => {
		const tipo = a.modelo_acerto as string;
		return (
			acc +
			(tipo === "COMISSAO"
				? ((a.valor_liquido as number | null) ?? 0)
				: ((a.valor_a_receber as number | null) ?? 0))
		);
	}, 0);
	const ticketMedio =
		(vendasPeriodo ?? []).length > 0
			? (vendasPeriodo ?? []).reduce(
					(acc, v) => acc + ((v.valor_total as number | null) ?? 0),
					0
				) / (vendasPeriodo ?? []).length
			: 0;

	const produtosSemEstoque = estoque.filter(e => e.disponivel <= 0).length;
	const alertasEstoque = estoque
		.filter(e => e.estoque_minimo > 0 && e.disponivel <= e.estoque_minimo)
		.slice(0, 5)
		.map(e => ({
			nome: e.nome,
			minimo: e.estoque_minimo,
			disponivel: e.disponivel,
		}));

	const hoje = new Date();
	const totalEmConsignacao = estoque.reduce((acc, e) => acc + e.em_consignacao, 0);
	const enviosAntigos = (enviosAbertos ?? []).filter(e => {
		const d = new Date(e.data_envio as string);
		const dias = Math.floor(
			(hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
		);
		return dias > 7;
	});

	const revMap = new Map<string, string>();
	for (const r of revendedores ?? [])
		revMap.set(r.revendedor_id as string, r.nome as string);
	const topMap = new Map<string, number>();
	for (const a of acertosRecebidosPeriodo ?? []) {
		const id = a.revendedor_id as string;
		const val = (a.valor_repassado as number | null) ?? 0;
		topMap.set(id, (topMap.get(id) ?? 0) + val);
	}
	const topRevendedores = Array.from(topMap.entries())
		.map(([id, total]) => ({
			revendedor_id: id,
			nome: revMap.get(id) ?? "Revendedor",
			total,
		}))
		.sort((a, b) => b.total - a.total)
		.slice(0, 5);

	const monthMap = new Map<string, number>();
	for (let i = 7; i >= 0; i--) {
		const d = new Date();
		d.setMonth(d.getMonth() - i);
		monthMap.set(monthKey(d), 0);
	}
	for (const v of vendasDiretas8m ?? []) {
		const d = new Date(v.data_venda as string);
		const k = monthKey(d);
		if (monthMap.has(k))
			monthMap.set(
				k,
				(monthMap.get(k) ?? 0) + ((v.valor_total as number | null) ?? 0)
			);
	}
	for (const a of acertos8m ?? []) {
		const dRaw = a.data_recebimento as string | null;
		if (!dRaw) continue;
		const d = new Date(dRaw);
		const k = monthKey(d);
		if (monthMap.has(k)) {
			monthMap.set(
				k,
				(monthMap.get(k) ?? 0) + ((a.valor_repassado as number | null) ?? 0)
			);
		}
	}
	const chartData: MonthBar[] = Array.from(monthMap.entries()).map(
		([k, receita]) => {
			const [y, m] = k.split("-");
			const date = new Date(Number(y), Number(m) - 1, 1);
			return {
				mes: date.toLocaleDateString("pt-BR", { month: "short" }),
				receita,
			};
		}
	);

	const timeline: Array<{ data: string; texto: string }> = [
		...(producoesTimeline ?? []).map(p => ({
			data: p.data_producao as string,
			texto: `Produção registrada: ${(p.quantidade as number | null) ?? 0} un`,
		})),
		...(vendasTimeline ?? []).map(v => ({
			data: v.data_venda as string,
			texto: `Venda direta: ${fmtCurrency((v.valor_total as number | null) ?? 0)}`,
		})),
		...(acertosTimeline ?? []).map(a => ({
			data:
				(a.data_recebimento as string | null) ??
				new Date().toISOString().slice(0, 10),
			texto: `Acerto recebido: ${fmtCurrency((a.valor_repassado as number | null) ?? 0)}`,
		})),
		...(enviosTimeline ?? []).map(e => ({
			data: e.data_envio as string,
			texto: "Envio criado",
		})),
	]
		.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
		.slice(0, 10);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						Visão geral operacional e financeira.
					</p>
				</div>
				<div className="inline-flex rounded-lg border border-[#B5D4F4] bg-white p-1">
					{PERIODOS.map(p => (
						<Link
							key={p}
							href={`/dashboard?period=${p}`}
							className={[
								"rounded-md px-3 py-1.5 text-sm font-medium",
								p === periodo
									? "bg-[#185FA5] text-white"
									: "text-gray-700 hover:bg-[#E6F1FB]",
							].join(" ")}
						>
							{p} dias
						</Link>
					))}
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<p className="text-xs text-gray-600">Faturamento do mês</p>
					<p className="text-lg font-semibold text-gray-900 mt-1">
						{fmtCurrency(faturamentoMes)}
					</p>
				</div>
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<p className="text-xs text-gray-600">Total pendente</p>
					<p className="text-lg font-semibold text-gray-900 mt-1">
						{fmtCurrency(totalPendente)}
					</p>
				</div>
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<p className="text-xs text-gray-600">Produtos sem estoque</p>
					<p className="text-lg font-semibold text-gray-900 mt-1">
						{produtosSemEstoque}
					</p>
				</div>
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<p className="text-xs text-gray-600">Ticket médio (período)</p>
					<p className="text-lg font-semibold text-gray-900 mt-1">
						{fmtCurrency(ticketMedio)}
					</p>
				</div>
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<p className="text-xs text-gray-600">Em consignação</p>
					<p className="text-lg font-semibold text-gray-900 mt-1">
						{totalEmConsignacao} un.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
				<div className="xl:col-span-2 rounded-xl border border-[#B5D4F4] bg-white p-4">
					<h2 className="text-sm font-semibold text-gray-900 mb-3">
						Receita dos últimos 8 meses
					</h2>
					<BarChart8Months data={chartData} />
				</div>
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<h2 className="text-sm font-semibold text-gray-900 mb-3">Alertas</h2>
					<div className="space-y-2">
						{alertasEstoque.map(a => (
							<Link
								key={a.nome}
								href="/estoque"
								className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 block hover:bg-red-100 transition-colors"
							>
								Estoque baixo: {a.nome} ({a.disponivel}/{a.minimo})
							</Link>
						))}
						{enviosAntigos.map(e => {
							const r =
								(e.revendedor as unknown as { nome: string } | null)?.nome ??
								"Revendedor";
							return (
								<Link
									key={e.envio_id as string}
									href={`/envios/${e.envio_id as string}`}
									className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 block hover:bg-amber-100 transition-colors"
								>
									Envio aberto há mais de 7 dias: {r}
								</Link>
							);
						})}
						{alertasEstoque.length === 0 && enviosAntigos.length === 0 && (
							<div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
								Sem alertas críticos no momento.
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-sm font-semibold text-gray-900">
							Top 5 revendedores ({periodo} dias)
						</h2>
						<Badge variant="info">Por acertos recebidos</Badge>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
									<th className="px-3 py-2 text-left text-gray-600">
										Revendedor
									</th>
									<th className="px-3 py-2 text-right text-gray-600">Total</th>
								</tr>
							</thead>
							<tbody>
								{topRevendedores.length === 0 && (
									<tr>
										<td
											colSpan={2}
											className="px-3 py-8 text-center text-gray-600"
										>
											Sem dados no período.
										</td>
									</tr>
								)}
								{topRevendedores.map(r => (
									<tr
										key={r.revendedor_id}
										className="border-b border-[#B5D4F4] last:border-0"
									>
										<td className="px-3 py-2 text-gray-900">{r.nome}</td>
										<td className="px-3 py-2 text-right font-semibold text-gray-900">
											{fmtCurrency(r.total)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<h2 className="text-sm font-semibold text-gray-900 mb-3">
						Timeline (últimos 10 eventos)
					</h2>
					<ul className="space-y-2">
						{timeline.map((ev, idx) => (
							<li
								key={`${ev.data}-${idx}`}
								className="rounded-lg border border-[#B5D4F4] bg-[#F4F8FD] px-3 py-2"
							>
								<p className="text-xs text-gray-600">{fmtDate(ev.data)}</p>
								<p className="text-sm text-gray-900">{ev.texto}</p>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
