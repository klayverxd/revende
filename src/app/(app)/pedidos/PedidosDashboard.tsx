"use client";

import type { CanalPedido } from "./actions";

const CANAL_LABEL: Record<CanalPedido, string> = {
	PRESENCIAL: "Presencial",
	WHATSAPP: "WhatsApp",
	INSTAGRAM: "Instagram",
	SHOPEE: "Shopee",
};

interface Props {
	readonly dashboard: {
		canalCounts: Record<string, number>;
		receitaTotal: number;
		custoTotal: number | null;
		lucroTotal: number | null;
		pedidosMes: number;
		ativos: number;
	};
}

function fmtBRL(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PedidosDashboard({ dashboard }: Props) {
	const { canalCounts, receitaTotal, custoTotal, lucroTotal, pedidosMes, ativos } =
		dashboard;

	const topCanais = Object.entries(canalCounts)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5);
	const totalCanais = topCanais.reduce((acc, [, n]) => acc + n, 0);
	const totalPedidos = totalCanais;

	return (
		<div className="flex gap-3 items-stretch">
			<div className="flex-1 flex flex-col gap-3">
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					<MetricCard label="Total de pedidos" value={String(totalPedidos)} />
					<MetricCard label="Ativos (em produção)" value={String(ativos)} />
					<MetricCard label="Pedidos este mês" value={String(pedidosMes)} />
					<MetricCard
						label="Receita este mês"
						value={fmtBRL(receitaTotal)}
						highlight
					/>
				</div>

				{(custoTotal != null || lucroTotal != null) && (
					<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
						<MetricCard
							label="Custos este mês"
							value={custoTotal == null ? "—" : fmtBRL(custoTotal)}
						/>
						<MetricCard
							label="Lucro este mês"
							value={lucroTotal == null ? "—" : fmtBRL(lucroTotal)}
							highlight={lucroTotal != null && lucroTotal >= 0}
							danger={lucroTotal != null && lucroTotal < 0}
						/>
						{receitaTotal > 0 && lucroTotal != null && (
							<MetricCard
								label="Margem este mês"
								value={`${Math.round((lucroTotal / receitaTotal) * 100)}%`}
								highlight={lucroTotal >= 0}
								danger={lucroTotal < 0}
							/>
						)}
					</div>
				)}
			</div>

			<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3 flex flex-col w-52 shrink-0">
				<p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">Por canal</p>
				{topCanais.length === 0 ? (
					<span className="text-xs text-gray-400">Nenhum pedido ainda.</span>
				) : (
					<div className="flex flex-col justify-center flex-1 gap-2.5">
						{topCanais.map(([canal, count]) => {
							const pct = totalCanais > 0 ? Math.round((count / totalCanais) * 100) : 0;
							return (
								<div key={canal} className="flex items-center gap-2">
									<span className="text-xs text-gray-600 w-16 shrink-0">{CANAL_LABEL[canal as CanalPedido] ?? canal}</span>
									<div className="flex-1 bg-[#E6F1FB] rounded-full h-1.5">
										<div className="bg-[#185FA5] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
									</div>
									<span className="text-xs font-semibold text-gray-700">{count}</span>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

function MetricCard({
	label,
	value,
	highlight,
	danger,
}: {
	readonly label: string;
	readonly value: string;
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
		</div>
	);
}
