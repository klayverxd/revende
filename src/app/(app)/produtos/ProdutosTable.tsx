"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
	Badge,
	BulkActionBar,
	Button,
	Modal,
	RowActionsMenu,
	useToast,
} from "@/components/ui";
import ProdutoModal, { type ProdutoParaEditar } from "./ProdutoModal";
import {
	deletarProdutos,
	ativarProdutos,
	desativarProdutos,
	atualizarCustoEPreco,
	atualizarPrecoAtacado,
} from "./actions";

function parseMonetary(raw: string): number | null {
	const n = Number.parseFloat(
		raw.replaceAll(",", ".").replaceAll(/[^0-9.]/g, "")
	);
	return Number.isFinite(n) && n >= 0 ? n : null;
}

interface InlinePriceProps {
	readonly value: number | null;
	readonly onSave: (v: number | null) => Promise<void>;
}

function InlinePrice({ value, onSave }: InlinePriceProps) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const [saving, setSaving] = useState(false);

	function startEdit() {
		setDraft(value == null ? "" : value.toFixed(2).replaceAll(".", ","));
		setEditing(true);
	}

	async function commit() {
		const parsed = draft.trim() === "" ? null : parseMonetary(draft);
		setSaving(true);
		try {
			await onSave(parsed);
		} finally {
			setSaving(false);
			setEditing(false);
		}
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") commit();
		if (e.key === "Escape") setEditing(false);
	}

	if (editing) {
		return (
			<input
				autoFocus
				type="text"
				value={draft}
				onChange={e => setDraft(e.target.value)}
				onBlur={commit}
				onKeyDown={onKeyDown}
				disabled={saving}
				className="w-24 text-right rounded border border-[#185FA5] px-1.5 py-0.5 text-sm focus:outline-none"
			/>
		);
	}

	return (
		<button
			type="button"
			onClick={startEdit}
			className="text-right w-full tabular-nums text-gray-700 hover:bg-[#E6F1FB] rounded px-1.5 py-0.5 cursor-text"
			title="Clique para editar"
		>
			{value == null ? (
				<span className="text-gray-400 text-xs">—</span>
			) : (
				value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
			)}
		</button>
	);
}

interface InlineAtacadoProps {
	readonly preco: number | null;
	readonly qtd: number | null;
	readonly onSave: (preco: number | null, qtd: number | null) => Promise<void>;
}

