import type { GraficoMes } from "./actions";

const CANAL_LABEL: Record<string, string> = {
	PRESENCIAL: "Presencial",
	WHATSAPP: "WhatsApp",
	INSTAGRAM: "Instagram",
	SHOPEE: "Shopee",
};

function fmtBRL(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
	readonly data: {
		receitaPedidos: number;
		custoPedidos: number;
		lucroPedidos: number;
		receitaAcertos: number;
		acertosPendentes: number;
		totalPendenteAcertos: number;
		receitaTotal: number;
		custoTotal: number;
		grafico: GraficoMes[];
	};
}

function KpiCard({
	label, value, sub, highlight, danger,
}: {
	readonly label: string;
	readonly value: string;
	readonly sub?: string;
	readonly highlight?: boolean;
	readonly danger?: boolean;
}) {
	let color = "text-gray-900";
	if (danger) color = "text-red-600";
	else if (highlight) color = "text-[#185FA5]";
	return (
		<div className="bg-white rounded-xl border border-[#B5D4F4] p-4">
			<p className="text-xs text-gray-500 mb-1">{label}</p>
			<p className={`text-xl font-bold ${color}`}>{value}</p>
			{sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
		</div>
	);
}

export default function GeralTab({ data }: Props) {
	const {
		receitaPedidos, custoPedidos, lucroPedidos,
		receitaAcertos, acertosPendentes, totalPendenteAcertos,
		receitaTotal, custoTotal, grafico,
	} = data;

	const lucroTotal = receitaTotal - custoTotal;
	const maxBar = Math.max(...grafico.map(g => g.pedidos + g.acertos), 1);

	return (
		<div className="flex flex-col gap-4">
			{/* KPIs principais */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				<KpiCard
					label="Receita total (mês)"
					value={fmtBRL(receitaTotal)}
					sub="pedidos + acertos"
					highlight
				/>
				<KpiCard
					label="Custos (mês)"
					value={fmtBRL(custoTotal)}
				/>
				<KpiCard
					label="Lucro estimado (mês)"
					value={fmtBRL(lucroTotal)}
					highlight={lucroTotal >= 0}
					danger={lucroTotal < 0}
				/>
				<KpiCard
					label="Acertos pendentes"
					value={fmtBRL(totalPendenteAcertos)}
					sub={`${acertosPendentes} acerto${acertosPendentes !== 1 ? "s" : ""}`}
					danger={acertosPendentes > 0}
				/>
			</div>

			{/* Detalhes por fonte */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<div className="bg-white rounded-xl border border-[#B5D4F4] p-4 flex flex-col gap-2">
					<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pedidos este mês</p>
					<div className="flex justify-between text-sm text-gray-700">
						<span>Receita</span>
						<span className="font-semibold">{fmtBRL(receitaPedidos)}</span>
					</div>
					<div className="flex justify-between text-sm text-gray-700">
						<span>Custos</span>
						<span className="font-semibold">{fmtBRL(custoPedidos)}</span>
					</div>
					<div className={`flex justify-between text-sm font-bold border-t border-[#E6F1FB] pt-2 mt-1 ${lucroPedidos >= 0 ? "text-green-700" : "text-red-600"}`}>
						<span>Lucro</span>
						<span>{fmtBRL(lucroPedidos)}</span>
					</div>
				</div>
				<div className="bg-white rounded-xl border border-[#B5D4F4] p-4 flex flex-col gap-2">
					<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Comissão este mês</p>
					<div className="flex justify-between text-sm text-gray-700">
						<span>Acertos recebidos</span>
						<span className="font-semibold">{fmtBRL(receitaAcertos)}</span>
					</div>
					<div className="flex justify-between text-sm text-gray-700 border-t border-[#E6F1FB] pt-2 mt-1">
						<span>Ainda pendente</span>
						<span className={`font-semibold ${acertosPendentes > 0 ? "text-amber-600" : "text-gray-700"}`}>
							{fmtBRL(totalPendenteAcertos)}
						</span>
					</div>
				</div>
			</div>

			{/* Gráfico últimos 6 meses */}
			<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3">
				<p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Receita — últimos 6 meses</p>
				<div className="flex flex-col gap-2.5">
					{grafico.map(g => {
						const total = g.pedidos + g.acertos;
						const pctPedidos = maxBar > 0 ? (g.pedidos / maxBar) * 100 : 0;
						const pctAcertos = maxBar > 0 ? (g.acertos / maxBar) * 100 : 0;
						return (
							<div key={g.label} className="flex items-center gap-3">
								<span className="text-xs text-gray-500 w-14 shrink-0 text-right">{g.label}</span>
								<div className="flex-1 flex flex-col gap-0.5">
									{pctPedidos > 0 && (
										<div className="h-2 bg-[#185FA5] rounded-sm" style={{ width: `${pctPedidos}%` }} title={`Pedidos: ${fmtBRL(g.pedidos)}`} />
									)}
									{pctAcertos > 0 && (
										<div className="h-2 bg-[#378ADD] rounded-sm opacity-60" style={{ width: `${pctAcertos}%` }} title={`Acertos: ${fmtBRL(g.acertos)}`} />
									)}
									{pctPedidos === 0 && pctAcertos === 0 && (
										<div className="h-2 bg-gray-100 rounded-sm w-full" />
									)}
								</div>
								<span className="text-xs font-semibold text-gray-700 w-24 shrink-0 text-right">{total > 0 ? fmtBRL(total) : "—"}</span>
							</div>
						);
					})}
				</div>
				<div className="flex items-center gap-4 mt-3 pt-2 border-t border-[#F4F8FD]">
					<span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-2 bg-[#185FA5] rounded-sm inline-block" />Pedidos</span>
					<span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-2 bg-[#378ADD] opacity-60 rounded-sm inline-block" />Acertos</span>
				</div>
			</div>
		</div>
	);
}
