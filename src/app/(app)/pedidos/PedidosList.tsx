"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import PedidoModal from "./PedidoModal";
import { atualizarStatusPedido, patchPedido } from "./actions";
import { fmtData } from "@/lib/format";
import {
	PEDIDO_STATUS,
	STATUS_COR,
	STATUS_LABEL,
} from "@/modules/pedido/status";

import type { PedidoStatus, CanalPedido, Prioridade, StatusPagamento, FormaPagamento } from "./actions";

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
	forma_pagamento: FormaPagamento | null;
	created_at: string;
	produtos: string[];
	receita: number | null;
	lucro: number | null;
}



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
	const [optimistic, setOptimistic] = useState(status);
	useEffect(() => { setOptimistic(status); }, [status]);
	const displayed = loading ? optimistic : status;
	const [open, setOpen] = useState(false);
	const [menuPos, setMenuPos] = useState<
		{ flipUp: false; top: number; left: number } |
		{ flipUp: true; bottom: number; left: number }
	>({ flipUp: false, top: 0, left: 0 });
	const btnRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function handleClick(e: MouseEvent) {
			const t = e.target as Node;
			const insideBtn = btnRef.current?.contains(t);
			const insideMenu = menuRef.current?.contains(t);
			if (!insideBtn && !insideMenu) setOpen(false);
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
		const estimatedMenuHeight = PEDIDO_STATUS.length * 30 + 16;
		const flipUp = r.bottom + estimatedMenuHeight > window.innerHeight;
		if (flipUp) {
			setMenuPos({ flipUp: true, bottom: window.innerHeight - r.top + 4, left: r.left });
		} else {
			setMenuPos({ flipUp: false, top: r.bottom + 4, left: r.left });
		}
		setOpen(v => !v);
	}

	const isFinal = displayed === "ENTREGUE" || displayed === "CANCELADO";

	return (
		<>
			<button
				ref={btnRef}
				type="button"
				disabled={loading || isFinal}
				onClick={handleToggle}
				className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${STATUS_COR[displayed]} ${
					isFinal ? "cursor-default" : "cursor-pointer hover:brightness-95"
				} ${loading ? "opacity-50" : ""}`}
			>
				{loading ? "…" : STATUS_LABEL[displayed]}
				{!isFinal && <span className="ml-1 opacity-60">▾</span>}
			</button>

			{open && createPortal(
				<div
					ref={menuRef}
					style={menuPos.flipUp
						? { position: "fixed", bottom: menuPos.bottom, left: menuPos.left }
						: { position: "fixed", top: menuPos.top, left: menuPos.left }
					}
					className="z-50 bg-white border border-[#B5D4F4] rounded-xl shadow-lg py-1 min-w-40"
				>
					{PEDIDO_STATUS.filter(s => s !== displayed).map(s => (
						<button
							key={s}
							type="button"
							onClick={() => {
								setOpen(false);
								setOptimistic(s);
								onSelect(pedidoId, s);
							}}
							className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-[#F4F8FD] flex items-center gap-2 ${
								s === "CANCELADO" ? "text-red-600 border-t border-[#E6F1FB] mt-1 pt-2" : "text-gray-700"
							}`}
						>
							<span className={`inline-block w-2 h-2 rounded-full border ${STATUS_COR[s]}`} />
							{STATUS_LABEL[s]}
						</button>
					))}
				</div>,
				document.body
			)}
		</>
	);
}

const inlineSelect = "text-sm bg-transparent border-0 outline-none cursor-pointer hover:text-[#185FA5] text-gray-700 p-0 appearance-none";

const STATUS_PAG_COLOR: Record<StatusPagamento, string> = {
	PENDENTE: "text-amber-600",
	SINAL_RECEBIDO: "text-blue-600",
	PAGO: "text-green-600",
};

