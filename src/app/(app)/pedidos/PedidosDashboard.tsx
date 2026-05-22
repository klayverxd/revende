"use client";

import type { PedidoStatus, CanalPedido } from "./actions";

const STATUS_LABEL: Record<PedidoStatus, string> = {
	NOVO: "Novo",
	EM_MODELAGEM: "Em modelagem",
	AGUARDANDO_IMPRESSAO: "Ag. impressão",
	IMPRIMINDO: "Imprimindo",
	EM_ACABAMENTO: "Em acabamento",
	PRONTO: "Pronto",
	ENVIADO: "Enviado",
	ENTREGUE: "Entregue",
	CANCELADO: "Cancelado",
};

const CANAL_LABEL: Record<CanalPedido, string> = {
	PRESENCIAL: "Presencial",
	WHATSAPP: "WhatsApp",
	INSTAGRAM: "Instagram",
	SHOPEE: "Shopee",
};

interface Props {
	readonly dashboard: {
		statusCounts: Record<string, number>;
		canalCounts: Record<string, number>;
		receitaTotal: number;
		custoTotal: number | null;
		lucroTotal: number | null;
		pedidosMes: number;
		ativos: number;
	};
}

const STATUS_ORDER: PedidoStatus[] = [
	"NOVO",
	"EM_MODELAGEM",
	"AGUARDANDO_IMPRESSAO",
	"IMPRIMINDO",
	"EM_ACABAMENTO",
	"PRONTO",
	"ENVIADO",
	"ENTREGUE",
	"CANCELADO",
];

const STATUS_COLOR: Record<PedidoStatus, string> = {
	NOVO: "bg-blue-50 text-blue-800 border-blue-200",
	EM_MODELAGEM: "bg-purple-50 text-purple-800 border-purple-200",
	AGUARDANDO_IMPRESSAO: "bg-amber-50 text-amber-800 border-amber-200",
	IMPRIMINDO: "bg-orange-50 text-orange-800 border-orange-200",
	EM_ACABAMENTO: "bg-yellow-50 text-yellow-800 border-yellow-200",
	PRONTO: "bg-teal-50 text-teal-800 border-teal-200",
	ENVIADO: "bg-indigo-50 text-indigo-800 border-indigo-200",
	ENTREGUE: "bg-green-50 text-green-800 border-green-200",
	CANCELADO: "bg-red-50 text-red-800 border-red-200",
};

function fmtBRL(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PedidosDashboard({ dashboard }: Props) {
	const { statusCounts, canalCounts, receitaTotal, custoTotal, lucroTotal, pedidosMes, ativos } =
		dashboard;

	const totalPedidos = Object.values(statusCounts).reduce((a, b) => a + b, 0);
	const topCanais = Object.entries(canalCounts)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5);

	return (
		<div className="flex flex-col gap-4">
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

			<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3 flex flex-col gap-3">
				{/* Por status */}
				<div className="flex items-start gap-2 flex-wrap">
					<span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 shrink-0 mt-0.5 w-12">Status</span>
					<div className="flex flex-wrap gap-1.5">
						{STATUS_ORDER.filter(s => (statusCounts[s] ?? 0) > 0).map(s => (
							<span key={s} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[s]}`}>
								{STATUS_LABEL[s]} · {statusCounts[s]}
							</span>
						))}
						{totalPedidos === 0 && <span className="text-xs text-gray-400">Nenhum pedido ainda.</span>}
					</div>
				</div>

				{/* Por canal */}
				<div className="flex items-start gap-2 flex-wrap border-t border-[#F4F8FD] pt-3">
					<span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 shrink-0 mt-0.5 w-12">Canal</span>
					<div className="flex flex-wrap gap-1.5">
						{topCanais.map(([canal, count]) => (
							<span key={canal} className="text-xs px-2 py-0.5 rounded-full border border-[#B5D4F4] bg-[#F4F8FD] text-[#185FA5] font-medium">
								{CANAL_LABEL[canal as CanalPedido] ?? canal} · {count}
							</span>
						))}
						{topCanais.length === 0 && <span className="text-xs text-gray-400">Nenhum pedido ainda.</span>}
					</div>
				</div>
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
