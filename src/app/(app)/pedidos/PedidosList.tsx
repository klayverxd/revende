"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Badge, useToast } from "@/components/ui";
import PedidoModal from "./PedidoModal";
import { atualizarStatusPedido } from "./actions";
import type { PedidoStatus, CanalPedido, Prioridade, StatusPagamento } from "./actions";

export interface PedidoRow {
	pedido_id: string;
	numero_pedido: string;
	data_pedido: string;
	data_prazo: string | null;
	canal: CanalPedido;
	status: PedidoStatus;
	prioridade: Prioridade;
	cliente_nome: string | null;
	status_pagamento: StatusPagamento;
	created_at: string;
}

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


const STATUS_ORDER: PedidoStatus[] = [
	"NOVO",
	"EM_MODELAGEM",
	"AGUARDANDO_IMPRESSAO",
	"IMPRIMINDO",
	"EM_ACABAMENTO",
	"PRONTO",
	"ENVIADO",
	"ENTREGUE",
];

const STATUS_VARIANT: Record<
	PedidoStatus,
	"neutral" | "success" | "warning" | "danger" | "info"
> = {
	NOVO: "info",
	EM_MODELAGEM: "neutral",
	AGUARDANDO_IMPRESSAO: "warning",
	IMPRIMINDO: "warning",
	EM_ACABAMENTO: "warning",
	PRONTO: "success",
	ENVIADO: "info",
	ENTREGUE: "success",
	CANCELADO: "danger",
};

const CANAL_LABEL: Record<CanalPedido, string> = {
	PRESENCIAL: "Presencial",
	WHATSAPP: "WhatsApp",
	INSTAGRAM: "Instagram",
	SHOPEE: "Shopee",
};

const PRIORIDADE_STYLE: Record<Prioridade, string> = {
	NORMAL: "text-gray-400",
	ALTA: "text-amber-500",
	URGENTE: "text-red-500",
};

const PRIORIDADE_LABEL: Record<Prioridade, string> = {
	NORMAL: "",
	ALTA: "Alta",
	URGENTE: "Urgente",
};