function FormaPagCell({
	pedidoId,
	forma,
	onSave,
}: {
	readonly pedidoId: string;
	readonly forma: FormaPagamento | null;
	readonly onSave: (pedidoId: string, forma: FormaPagamento | null) => void;
}) {
	const [value, setValue] = useState(forma);
	useEffect(() => { setValue(forma); }, [forma]);
	return (
		<select
			value={value ?? ""}
			onChange={e => {
				const v = (e.target.value as FormaPagamento) || null;
				setValue(v);
				onSave(pedidoId, v);
			}}
			className={`${inlineSelect} text-xs`}
		>
			<option value="">—</option>
			<option value="PIX">Pix</option>
			<option value="DINHEIRO">Dinheiro</option>
			<option value="CARTAO">Cartão</option>
			<option value="OUTRO">Outro</option>
		</select>
	);
}

function StatusPagCell({
	pedidoId,
	statusPag,
	onSave,
}: {
	readonly pedidoId: string;
	readonly statusPag: StatusPagamento;
	readonly onSave: (pedidoId: string, s: StatusPagamento) => void;
}) {
	const [value, setValue] = useState(statusPag);
	useEffect(() => { setValue(statusPag); }, [statusPag]);
	return (
		<select
			value={value}
			onChange={e => {
				const v = e.target.value as StatusPagamento;
				setValue(v);
				onSave(pedidoId, v);
			}}
			className={`${inlineSelect} text-xs font-medium ${STATUS_PAG_COLOR[value]}`}
		>
			<option value="PENDENTE">Pendente</option>
			<option value="SINAL_RECEBIDO">Sinal</option>
			<option value="PAGO">Pago</option>
		</select>
	);
}

function CanalCell({
	pedidoId,
	canal,
	onSave,
}: {
	readonly pedidoId: string;
	readonly canal: CanalPedido;
	readonly onSave: (pedidoId: string, canal: CanalPedido) => void;
}) {
	return (
		<select
			value={canal}
			onChange={e => onSave(pedidoId, e.target.value as CanalPedido)}
			className={inlineSelect}
		>
			<option value="PRESENCIAL">Presencial</option>
			<option value="WHATSAPP">WhatsApp</option>
			<option value="INSTAGRAM">Instagram</option>
			<option value="SHOPEE">Shopee</option>
		</select>
	);
}

function PrazoCell({
	pedidoId,
	dataPrazo,
	atrasado,
	onSave,
}: {
	readonly pedidoId: string;
	readonly dataPrazo: string | null;
	readonly atrasado: boolean | "" | null;
	readonly onSave: (pedidoId: string, data: string | null) => void;
}) {
	const ref = useRef<HTMLInputElement>(null);
	let colorClass = "text-gray-400";
	if (atrasado) colorClass = "text-red-600 font-medium";
	else if (dataPrazo) colorClass = "text-gray-700";

	let label = "—";
	if (dataPrazo) label = atrasado ? `${fmtData(dataPrazo)} ⚠` : fmtData(dataPrazo);

	function handleClick() { ref.current?.showPicker?.(); ref.current?.focus(); }
	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" || e.key === " ") handleClick();
	}

	return (
		<span
			role="button"
			tabIndex={0}
			className={`relative inline-flex items-center gap-1 cursor-pointer hover:underline text-sm ${colorClass}`}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
		>
			{label}
			<input
				ref={ref}
				type="date"
				defaultValue={dataPrazo?.slice(0, 10) ?? ""}
				onBlur={e => onSave(pedidoId, e.target.value || null)}
				className="sr-only"
			/>
		</span>
	);
}

