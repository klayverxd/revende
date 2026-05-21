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

export default function PedidosDashboard({ dashboard }: Props) {
	const { statusCounts, canalCounts, receitaTotal, pedidosMes, ativos } =
		dashboard;

	const totalPedidos = Object.values(statusCounts).reduce((a, b) => a + b, 0);
	const topCanais = Object.entries(canalCounts)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5);

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				<MetricCard
					label="Total de pedidos"
					value={String(totalPedidos)}
				/>
				<MetricCard label="Ativos (em produção)" value={String(ativos)} />
				<MetricCard label="Pedidos este mês" value={String(pedidosMes)} />
				<MetricCard
					label="Receita este mês"
					value={receitaTotal.toLocaleString("pt-BR", {
						style: "currency",
						currency: "BRL",
					})}
					highlight
				/>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="bg-white rounded-xl border border-[#B5D4F4] p-4">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5] mb-3">
						Por status
					</h3>
					<div className="flex flex-col gap-2">
						{STATUS_ORDER.filter(s => (statusCounts[s] ?? 0) > 0).map(s => (
							<div key={s} className="flex items-center justify-between">
								<span
									className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[s]}`}
								>
									{STATUS_LABEL[s]}
								</span>
								<span className="text-sm font-semibold text-gray-800">
									{statusCounts[s]}
								</span>
							</div>
						))}
						{totalPedidos === 0 && (
							<p className="text-xs text-gray-400">Nenhum pedido ainda.</p>
						)}
					</div>
				</div>

				<div className="bg-white rounded-xl border border-[#B5D4F4] p-4">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5] mb-3">
						Por canal
					</h3>
					<div className="flex flex-col gap-2">
						{topCanais.map(([canal, count]) => (
							<div key={canal} className="flex items-center gap-2">
								<div className="flex-1">
									<div className="flex justify-between mb-0.5">
										<span className="text-xs text-gray-700">
											{CANAL_LABEL[canal as CanalPedido] ?? canal}
										</span>
										<span className="text-xs font-semibold text-gray-800">
											{count}
										</span>
									</div>
									<div className="h-1.5 rounded-full bg-[#E6F1FB]">
										<div
											className="h-1.5 rounded-full bg-[#185FA5]"
											style={{
												width: `${Math.round((count / totalPedidos) * 100)}%`,
											}}
										/>
									</div>
								</div>
							</div>
						))}
						{topCanais.length === 0 && (
							<p className="text-xs text-gray-400">Nenhum pedido ainda.</p>
						)}
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
}: {
	readonly label: string;
	readonly value: string;
	readonly highlight?: boolean;
}) {
	return (
		<div className="bg-white rounded-xl border border-[#B5D4F4] p-4">
			<p className="text-xs text-gray-500 mb-1">{label}</p>
			<p
				className={`text-xl font-bold ${highlight ? "text-[#185FA5]" : "text-gray-900"}`}
			>
				{value}
			</p>
		</div>
	);
}