function InlineAtacado({ preco, qtd, onSave }: InlineAtacadoProps) {
	const [editing, setEditing] = useState(false);
	const [draftPreco, setDraftPreco] = useState("");
	const [draftQtd, setDraftQtd] = useState("");
	const [saving, setSaving] = useState(false);

	function startEdit() {
		setDraftPreco(preco == null ? "" : preco.toFixed(2).replace(".", ","));
		setDraftQtd(qtd == null ? "" : String(qtd));
		setEditing(true);
	}

	async function commit() {
		const p = draftPreco.trim() === "" ? null : parseMonetary(draftPreco);
		const q = draftQtd.trim() === "" ? null : Number.parseInt(draftQtd, 10);
		setSaving(true);
		try {
			await onSave(p, q);
		} finally {
			setSaving(false);
			setEditing(false);
		}
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") commit();
		if (e.key === "Escape") setEditing(false);
	}

	if (editing) {
		return (
			<div className="flex items-center gap-1 justify-end">
				<input
					autoFocus
					type="text"
					value={draftPreco}
					onChange={e => setDraftPreco(e.target.value)}
					onKeyDown={onKeyDown}
					disabled={saving}
					placeholder="0,00"
					className="w-20 rounded border border-[#185FA5] px-1.5 py-0.5 text-sm text-right focus:outline-none"
				/>
				<span className="text-xs text-gray-400 select-none">≥</span>
				<input
					type="number"
					value={draftQtd}
					onChange={e => setDraftQtd(e.target.value)}
					onKeyDown={onKeyDown}
					onBlur={commit}
					disabled={saving}
					placeholder="10"
					min={2}
					className="w-12 rounded border border-[#185FA5] px-1.5 py-0.5 text-sm text-center focus:outline-none"
				/>
			</div>
		);
	}

	if (preco == null) {
		return (
			<button
				type="button"
				onClick={startEdit}
				className="w-full text-right text-xs text-gray-300 hover:text-[#185FA5] transition-colors px-1.5 py-0.5 rounded hover:bg-[#E6F1FB]"
				title="Clique para adicionar preço atacado"
			>
				+ atacado
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={startEdit}
			className="text-right w-full hover:bg-[#E6F1FB] rounded px-1.5 py-0.5 cursor-text"
			title="Clique para editar"
		>
			<div className="tabular-nums text-gray-700 text-sm">
				{preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
			</div>
			{qtd != null && (
				<div className="text-[11px] text-gray-400">≥{qtd} un.</div>
			)}
		</button>
	);
}

export interface ProdutoRow {
	modelo_id: string;
	codigo: string;
	nome: string;
	custo_producao: number | null;
	estoque_minimo: number;
	ativo: boolean;
	// preços resolvidos pelo servidor
	preco_1un: number | null;
	preco_atacado: number | null;
	qtd_atacado: number | null;
	estoque_disponivel: number;
}

type StatusEstoque = "OK" | "ATENÇÃO" | "REPOR" | "SEM ESTOQUE";

function calcularStatus(disponivel: number, minimo: number): StatusEstoque {
	if (disponivel <= 0) return "SEM ESTOQUE";
	if (minimo > 0 && disponivel < minimo) return "REPOR";
	if (minimo > 0 && disponivel <= minimo * 1.5) return "ATENÇÃO";
	return "OK";
}

function statusVariant(s: StatusEstoque) {
	if (s === "OK") return "success" as const;
	if (s === "ATENÇÃO") return "warning" as const;
	return "danger" as const;
}

const PAGE_SIZE = 20;

function fmt(value: number | null) {
	if (value === null) return "—";
	return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ProdutosTableProps {
	readonly produtos: ProdutoRow[];
}

export default function ProdutosTable({ produtos }: ProdutosTableProps) {
	const { showToast } = useToast();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [modalOpen, setModalOpen] = useState(false);
	const [editando, setEditando] = useState<ProdutoParaEditar | null>(null);
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [loading, setLoading] = useState(false);

	function makeSaveFn(p: ProdutoRow, campo: "custo" | "preco") {
		return async (valor: number | null) => {
			try {
				await atualizarCustoEPreco(
					p.modelo_id,
					campo === "custo" ? valor : p.custo_producao,
					campo === "preco" ? valor : p.preco_1un
				);
			} catch {
				showToast("Erro ao salvar", "error");
			}
		};
	}

	function makeSaveAtacadoFn(p: ProdutoRow) {
		return async (preco: number | null, qtd: number | null) => {
			try {
				await atualizarPrecoAtacado(p.modelo_id, preco, qtd);
			} catch {
				showToast("Erro ao salvar preço atacado", "error");
			}
		};
	}

	const filtered = useMemo(
		() =>
			produtos.filter(
				p =>
					p.nome.toLowerCase().includes(search.toLowerCase()) ||
					p.codigo.toLowerCase().includes(search.toLowerCase())
			),
		[produtos, search]
	);

	const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
	const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	function toggleAll() {
		if (selected.size === paginated.length) {
			setSelected(new Set());
		} else {
			setSelected(new Set(paginated.map(p => p.modelo_id)));
		}
	}

	function toggleOne(id: string) {
		setSelected(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function openCreate() {
		setEditando(null);
		setModalOpen(true);
	}

	function openEdit(p: ProdutoRow) {
		setEditando({
			modelo_id: p.modelo_id,
			nome: p.nome,
			codigo: p.codigo,
			custo_producao: p.custo_producao,
			estoque_minimo: p.estoque_minimo,
			preco_unitario: p.preco_1un,
			preco_atacado: p.preco_atacado,
			qtd_minima_atacado: p.qtd_atacado,
		});
		setModalOpen(true);
	}

	async function handleDelete() {
		setLoading(true);
		try {
			await deletarProdutos(Array.from(selected));
			showToast(`${selected.size} produto(s) removido(s)`, "success");
			setSelected(new Set());
			setConfirmDeleteOpen(false);
		} catch {
			showToast("Erro ao deletar produtos", "error");
		} finally {
			setLoading(false);
		}
	}

	async function handleActivate() {
		setLoading(true);
		try {
			await ativarProdutos(Array.from(selected));
			showToast(`${selected.size} produto(s) ativado(s)`, "success");
			setSelected(new Set());
		} catch {
			showToast("Erro ao ativar produtos", "error");
		} finally {
			setLoading(false);
		}
	}

	async function handleDeactivate() {
		setLoading(true);
		try {
			await desativarProdutos(Array.from(selected));
			showToast(`${selected.size} produto(s) desativado(s)`, "success");
			setSelected(new Set());
		} catch {
			showToast("Erro ao desativar produtos", "error");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Toolbar */}
			<div className="flex items-center gap-3">
				<input
					type="search"
					placeholder="Buscar produto..."
					value={search}
					onChange={e => {
						setSearch(e.target.value);
						setPage(1);
					}}
					className="flex-1 max-w-sm h-9 rounded-md border border-[#B5D4F4] px-3 text-sm focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
				/>
				<Button variant="primary" size="sm" onClick={openCreate}>
					+ Novo produto
				</Button>
			</div>

			{/* Bulk action bar */}
			<BulkActionBar
				selectedCount={selected.size}
				onDelete={() => setConfirmDeleteOpen(true)}
				onActivate={handleActivate}
				onDeactivate={handleDeactivate}
				onClear={() => setSelected(new Set())}
			/>

			{/* Table */}
			<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
							<th className="w-10 px-3 py-2.5 text-left">
								<input
									type="checkbox"
									checked={
										paginated.length > 0 && selected.size === paginated.length
									}
									onChange={toggleAll}
									className="rounded border-gray-300"
								/>
							</th>
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Código
							</th>
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Nome
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Custo
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Varejo
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Atacado
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Estoque
							</th>
							<th className="px-3 py-2.5 text-center font-medium text-gray-600">
								Status
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Ações
							</th>
						</tr>
					</thead>
					<tbody>
						{paginated.length === 0 && (
							<tr>
								<td colSpan={9} className="px-3 py-8 text-center text-gray-400">
									Nenhum produto encontrado.
								</td>
							</tr>
						)}
						{paginated.map(p => {
							const status = calcularStatus(
								p.estoque_disponivel,
								p.estoque_minimo
							);
							return (
								<tr
									key={p.modelo_id}
									className="border-b border-[#B5D4F4] last:border-0 hover:bg-[#F4F8FD] transition-colors"
								>
									<td className="px-3 py-2.5">
										<input
											type="checkbox"
											checked={selected.has(p.modelo_id)}
											onChange={() => toggleOne(p.modelo_id)}
											className="rounded border-gray-300"
										/>
									</td>
									<td className="px-3 py-2.5 text-gray-500 font-mono text-xs">
										{p.codigo}
									</td>
									<td className="px-3 py-2.5 font-medium text-gray-900">
										<Link
											href={`/produtos/${p.modelo_id}`}
											className="hover:text-[#185FA5] hover:underline"
										>
											{p.nome}
										</Link>
									</td>
									<td className="px-3 py-1.5 text-right">
										<InlinePrice
											value={p.custo_producao}
											onSave={makeSaveFn(p, "custo")}
										/>
									</td>
									<td className="px-3 py-1.5 text-right">
										<InlinePrice
											value={p.preco_1un}
											onSave={makeSaveFn(p, "preco")}
										/>
										<div className="text-[11px] text-gray-400 text-right px-1.5">
											≥1 un.
										</div>
									</td>
									<td className="px-3 py-1.5 text-right">
										<InlineAtacado
											preco={p.preco_atacado}
											qtd={p.qtd_atacado}
											onSave={makeSaveAtacadoFn(p)}
										/>
									</td>
									<td className="px-3 py-2.5 text-right text-gray-700">
										{p.estoque_disponivel}
									</td>
									<td className="px-3 py-2.5 text-center">
										<Badge variant={statusVariant(status)}>{status}</Badge>
									</td>
									<td className="px-3 py-2.5 text-right">
										<RowActionsMenu
											label={p.nome}
											actions={[
												{ label: "Editar", onClick: () => openEdit(p) },
												{
													label: "Ver preços",
													href: `/produtos/${p.modelo_id}/precos`,
												},
												{
													label: p.ativo ? "Desativar" : "Ativar",
													variant: p.ativo ? "danger" : "default",
													onClick: async () => {
														setLoading(true);
														try {
															if (p.ativo)
																await desativarProdutos([p.modelo_id]);
															else await ativarProdutos([p.modelo_id]);
															showToast(
																p.ativo
																	? "Produto desativado"
																	: "Produto ativado",
																"success"
															);
														} catch {
															showToast("Erro ao alterar status", "error");
														} finally {
															setLoading(false);
														}
													},
												},
											]}
										/>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between text-sm text-gray-500">
					<span>
						{filtered.length} produto(s) · página {page} de {totalPages}
					</span>
					<div className="flex gap-2">
						<Button
							variant="secondary"
							size="sm"
							disabled={page <= 1}
							onClick={() => setPage(p => p - 1)}
						>
							Anterior
						</Button>
						<Button
							variant="secondary"
							size="sm"
							disabled={page >= totalPages}
							onClick={() => setPage(p => p + 1)}
						>
							Próxima
						</Button>
					</div>
				</div>
			)}

			{/* Create/Edit Modal */}
			<ProdutoModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				produto={editando}
			/>

			{/* Confirm Delete Modal */}
			<Modal
				open={confirmDeleteOpen}
				onClose={() => setConfirmDeleteOpen(false)}
				title="Confirmar exclusão"
				footer={
					<>
						<Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
							Cancelar
						</Button>
						<Button variant="danger" loading={loading} onClick={handleDelete}>
							Deletar {selected.size} produto(s)
						</Button>
					</>
				}
			>
				<p className="text-sm text-gray-700">
					Tem certeza que deseja remover{" "}
					<strong>{selected.size} produto(s)</strong>? Esta ação pode ser
					desfeita reativando os produtos.
				</p>
			</Modal>
		</div>
	);
}