const ALL_STATUSES: PedidoStatus[] = [
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

interface Props {
	readonly pedidos: PedidoRow[];
}

function futureStatuses(current: PedidoStatus): PedidoStatus[] {
	const idx = STATUS_ORDER.indexOf(current);
	if (idx === -1) return [];
	return STATUS_ORDER.slice(idx + 1);
}

export default function PedidosList({ pedidos }: Props) {
	const [novoOpen, setNovoOpen] = useState(false);
	const [filtroStatus, setFiltroStatus] = useState<PedidoStatus | "">("");
	const [advancing, setAdvancing] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const router = useRouter();
	const { showToast } = useToast();

	const exibidos = filtroStatus
		? pedidos.filter(p => p.status === filtroStatus)
		: pedidos.filter(p => p.status !== "ENTREGUE" && p.status !== "CANCELADO");

	const ativos = pedidos.filter(
		p => p.status !== "ENTREGUE" && p.status !== "CANCELADO"
	).length;

	function handleAvançar(pedidoId: string, proximo: PedidoStatus) {
		setAdvancing(pedidoId);
		startTransition(async () => {
			try {
				await atualizarStatusPedido(pedidoId, proximo);
				showToast(`Avançado para "${STATUS_LABEL[proximo]}"`, "success");
				router.refresh();
			} catch {
				showToast("Erro ao atualizar status", "error");
			} finally {
				setAdvancing(null);
			}
		});
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2 justify-between">
				<div className="flex flex-wrap gap-1.5">
					<button
						type="button"
						onClick={() => setFiltroStatus("")}
						className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
							filtroStatus === ""
								? "bg-[#185FA5] text-white border-[#185FA5]"
								: "bg-white text-gray-600 border-[#B5D4F4] hover:bg-[#E6F1FB]"
						}`}
					>
						Ativos ({ativos})
					</button>
					{ALL_STATUSES.map(s => {
						const count = pedidos.filter(p => p.status === s).length;
						if (count === 0) return null;
						return (
							<button
								key={s}
								type="button"
								onClick={() =>
									setFiltroStatus(prev => (prev === s ? "" : s))
								}
								className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
									filtroStatus === s
										? "bg-[#185FA5] text-white border-[#185FA5]"
										: "bg-white text-gray-600 border-[#B5D4F4] hover:bg-[#E6F1FB]"
								}`}
							>
								{STATUS_LABEL[s]} ({count})
							</button>
						);
					})}
				</div>
				<Button variant="primary" size="sm" onClick={() => setNovoOpen(true)}>
					+ Novo pedido
				</Button>
			</div>

			<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-[#F4F8FD]">
						<tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
							<th className="px-4 py-3 font-medium">Pedido</th>
							<th className="px-4 py-3 font-medium">Cliente</th>
							<th className="px-4 py-3 font-medium">Canal</th>
							<th className="px-4 py-3 font-medium">Status</th>
							<th className="px-4 py-3 font-medium">Prazo</th>
							<th className="px-4 py-3 font-medium" />
						</tr>
					</thead>
					<tbody>
						{exibidos.length === 0 && (
							<tr>
								<td
									colSpan={6}
									className="px-4 py-8 text-center text-gray-400 text-sm"
								>
									{filtroStatus
										? "Nenhum pedido com este status."
										: "Nenhum pedido ativo. Crie um novo pedido."}
								</td>
							</tr>
						)}
						{exibidos.map(p => {
							const atrasado =
								p.data_prazo &&
								p.status !== "ENTREGUE" &&
								p.status !== "CANCELADO" &&
								new Date(p.data_prazo) < new Date();
							const isAdvancing = advancing === p.pedido_id && isPending;
							return (
								<tr
									key={p.pedido_id}
									className="border-t border-[#E6F1FB] hover:bg-[#F4F8FD] transition-colors"
								>
									<td className="px-4 py-3">
										<Link
											href={`/pedidos/${p.pedido_id}`}
											className="font-mono font-medium text-[#185FA5] hover:underline"
										>
											{p.numero_pedido}
										</Link>
										{p.prioridade !== "NORMAL" && (
											<span
												className={`ml-2 text-xs font-semibold ${PRIORIDADE_STYLE[p.prioridade]}`}
											>
												{PRIORIDADE_LABEL[p.prioridade]}
											</span>
										)}
										<div className="text-xs text-gray-400 mt-0.5">
											{new Date(p.data_pedido).toLocaleDateString("pt-BR")}
										</div>
									</td>
									<td className="px-4 py-3 text-gray-900">
										{p.cliente_nome ?? (
											<span className="text-gray-400">—</span>
										)}
									</td>
									<td className="px-4 py-3 text-gray-700">
										{CANAL_LABEL[p.canal]}
									</td>
									<td className="px-4 py-3">
										<Badge variant={STATUS_VARIANT[p.status]}>
											{STATUS_LABEL[p.status]}
										</Badge>
									</td>
									<td className="px-4 py-3">
										{p.data_prazo ? (
											<span
												className={
													atrasado
														? "text-red-600 font-medium"
														: "text-gray-700"
												}
											>
												{new Date(p.data_prazo).toLocaleDateString("pt-BR")}
												{atrasado && " ⚠"}
											</span>
										) : (
											<span className="text-gray-400">—</span>
										)}
									</td>
									<td className="px-4 py-3 text-right">
										{futureStatuses(p.status).length > 0 && (
											<select
												disabled={isAdvancing}
												value=""
												onChange={e => {
													if (e.target.value)
														handleAvançar(p.pedido_id, e.target.value as PedidoStatus);
												}}
												className="text-xs border border-[#B5D4F4] rounded-lg px-2 py-1 text-[#185FA5] bg-white hover:bg-[#E6F1FB] transition-colors disabled:opacity-50 cursor-pointer"
											>
												<option value="" disabled>
													{isAdvancing ? "…" : "Avançar →"}
												</option>
												{futureStatuses(p.status).map(s => (
													<option key={s} value={s}>
														{STATUS_LABEL[s]}
													</option>
												))}
											</select>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<PedidoModal open={novoOpen} onClose={() => setNovoOpen(false)} />
		</div>
	);
}
