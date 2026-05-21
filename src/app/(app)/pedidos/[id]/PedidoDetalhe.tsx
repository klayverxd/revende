"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Badge, useToast } from "@/components/ui";
import PedidoModal from "../PedidoModal";
import { atualizarStatusPedido, deletarPedido } from "../actions";
import type {
	PedidoStatus,
	CanalPedido,
	FormaPagamento,
	Prioridade,
	StatusPagamento,
} from "../actions";

type ItemModelo = { codigo: string; nome: string } | null;

interface Item {
	item_id: string;
	tipo: string;
	modelo_id: string | null;
	descricao_custom: string | null;
	tempo_impressao_min: number | null;
	peso_g: number | null;
	num_placas: number | null;
	quantidade: number;
	preco_venda_unit: number | null;
	custo_unit: number | null;
	observacao: string | null;
	modelo: ItemModelo | ItemModelo[];
}

interface Pedido {
	pedido_id: string;
	numero_pedido: string;
	data_pedido: string;
	data_prazo: string | null;
	data_inicio_producao: string | null;
	data_conclusao_producao: string | null;
	data_entrega: string | null;
	canal: CanalPedido;
	status: PedidoStatus;
	prioridade: Prioridade;
	cliente_nome: string | null;
	cliente_telefone: string | null;
	cliente_email: string | null;
	cliente_referencia: string | null;
	forma_pagamento: FormaPagamento | null;
	status_pagamento: StatusPagamento;
	valor_sinal: number | null;
	desconto_valor: number | null;
	observacao: string | null;
	created_at: string;
	updated_at: string;
	itens: Item[];
}

interface Props {
	readonly pedido: Pedido;
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

const PAGAMENTO_LABEL: Record<StatusPagamento, string> = {
	PENDENTE: "Pendente",
	SINAL_RECEBIDO: "Sinal recebido",
	PAGO: "Pago",
};

const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
	PIX: "PIX",
	DINHEIRO: "Dinheiro",
	CARTAO: "Cartão",
	OUTRO: "Outro",
};

function pagamentoVariant(s: StatusPagamento): "success" | "warning" | "neutral" {
	if (s === "PAGO") return "success";
	if (s === "SINAL_RECEBIDO") return "warning";
	return "neutral";
}