export default function PedidosList({ pedidos }: Props) {
	const [novoOpen, setNovoOpen] = useState(false);
	const [filtroStatus, setFiltroStatus] = useState<PedidoStatus | "">("");
	const [busca, setBusca] = useState("");
	const [advancing, setAdvancing] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const router = useRouter();
	const { showToast } = useToast();

	const normalize = (s: string) =>
		s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

	const exibidos = (() => {
		const q = normalize(busca.trim());
		if (q) {
			return pedidos.filter(p =>
				normalize(p.numero_pedido).includes(q) ||
				normalize(p.cliente_nome ?? "").includes(q) ||
				p.produtos.some(nome => normalize(nome).includes(q))
			);
		}
		if (filtroStatus) return pedidos.filter(p => p.status === filtroStatus);
		return pedidos.filter(p => p.status !== "ENTREGUE" && p.status !== "CANCELADO");
	})();

	const ativos = pedidos.filter(
		p => p.status !== "ENTREGUE" && p.status !== "CANCELADO"
	).length;

	function handlePatch(pedidoId: string, campos: Parameters<typeof patchPedido>[1]) {
		startTransition(async () => {
			try {
				await patchPedido(pedidoId, campos);
				router.refresh();
			} catch {
				showToast("Erro ao atualizar pedido", "error");
			}
		});
	}

	function handleStatusSelect(pedidoId: string, novoStatus: PedidoStatus) {
		setAdvancing(pedidoId);
		startTransition(async () => {
			try {
				await atualizarStatusPedido(pedidoId, novoStatus);
				showToast(`Status: "${STATUS_LABEL[novoStatus]}"`, "success");
				router.refresh();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error("[handleStatusSelect]", msg);
				showToast(`Erro: ${msg}`, "error");
				router.refresh();
			} finally {
				setAdvancing(null);
			}
		});
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-2 flex-wrap">
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
								onClick={() => setFiltroStatus(prev => (prev === s ? "" : s))}
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
				<div className="flex items-center gap-2 shrink-0">
					<input
						type="search"
						value={busca}
						onChange={e => setBusca(e.target.value)}
						placeholder="Buscar pedido..."
						className="w-44 text-sm rounded-lg border border-[#B5D4F4] px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
					/>
					<Button variant="primary" size="sm" onClick={() => setNovoOpen(true)}>
						+ Novo pedido
					</Button>
				</div>
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
							<th className="px-4 py-3 font-medium">Pagamento</th>
							<th className="px-4 py-3 font-medium text-right">Financeiro</th>
						</tr>
					</thead>
					<tbody>
						{exibidos.length === 0 && (
							<tr>
								<td
									colSpan={7}
									className="px-4 py-8 text-center text-gray-400 text-sm"
								>
									{"Nenhum pedido ativo. Crie um novo pedido."}
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
											className="font-medium text-[#185FA5] hover:underline uppercase"
										>
											{p.produtos[0] ?? p.numero_pedido}
										</Link>
										{p.prioridade !== "NORMAL" && (
											<span
												className={`ml-2 text-xs font-semibold ${PRIORIDADE_STYLE[p.prioridade]}`}
											>
												{PRIORIDADE_LABEL[p.prioridade]}
											</span>
										)}
										<div className="text-xs text-gray-400 mt-0.5">
											{p.numero_pedido} · {fmtData(p.data_pedido)}
										</div>
									</td>
									<td className="px-4 py-3 text-gray-900">
										{p.cliente_nome ?? (
											<span className="text-gray-400">—</span>
										)}
									</td>
									<td className="px-4 py-3">
										<CanalCell
											pedidoId={p.pedido_id}
											canal={p.canal}
											onSave={(id, canal) => handlePatch(id, { canal })}
										/>
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
										<PrazoCell
											pedidoId={p.pedido_id}
											dataPrazo={p.data_prazo}
											atrasado={atrasado}
											onSave={(id, data) => handlePatch(id, { data_prazo: data })}
										/>
									</td>
									<td className="px-4 py-3">
										<div className="flex flex-col gap-0.5">
											<FormaPagCell
												pedidoId={p.pedido_id}
												forma={p.forma_pagamento}
												onSave={(id, forma) => handlePatch(id, { forma_pagamento: forma })}
											/>
											<StatusPagCell
												pedidoId={p.pedido_id}
												statusPag={p.status_pagamento}
												onSave={(id, s) => handlePatch(id, { status_pagamento: s })}
											/>
										</div>
									</td>
									<td className="px-4 py-3 text-right">
										{p.receita != null ? (
											<div>
												<div className="text-sm font-medium text-gray-900">
													{p.receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
												</div>
												{p.lucro != null && (
													<div className={`text-xs font-medium ${p.lucro >= 0 ? "text-green-600" : "text-red-500"}`}>
														{p.lucro >= 0 ? `+${p.lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : p.lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
													</div>
												)}
											</div>
										) : (
											<span className="text-gray-300">—</span>
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
