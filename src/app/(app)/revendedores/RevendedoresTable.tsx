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
import RevendedorModal, { type RevendedorParaEditar } from "./RevendedorModal";
import {
	deletarRevendedores,
	ativarRevendedores,
	desativarRevendedores,
} from "./actions";

export interface RevendedorRow {
	revendedor_id: string;
	nome: string;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
	ativo: boolean;
	total_enviado: number;
	total_vendido: number;
	comissao_pendente: number;
	// para edição
	telefone?: string | null;
	email?: string | null;
	endereco?: string | null;
	comissao_fixa?: number | null;
	comissao_pct?: number | null;
	valor_minimo_padrao?: number | null;
}

function fmtBRL(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function giro(enviado: number, vendido: number) {
	if (enviado === 0) return 0;
	return Math.round((vendido / enviado) * 100);
}

interface Props {
	readonly revendedores: RevendedorRow[];
}

const PAGE_SIZE = 20;

export default function RevendedoresTable({ revendedores }: Props) {
	const { showToast } = useToast();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [modalOpen, setModalOpen] = useState(false);
	const [editando, setEditando] = useState<RevendedorParaEditar | null>(null);
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [loading, setLoading] = useState(false);

	const filtered = useMemo(
		() =>
			revendedores.filter(r =>
				r.nome.toLowerCase().includes(search.toLowerCase())
			),
		[revendedores, search]
	);

	const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
	const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	function toggleAll() {
		if (selected.size === paginated.length) setSelected(new Set());
		else setSelected(new Set(paginated.map(r => r.revendedor_id)));
	}

	function toggleOne(id: string) {
		setSelected(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function openEdit(r: RevendedorRow) {
		setEditando({
			revendedor_id: r.revendedor_id,
			nome: r.nome,
			telefone: r.telefone,
			email: r.email,
			endereco: r.endereco,
			modelo_acerto: r.modelo_acerto,
			comissao_fixa: r.comissao_fixa,
			comissao_pct: r.comissao_pct,
			valor_minimo_padrao: r.valor_minimo_padrao,
		});
		setModalOpen(true);
	}

	async function handleDelete() {
		setLoading(true);
		try {
			await deletarRevendedores(Array.from(selected));
			showToast(`${selected.size} revendedor(es) removido(s)`, "success");
			setSelected(new Set());
			setConfirmDeleteOpen(false);
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao deletar",
				"error"
			);
		} finally {
			setLoading(false);
		}
	}

	async function handleActivate() {
		setLoading(true);
		try {
			await ativarRevendedores(Array.from(selected));
			showToast(`${selected.size} revendedor(es) ativado(s)`, "success");
			setSelected(new Set());
		} catch {
			showToast("Erro ao ativar", "error");
		} finally {
			setLoading(false);
		}
	}

	async function handleDeactivate() {
		setLoading(true);
		try {
			await desativarRevendedores(Array.from(selected));
			showToast(`${selected.size} revendedor(es) desativado(s)`, "success");
			setSelected(new Set());
		} catch {
			showToast("Erro ao desativar", "error");
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
					placeholder="Buscar revendedor..."
					value={search}
					onChange={e => {
						setSearch(e.target.value);
						setPage(1);
					}}
					className="flex-1 max-w-sm h-9 rounded-md border border-[#B5D4F4] px-3 text-sm focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
				/>
				<Button
					variant="primary"
					size="sm"
					onClick={() => {
						setEditando(null);
						setModalOpen(true);
					}}
				>
					+ Novo revendedor
				</Button>
			</div>

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
								Nome
							</th>
							<th className="px-3 py-2.5 text-center font-medium text-gray-600">
								Acerto
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Enviado
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Vendido
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Giro %
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Pendente
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
									Nenhum revendedor encontrado.
								</td>
							</tr>
						)}
						{paginated.map(r => {
							const g = giro(r.total_enviado, r.total_vendido);
							return (
								<tr
									key={r.revendedor_id}
									className="border-b border-[#B5D4F4] last:border-0 hover:bg-[#F4F8FD] transition-colors"
								>
									<td className="px-3 py-2.5">
										<input
											type="checkbox"
											checked={selected.has(r.revendedor_id)}
											onChange={() => toggleOne(r.revendedor_id)}
											className="rounded border-gray-300"
										/>
									</td>
									<td className="px-3 py-2.5 font-medium text-gray-900">
										<Link
											href={`/revendedores/${r.revendedor_id}`}
											className="hover:text-[#185FA5] hover:underline"
										>
											{r.nome}
										</Link>
									</td>
									<td className="px-3 py-2.5 text-center">
										<Badge
											variant={
												r.modelo_acerto === "VALOR_MINIMO"
													? "success"
													: "neutral"
											}
										>
											{r.modelo_acerto === "VALOR_MINIMO"
												? "Valor por produto"
												: "Comissão"}
										</Badge>
									</td>
									<td className="px-3 py-2.5 text-right text-gray-700">
										{r.total_enviado}
									</td>
									<td className="px-3 py-2.5 text-right text-gray-700">
										{r.total_vendido}
									</td>
									<td className="px-3 py-2.5 text-right text-gray-700">
										<span
											className={
												g >= 70
													? "text-green-700 font-medium"
													: g >= 40
														? "text-amber-700"
														: "text-red-600"
											}
										>
											{g}%
										</span>
									</td>
									<td className="px-3 py-2.5 text-right text-gray-700">
										{r.comissao_pendente > 0 ? (
											<span className="text-amber-700 font-medium">
												{fmtBRL(r.comissao_pendente)}
											</span>
										) : (
											"—"
										)}
									</td>
									<td className="px-3 py-2.5 text-center">
										<Badge variant={r.ativo ? "success" : "neutral"}>
											{r.ativo ? "Ativo" : "Inativo"}
										</Badge>
									</td>
									<td className="px-3 py-2.5 text-right">
										<RowActionsMenu
											label={r.nome}
											actions={[
												{ label: "Editar", onClick: () => openEdit(r) },
												{
													label: "Ver perfil",
													href: `/revendedores/${r.revendedor_id}`,
												},
												{
													label: "Ver preços",
													href: `/revendedores/${r.revendedor_id}/precos`,
												},
												{
													label: r.ativo ? "Desativar" : "Ativar",
													variant: r.ativo ? "danger" : "default",
													onClick: async () => {
														setLoading(true);
														try {
															if (r.ativo)
																await desativarRevendedores([r.revendedor_id]);
															else await ativarRevendedores([r.revendedor_id]);
															showToast(
																r.ativo
																	? "Revendedor desativado"
																	: "Revendedor ativado",
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
						{filtered.length} revendedor(es) · página {page} de {totalPages}
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

			{/* Modal criar/editar */}
			<RevendedorModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				revendedor={editando}
			/>

			{/* Modal confirmação de exclusão */}
			<Modal
				open={confirmDeleteOpen}
				onClose={() => setConfirmDeleteOpen(false)}
				title="Confirmar exclusão"
				footer={
					<>
						<Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
							Cancelar
						</Button>
						<Button variant="danger" onClick={handleDelete} loading={loading}>
							Deletar {selected.size} revendedor(es)
						</Button>
					</>
				}
			>
				<p className="text-sm text-gray-600">
					Você está prestes a remover{" "}
					<strong>{selected.size} revendedor(es)</strong>.
				</p>
				<p className="text-sm text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
					Revendedores com envios em aberto <strong>não podem</strong> ser
					removidos. Revendedores com histórico serão apenas desativados.
				</p>
			</Modal>
		</div>
	);
}
