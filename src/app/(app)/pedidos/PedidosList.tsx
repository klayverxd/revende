"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
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

const ALL_STATUSES_WITH_CANCEL: PedidoStatus[] = [...STATUS_ORDER, "CANCELADO"];

const STATUS_COLOR: Record<PedidoStatus, string> = {
	NOVO: "bg-blue-50 text-blue-700 border-blue-200",
	EM_MODELAGEM: "bg-gray-100 text-gray-700 border-gray-200",
	AGUARDANDO_IMPRESSAO: "bg-amber-50 text-amber-700 border-amber-200",
	IMPRIMINDO: "bg-orange-50 text-orange-700 border-orange-200",
	EM_ACABAMENTO: "bg-yellow-50 text-yellow-700 border-yellow-200",
	PRONTO: "bg-teal-50 text-teal-700 border-teal-200",
	ENVIADO: "bg-indigo-50 text-indigo-700 border-indigo-200",
	ENTREGUE: "bg-green-50 text-green-700 border-green-200",
	CANCELADO: "bg-red-50 text-red-700 border-red-200",
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

function StatusDropdown({
	pedidoId,
	status,
	onSelect,
	loading,
}: {
	readonly pedidoId: string;
	readonly status: PedidoStatus;
	readonly onSelect: (pedidoId: string, s: PedidoStatus) => void;
	readonly loading: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [menuPos, setMenuPos] = useState<
		{ flipUp: false; top: number; left: number } |
		{ flipUp: true; bottom: number; left: number }
	>({ flipUp: false, top: 0, left: 0 });
	const btnRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		function handleClick(e: MouseEvent) {
			if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
		}
		function handleScroll() { setOpen(false); }
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("scroll", handleScroll, true);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("scroll", handleScroll, true);
		};
	}, [open]);

	function handleToggle() {
		if (!btnRef.current) return;
		const r = btnRef.current.getBoundingClientRect();
		const estimatedMenuHeight = ALL_STATUSES_WITH_CANCEL.length * 30 + 16;
		const flipUp = r.bottom + estimatedMenuHeight > window.innerHeight;
		if (flipUp) {
			setMenuPos({ flipUp: true, bottom: window.innerHeight - r.top + 4, left: r.left });
		} else {
			setMenuPos({ flipUp: false, top: r.bottom + 4, left: r.left });
		}
		setOpen(v => !v);
	}

	const isFinal = status === "ENTREGUE" || status === "CANCELADO";

	return (
		<>
			<button
				ref={btnRef}
				type="button"
				disabled={loading || isFinal}
				onClick={handleToggle}
				className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${STATUS_COLOR[status]} ${
					isFinal ? "cursor-default" : "cursor-pointer hover:brightness-95"
				} ${loading ? "opacity-50" : ""}`}
			>
				{loading ? "…" : STATUS_LABEL[status]}
				{!isFinal && <span className="ml-1 opacity-60">▾</span>}
			</button>

			{open && createPortal(
				<div
					style={menuPos.flipUp
						? { position: "fixed", bottom: menuPos.bottom, left: menuPos.left }
						: { position: "fixed", top: menuPos.top, left: menuPos.left }
					}
					className="z-50 bg-white border border-[#B5D4F4] rounded-xl shadow-lg py-1 min-w-40"
				>
					{ALL_STATUSES_WITH_CANCEL.filter(s => s !== status).map(s => (
						<button
							key={s}
							type="button"
							onClick={() => {
								setOpen(false);
								onSelect(pedidoId, s);
							}}
							className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-[#F4F8FD] flex items-center gap-2 ${
								s === "CANCELADO" ? "text-red-600 border-t border-[#E6F1FB] mt-1 pt-2" : "text-gray-700"
							}`}
						>
							<span className={`inline-block w-2 h-2 rounded-full border ${STATUS_COLOR[s]}`} />
							{STATUS_LABEL[s]}
						</button>
					))}
				</div>,
				document.body
			)}
		</>
	);
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

	function handleStatusSelect(pedidoId: string, novoStatus: PedidoStatus) {
		setAdvancing(pedidoId);
		startTransition(async () => {
			try {
				await atualizarStatusPedido(pedidoId, novoStatus);
				showToast(`Status: "${STATUS_LABEL[novoStatus]}"`, "success");
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
						</tr>
					</thead>
					<tbody>
						{exibidos.length === 0 && (
							<tr>
								<td
									colSpan={5}
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
								p.status !== "ENVIADO" &&
								p.status !== "ENTREGUE" &&
								p.status !== "CANCELADO" &&
								new Date(`${p.data_prazo.slice(0, 10)}T00:00:00`) < new Date();
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
											{new Date(`${p.data_pedido.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR")}
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
										<StatusDropdown
											pedidoId={p.pedido_id}
											status={p.status}
											onSelect={handleStatusSelect}
											loading={isAdvancing}
										/>
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
												{new Date(`${p.data_prazo.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR")}
												{atrasado && " ⚠"}
											</span>
										) : (
											<span className="text-gray-400">—</span>
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
