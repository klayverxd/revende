import Link from "next/link";
import type { PedidoFinanceiroRow } from "./actions";
import { fmtData } from "@/lib/utils/data";

const CANAL_LABEL: Record<string, string> = {
	PRESENCIAL: "Presencial",
	WHATSAPP: "WhatsApp",
	INSTAGRAM: "Instagram",
	SHOPEE: "Shopee",
};

const STATUS_LABEL: Record<string, string> = {
	NOVO: "Novo",
	EM_MODELAGEM: "Em modelagem",
	AGUARDANDO_IMPRESSAO: "Ag. impressão",
	IMPRIMINDO: "Imprimindo",
	EM_ACABAMENTO: "Em acabamento",
	PRONTO: "Pronto",
	ENVIADO: "Enviado",
	ENTREGUE: "Entregue",
};

function fmtBRL(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
	readonly data: {
		receitaTotal: number;
		custoTotal: number;
		lucroTotal: number;
		margem: number | null;
		porCanal: Array<{ canal: string; count: number; receita: number }>;
		pedidos: PedidoFinanceiroRow[];
	};
}

function KpiCard({ label, value, sub, highlight, danger }: {
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

export default function PedidosTab({ data }: Props) {
	const { receitaTotal, custoTotal, lucroTotal, margem, porCanal, pedidos } = data;
	const maxReceita = Math.max(...porCanal.map(c => c.receita), 1);

	return (
		<div className="flex flex-col gap-4">
			{/* KPIs */}
			<div className="flex gap-3 items-stretch">
				<div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
					<KpiCard label="Receita" value={fmtBRL(receitaTotal)} highlight />
					<KpiCard label="Custos" value={fmtBRL(custoTotal)} />
					<KpiCard
						label="Lucro"
						value={fmtBRL(lucroTotal)}
						highlight={lucroTotal >= 0}
						danger={lucroTotal < 0}
					/>
					<KpiCard
						label="Margem"
						value={margem == null ? "—" : `${Math.round(margem * 100)}%`}
						highlight={margem != null && margem >= 0}
						danger={margem != null && margem < 0}
					/>
				</div>

				{/* Canal chart */}
				{porCanal.length > 0 && (
					<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3 flex flex-col w-52 shrink-0">
						<p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">Por canal</p>
						<div className="flex flex-col justify-center flex-1 gap-2.5">
							{porCanal.map(c => {
								const pct = maxReceita > 0 ? Math.round((c.receita / maxReceita) * 100) : 0;
								return (
									<div key={c.canal} className="flex items-center gap-2">
										<span className="text-xs text-gray-600 w-16 shrink-0">{CANAL_LABEL[c.canal] ?? c.canal}</span>
										<div className="flex-1 bg-[#E6F1FB] rounded-full h-1.5">
											<div className="bg-[#185FA5] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
										</div>
										<span className="text-xs font-semibold text-gray-700">{c.count}</span>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>

			{/* Tabela de pedidos */}
			<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-[#F4F8FD]">
						<tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
							<th className="px-4 py-3 font-medium">Pedido</th>
							<th className="px-4 py-3 font-medium">Cliente</th>
							<th className="px-4 py-3 font-medium">Canal</th>
							<th className="px-4 py-3 font-medium">Status</th>
							<th className="px-4 py-3 font-medium text-right">Receita</th>
							<th className="px-4 py-3 font-medium text-right">Custo</th>
							<th className="px-4 py-3 font-medium text-right">Lucro</th>
						</tr>
					</thead>
					<tbody>
						{pedidos.length === 0 && (
							<tr>
								<td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
									Nenhum pedido neste período.
								</td>
							</tr>
						)}
						{pedidos.map(p => (
							<tr key={p.pedido_id} className="border-t border-[#E6F1FB] hover:bg-[#F4F8FD] transition-colors">
								<td className="px-4 py-3">
									<Link href={`/pedidos/${p.pedido_id}`} className="font-medium text-[#185FA5] hover:underline">
										{p.numero_pedido}
									</Link>
									<div className="text-xs text-gray-400 mt-0.5">{fmtData(p.data_pedido)}</div>
								</td>
								<td className="px-4 py-3 text-gray-700">{p.cliente_nome ?? <span className="text-gray-400">—</span>}</td>
								<td className="px-4 py-3 text-gray-600 text-xs">{CANAL_LABEL[p.canal] ?? p.canal}</td>
								<td className="px-4 py-3 text-gray-600 text-xs">{STATUS_LABEL[p.status] ?? p.status}</td>
								<td className="px-4 py-3 text-right font-medium text-gray-900">{fmtBRL(p.receita)}</td>
								<td className="px-4 py-3 text-right text-gray-500">{fmtBRL(p.custo)}</td>
								<td className={`px-4 py-3 text-right font-semibold ${p.lucro >= 0 ? "text-green-700" : "text-red-600"}`}>
									{p.lucro >= 0 ? "+" : ""}{fmtBRL(p.lucro)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