function fmt(v: number | null | undefined) {
	if (v == null) return "—";
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string | null | undefined) {
	if (!s) return "—";
	return new Date(`${s.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
}

function getModeloInfo(item: Item): ItemModelo {
	if (Array.isArray(item.modelo)) return item.modelo[0] ?? null;
	return item.modelo;
}

export default function PedidoDetalhe({ pedido }: Props) {
	const { showToast } = useToast();
	const router = useRouter();
	const [editOpen, setEditOpen] = useState(false);
	const [updating, setUpdating] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const currentIdx = STATUS_ORDER.indexOf(pedido.status);

	async function handleStatusChange(status: PedidoStatus) {
		setUpdating(true);
		try {
			await atualizarStatusPedido(pedido.pedido_id, status);
			showToast(`Status atualizado para "${STATUS_LABEL[status]}"`, "success");
			router.refresh();
		} catch {
			showToast("Erro ao atualizar status", "error");
		} finally {
			setUpdating(false);
		}
	}

	async function handleDelete() {
		try {
			await deletarPedido(pedido.pedido_id);
			showToast("Pedido excluído", "success");
			router.push("/pedidos");
		} catch {
			showToast("Erro ao excluir pedido", "error");
		}
	}

	const pedidoParaEditar = {
		pedido_id: pedido.pedido_id,
		numero_pedido: pedido.numero_pedido,
		canal: pedido.canal,
		prioridade: pedido.prioridade,
		data_pedido: pedido.data_pedido,
		cliente_nome: pedido.cliente_nome,
		cliente_telefone: pedido.cliente_telefone,
		cliente_email: pedido.cliente_email,
		cliente_referencia: pedido.cliente_referencia,
		data_prazo: pedido.data_prazo,
		forma_pagamento: pedido.forma_pagamento,
		status_pagamento: pedido.status_pagamento,
		valor_sinal: pedido.valor_sinal,
		desconto_valor: pedido.desconto_valor,
		observacao: pedido.observacao,
		itens: pedido.itens.map(i => ({
			tipo: i.tipo as "PRODUTO" | "CORINGA",
			modelo_id: i.modelo_id,
			descricao_custom: i.descricao_custom,
			tempo_impressao_min: i.tempo_impressao_min,
			peso_g: i.peso_g,
			num_placas: i.num_placas,
			quantidade: i.quantidade,
			preco_venda_unit: i.preco_venda_unit,
			custo_unit: i.custo_unit,
			observacao: i.observacao,
		})),
	};

	return (
		<div className="flex flex-col gap-6 max-w-2xl">
			<div className="flex items-start justify-between gap-4">
				<div>
					<Link
						href="/pedidos"
						className="text-xs text-[#378ADD] hover:underline"
					>
						← Pedidos
					</Link>
					<h1 className="text-xl font-semibold text-gray-900 mt-1 font-mono">
						{pedido.numero_pedido}
					</h1>
					<div className="flex items-center gap-2 mt-1">
						<Badge variant={STATUS_VARIANT[pedido.status]}>
							{STATUS_LABEL[pedido.status]}
						</Badge>
						{pedido.prioridade !== "NORMAL" && (
							<span
								className={`text-xs font-semibold ${pedido.prioridade === "URGENTE" ? "text-red-500" : "text-amber-500"}`}
							>
								{pedido.prioridade === "URGENTE" ? "Urgente" : "Alta prioridade"}
							</span>
						)}
					</div>
				</div>
				<div className="flex gap-2 shrink-0">
					<Button
						variant="secondary"
						size="sm"
						onClick={() => setEditOpen(true)}
					>
						Editar
					</Button>
					<Button
						variant="danger"
						size="sm"
						onClick={() => setConfirmDelete(true)}
					>
						Excluir
					</Button>
				</div>
			</div>

			{/* Esteira de status */}
			{pedido.status !== "CANCELADO" && (
				<div className="bg-white rounded-xl border border-[#B5D4F4] p-4">
					<p className="text-xs font-semibold uppercase tracking-wide text-[#185FA5] mb-3">
						Progresso
					</p>
					<div className="flex items-center gap-1 flex-wrap">
						{STATUS_ORDER.map((s, i) => {
							const done = i < currentIdx;
							const active = i === currentIdx;
							const future = i > currentIdx;
							let stepClass = "bg-gray-50 text-gray-400 border-gray-200 cursor-default";
							if (done) stepClass = "bg-green-50 text-green-700 border-green-200";
							else if (active) stepClass = "bg-[#185FA5] text-white border-[#185FA5]";
							else if (future) stepClass = "bg-white text-[#185FA5] border-[#185FA5] cursor-pointer hover:bg-[#E6F1FB]";
							return (
								<button
									key={s}
									type="button"
									disabled={!future || updating}
									onClick={() => future && handleStatusChange(s)}
									title={future ? `Avançar para "${STATUS_LABEL[s]}"` : undefined}
									className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${stepClass}`}
								>
									{STATUS_LABEL[s]}
								</button>
							);
						})}
						{pedido.status !== "ENTREGUE" && (
							<button
								type="button"
								disabled={updating}
								onClick={() => handleStatusChange("CANCELADO")}
								className="text-xs px-2.5 py-1 rounded-full border font-medium text-red-400 border-red-200 hover:bg-red-50 transition-colors ml-auto"
							>
								Cancelar pedido
							</button>
						)}
					</div>
				</div>
			)}

			{/* Dados gerais */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Card title="Identificação">
					<DescList>
						<DescTerm>Canal</DescTerm>
						<DescDetail>{CANAL_LABEL[pedido.canal]}</DescDetail>
						<DescTerm>Data do pedido</DescTerm>
						<DescDetail>{fmtDate(pedido.data_pedido)}</DescDetail>
						<DescTerm>Prazo de entrega</DescTerm>
						<DescDetail>
							{pedido.data_prazo ? (
								<span
									className={
										new Date(`${pedido.data_prazo.slice(0, 10)}T00:00:00`) < new Date() &&
										pedido.status !== "ENTREGUE" &&
										pedido.status !== "CANCELADO"
											? "text-red-600 font-medium"
											: undefined
									}
								>
									{fmtDate(pedido.data_prazo)}
								</span>
							) : (
								"—"
							)}
						</DescDetail>
						{Boolean(pedido.data_inicio_producao) && (
							<>
								<DescTerm>Início produção</DescTerm>
								<DescDetail>{fmtDate(pedido.data_inicio_producao)}</DescDetail>
							</>
						)}
						{Boolean(pedido.data_conclusao_producao) && (
							<>
								<DescTerm>Conclusão produção</DescTerm>
								<DescDetail>{fmtDate(pedido.data_conclusao_producao)}</DescDetail>
							</>
						)}
						{Boolean(pedido.data_entrega) && (
							<>
								<DescTerm>Data de entrega</DescTerm>
								<DescDetail>{fmtDate(pedido.data_entrega)}</DescDetail>
							</>
						)}
					</DescList>
				</Card>

				<Card title="Cliente">
					<DescList>
						<DescTerm>Nome</DescTerm>
						<DescDetail>{pedido.cliente_nome ?? "—"}</DescDetail>
						<DescTerm>Telefone</DescTerm>
						<DescDetail>
							{pedido.cliente_telefone ? (
								<a
									href={`https://wa.me/55${pedido.cliente_telefone.replace(/\D/g, "")}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-[#185FA5] hover:underline"
								>
									{pedido.cliente_telefone}
								</a>
							) : (
								"—"
							)}
						</DescDetail>
						<DescTerm>E-mail</DescTerm>
						<DescDetail>{pedido.cliente_email ?? "—"}</DescDetail>
						<DescTerm>Referência</DescTerm>
						<DescDetail>{pedido.cliente_referencia ?? "—"}</DescDetail>
					</DescList>
				</Card>
			</div>

			{/* Itens */}
			<Card title={`Itens (${pedido.itens.length})`}>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="text-xs text-gray-500 uppercase border-b border-[#E6F1FB]">
								<th className="pb-2 text-left font-medium">Item</th>
								<th className="pb-2 text-center font-medium">Qtd</th>
								<th className="pb-2 text-right font-medium">Preço unit.</th>
								<th className="pb-2 text-right font-medium">Subtotal</th>
							</tr>
						</thead>
						<tbody>
							{pedido.itens.map(item => {
								const modelo = getModeloInfo(item);
								const subtotal = (item.preco_venda_unit ?? 0) * item.quantidade;
								const hasTechInfo =
									item.tempo_impressao_min != null ||
									item.peso_g != null ||
									item.num_placas != null;
								return (
									<tr
										key={item.item_id}
										className="border-b border-[#F4F8FD] last:border-0"
									>
										<td className="py-2 pr-4">
											{item.tipo === "PRODUTO" && modelo ? (
												<div>
													<Link
														href={`/produtos/${item.modelo_id}`}
														className="font-medium text-[#185FA5] hover:underline uppercase"
													>
														{modelo.nome}
													</Link>
													<div className="text-xs text-gray-400">
														{modelo.codigo}
													</div>
												</div>
											) : (
												<div>
													<span className="font-medium text-gray-900">
														{item.descricao_custom ?? "Item personalizado"}
													</span>
													<div className="text-xs text-gray-400">Coringa</div>
												</div>
											)}
											{hasTechInfo && (
												<div className="text-xs text-gray-400 mt-0.5 flex gap-2">
													{item.tempo_impressao_min != null && (
														<span>{item.tempo_impressao_min}min</span>
													)}
													{item.peso_g != null && <span>{item.peso_g}g</span>}
													{item.num_placas != null && (
														<span>{item.num_placas} placas</span>
													)}
												</div>
											)}
										</td>
										<td className="py-2 text-center text-gray-900">
											{item.quantidade}
										</td>
										<td className="py-2 text-right text-gray-700">
											{fmt(item.preco_venda_unit)}
										</td>
										<td className="py-2 text-right font-medium text-gray-900">
											{fmt(subtotal)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</Card>

			{/* Financeiro */}
			<Card title="Financeiro">
				<DescList>
					<DescTerm>Forma de pagamento</DescTerm>
					<DescDetail>
						{pedido.forma_pagamento
							? FORMA_PAGAMENTO_LABEL[pedido.forma_pagamento]
							: "—"}
					</DescDetail>
					<DescTerm>Status do pagamento</DescTerm>
					<DescDetail>
						<Badge variant={pagamentoVariant(pedido.status_pagamento)}>
							{PAGAMENTO_LABEL[pedido.status_pagamento]}
						</Badge>
					</DescDetail>
					{Boolean(pedido.valor_sinal) && (
						<>
							<DescTerm>Sinal / entrada</DescTerm>
							<DescDetail>{fmt(pedido.valor_sinal)}</DescDetail>
						</>
					)}
					{Boolean(pedido.desconto_valor) && (
						<>
							<DescTerm>Desconto</DescTerm>
							<DescDetail>−{fmt(pedido.desconto_valor)}</DescDetail>
						</>
					)}
					<DescTerm>Total</DescTerm>
					<DescDetail className="font-bold text-[#185FA5] text-base">
						{fmt(
							pedido.itens.reduce(
								(sum, it) =>
									sum + (it.preco_venda_unit ?? 0) * (it.quantidade ?? 1),
								0
							) - (pedido.desconto_valor ?? 0)
						)}
					</DescDetail>
				</DescList>
			</Card>

			{Boolean(pedido.observacao) && (
				<Card title="Observações">
					<p className="text-sm text-gray-700 whitespace-pre-wrap">
						{pedido.observacao}
					</p>
				</Card>
			)}

			<PedidoModal
				open={editOpen}
				onClose={() => setEditOpen(false)}
				pedido={pedidoParaEditar}
			/>

			{confirmDelete && (
				<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-lg">
						<h3 className="font-semibold text-gray-900 mb-2">
							Excluir pedido?
						</h3>
						<p className="text-sm text-gray-600 mb-4">
							O pedido {pedido.numero_pedido} será removido. Esta ação não pode
							ser desfeita.
						</p>
						<div className="flex gap-2 justify-end">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setConfirmDelete(false)}
							>
								Cancelar
							</Button>
							<Button variant="danger" size="sm" onClick={handleDelete}>
								Excluir
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function Card({
	title,
	children,
}: {
	readonly title: string;
	readonly children: React.ReactNode;
}) {
	return (
		<div className="bg-white rounded-xl border border-[#B5D4F4] p-5">
			<h3 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5] mb-3">
				{title}
			</h3>
			{children}
		</div>
	);
}

function DescList({ children }: { readonly children: React.ReactNode }) {
	return (
		<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
			{children}
		</dl>
	);
}

function DescTerm({ children }: { readonly children: React.ReactNode }) {
	return (
		<dt className="text-gray-500 text-xs uppercase tracking-wide self-center">
			{children}
		</dt>
	);
}

function DescDetail({
	children,
	className,
}: {
	readonly children: React.ReactNode;
	readonly className?: string;
}) {
	return <dd className={`text-gray-900 ${className ?? ""}`}>{children}</dd>;
}
