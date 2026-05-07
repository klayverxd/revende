"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, Modal, Select, useToast } from "@/components/ui";
import ProducaoModal from "./ProducaoModal";
import { registrarBaixaConsignacao, type EstoqueCalculadoRow } from "./actions";

export interface ModeloOption {
	modelo_id: string;
	nome: string;
	codigo: string | null;
	custo_producao: number | null;
}

export interface RevendedorOption {
	revendedor_id: string;
	nome: string;
}

export interface MovimentoProducao {
	producao_id: string;
	modelo_id: string;
	quantidade: number;
	custo_unitario: number | null;
	data_producao: string;
	observacao: string | null;
}

export interface MovimentoConsignacao {
	envio_item_id: string;
	modelo_id: string;
	modelo_nome: string;
	modelo_codigo: string | null;
	revendedor_id: string;
	revendedor_nome: string;
	data_envio: string;
	status_envio: "ABERTO" | "CONFERIDO" | "ENCERRADO";
	qtd_enviada: number;
	qtd_vendida: number | null;
	qtd_devolvida: number | null;
}

interface Props {
	readonly estoque: EstoqueCalculadoRow[];
	readonly modelos: ModeloOption[];
	readonly revendedores: RevendedorOption[];
	readonly producoes: MovimentoProducao[];
	readonly consignacao: MovimentoConsignacao[];
}

type Aba = "global" | "ponto";

type StatusLabel = "OK" | "ATENCAO" | "REPOR" | "SEM_ESTOQUE";

function fmtDate(date: string) {
	return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function statusLabel(status: StatusLabel) {
	if (status === "ATENCAO") return "ATENÇÃO";
	if (status === "SEM_ESTOQUE") return "SEM ESTOQUE";
	return status;
}

function statusVariant(status: StatusLabel) {
	if (status === "OK") return "success" as const;
	if (status === "ATENCAO") return "warning" as const;
	return "danger" as const;
}

function eventDateValue(date: string) {
	return new Date(`${date}T00:00:00`).getTime();
}

export default function EstoqueView({
	estoque,
	modelos,
	revendedores,
	producoes,
	consignacao,
}: Props) {
	const router = useRouter();
	const [, startTransition] = useTransition();
	const { showToast } = useToast();
	const [aba, setAba] = useState<Aba>("global");
	const [openModal, setOpenModal] = useState(false);
	const [revendedorId, setRevendedorId] = useState(
		revendedores[0]?.revendedor_id ?? ""
	);
	const [drawerModeloId, setDrawerModeloId] = useState<string | null>(null);
	const [baixaItem, setBaixaItem] = useState<MovimentoConsignacao | null>(null);
	const [qtdBaixa, setQtdBaixa] = useState("1");
	const [salvandoBaixa, setSalvandoBaixa] = useState(false);
	const [filtro, setFiltro] = useState("");

	const revendedorOptions = useMemo(
		() =>
			revendedores.map(r => ({
				value: r.revendedor_id,
				label: r.nome,
			})),
		[revendedores]
	);

	const porRevendedor = useMemo(() => {
		if (!revendedorId) return [];
		return consignacao
			.filter(c => c.revendedor_id === revendedorId)
			.sort(
				(a, b) => eventDateValue(b.data_envio) - eventDateValue(a.data_envio)
			);
	}, [consignacao, revendedorId]);

	const modeloSelecionado = useMemo(
		() => estoque.find(e => e.modelo_id === drawerModeloId) ?? null,
		[drawerModeloId, estoque]
	);

	const filteredEstoque = useMemo(() => {
		const normalize = (s: string) =>
			s
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.toLowerCase();
		const q = normalize(filtro.trim());
		if (!q) return estoque;
		return estoque.filter(
			r =>
				normalize(r.nome).includes(q) || normalize(r.codigo ?? "").includes(q)
		);
	}, [estoque, filtro]);

	const timeline = useMemo(() => {
		if (!drawerModeloId) return [];

		const eventos: Array<{
			id: string;
			tipo: "producao" | "envio" | "venda" | "devolucao";
			data: string;
			titulo: string;
			detalhe: string;
		}> = [];

		for (const p of producoes) {
			if (p.modelo_id !== drawerModeloId) continue;
			eventos.push({
				id: `p-${p.producao_id}`,
				tipo: "producao",
				data: p.data_producao,
				titulo: "Produção",
				detalhe: `Entrada de ${p.quantidade} un.`,
			});
		}

		for (const c of consignacao) {
			if (c.modelo_id !== drawerModeloId) continue;
			eventos.push({
				id: `e-${c.envio_item_id}`,
				tipo: "envio",
				data: c.data_envio,
				titulo: "Envio",
				detalhe: `${c.revendedor_nome} recebeu ${c.qtd_enviada} un.`,
			});
			if ((c.qtd_vendida ?? 0) > 0) {
				eventos.push({
					id: `v-${c.envio_item_id}`,
					tipo: "venda",
					data: c.data_envio,
					titulo: "Conferência",
					detalhe: `${c.qtd_vendida} un. vendidas`,
				});
			}
			if ((c.qtd_devolvida ?? 0) > 0) {
				eventos.push({
					id: `d-${c.envio_item_id}`,
					tipo: "devolucao",
					data: c.data_envio,
					titulo: "Devolução",
					detalhe: `${c.qtd_devolvida} un. devolvidas`,
				});
			}
		}

		return eventos.sort(
			(a, b) => eventDateValue(b.data) - eventDateValue(a.data)
		);
	}, [consignacao, drawerModeloId, producoes]);

	async function confirmarBaixa() {
		if (!baixaItem) return;
		const vendida = baixaItem.qtd_vendida ?? 0;
		const devolvida = baixaItem.qtd_devolvida ?? 0;
		const max = baixaItem.qtd_enviada - vendida - devolvida;
		const qtd = Math.max(0, Math.floor(Number(qtdBaixa)));

		if (qtd <= 0) {
			showToast("Informe uma quantidade válida", "error");
			return;
		}
		if (qtd > max) {
			showToast("Quantidade maior que o saldo em consignação", "error");
			return;
		}

		setSalvandoBaixa(true);
		try {
			await registrarBaixaConsignacao(baixaItem.envio_item_id, qtd);
			showToast("Baixa registrada com sucesso", "success");
			setBaixaItem(null);
			startTransition(() => router.refresh());
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao registrar baixa",
				"error"
			);
		} finally {
			setSalvandoBaixa(false);
		}
	}

	return (
		<>
			<div className="flex items-center justify-between gap-3">
				<div className="inline-flex rounded-lg border border-[#B5D4F4] bg-white p-1">
					<button
						type="button"
						onClick={() => setAba("global")}
						className={[
							"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
							aba === "global"
								? "bg-[#185FA5] text-white"
								: "text-gray-600 hover:bg-[#E6F1FB]",
						].join(" ")}
					>
						Visão global
					</button>
					<button
						type="button"
						onClick={() => setAba("ponto")}
						className={[
							"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
							aba === "ponto"
								? "bg-[#185FA5] text-white"
								: "text-gray-600 hover:bg-[#E6F1FB]",
						].join(" ")}
					>
						Por ponto de venda
					</button>
				</div>
				<Button size="sm" onClick={() => setOpenModal(true)}>
					+ Registrar produção
				</Button>
			</div>

			{aba === "global" ? (
				<>
					<div className="bg-white rounded-xl border border-[#B5D4F4] px-3 py-2">
						<input
							type="search"
							value={filtro}
							onChange={e => setFiltro(e.target.value)}
							placeholder="Filtrar por nome ou código..."
							className="w-full text-sm rounded-md border border-[#B5D4F4] px-3 py-1.5 focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
						/>
					</div>
					<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
									<th className="px-3 py-2.5 text-left font-medium text-gray-600">
										Código
									</th>
									<th className="px-3 py-2.5 text-left font-medium text-gray-600">
										Produto
									</th>
									<th className="px-3 py-2.5 text-right font-medium text-gray-600">
										Estoque inicial
									</th>
									<th className="px-3 py-2.5 text-right font-medium text-gray-600">
										Entradas
									</th>
									<th className="px-3 py-2.5 text-right font-medium text-gray-600">
										Saídas
									</th>
									<th className="px-3 py-2.5 text-right font-medium text-gray-600">
										Mínimo
									</th>
									<th className="px-3 py-2.5 text-right font-medium text-gray-600">
										Disponível
									</th>
									<th className="px-3 py-2.5 text-center font-medium text-gray-600">
										Status
									</th>
								</tr>
							</thead>
							<tbody>
								{filteredEstoque.length === 0 && (
									<tr>
										<td
											colSpan={8}
											className="px-3 py-10 text-center text-gray-400"
										>
											{filtro
												? "Nenhum produto encontrado para este filtro."
												: "Nenhum produto encontrado."}
										</td>
									</tr>
								)}
								{filteredEstoque.map(row => (
									<tr
										key={row.modelo_id}
										className="border-b border-[#B5D4F4] last:border-0 hover:bg-[#F4F8FD] cursor-pointer"
										onClick={() => setDrawerModeloId(row.modelo_id)}
									>
										<td className="px-3 py-2.5 text-gray-500 font-mono text-xs">
											{row.codigo}
										</td>
										<td className="px-3 py-2.5 font-medium text-gray-900">
											{row.nome}
										</td>
										<td className="px-3 py-2.5 text-right text-gray-700">
											{row.estoque_inicial}
										</td>
										<td className="px-3 py-2.5 text-right text-gray-700">
											{row.entradas}
										</td>
										<td className="px-3 py-2.5 text-right text-gray-700">
											{row.saidas}
										</td>
										<td className="px-3 py-2.5 text-right text-gray-700">
											{row.estoque_minimo}
										</td>
										<td className="px-3 py-2.5 text-right font-semibold text-gray-900">
											{row.disponivel}
										</td>
										<td className="px-3 py-2.5 text-center">
											<Badge variant={statusVariant(row.status)}>
												{statusLabel(row.status)}
											</Badge>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			) : (
				<div className="flex flex-col gap-3">
					<div className="max-w-sm">
						<Select
							label="Revendedor"
							options={revendedorOptions}
							placeholder="Selecione"
							value={revendedorId}
							onChange={e => setRevendedorId(e.target.value)}
						/>
					</div>
					<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
									<th className="px-3 py-2.5 text-left font-medium text-gray-600">
										Produto
									</th>
									<th className="px-3 py-2.5 text-right font-medium text-gray-600">
										Qtd enviada
									</th>
									<th className="px-3 py-2.5 text-right font-medium text-gray-600">
										Qtd vendida
									</th>
									<th className="px-3 py-2.5 text-right font-medium text-gray-600">
										Qtd devolvida
									</th>
									<th className="px-3 py-2.5 text-right font-medium text-gray-600">
										Em consignação
									</th>
									<th className="px-3 py-2.5 text-left font-medium text-gray-600">
										Data do envio
									</th>
									<th className="px-3 py-2.5 text-right font-medium text-gray-600">
										Ações
									</th>
								</tr>
							</thead>
							<tbody>
								{porRevendedor.length === 0 && (
									<tr>
										<td
											colSpan={7}
											className="px-3 py-10 text-center text-gray-400"
										>
											Sem movimentações para o revendedor selecionado.
										</td>
									</tr>
								)}
								{porRevendedor.map(row => {
									const vendida = row.qtd_vendida ?? 0;
									const devolvida = row.qtd_devolvida ?? 0;
									const consignado = row.qtd_enviada - vendida - devolvida;

									return (
										<tr
											key={row.envio_item_id}
											className="border-b border-[#B5D4F4] last:border-0"
										>
											<td className="px-3 py-2.5">
												<div className="font-medium text-gray-900">
													{row.modelo_nome}
												</div>
												<div className="text-xs text-gray-500 font-mono">
													{row.modelo_codigo ?? "-"}
												</div>
											</td>
											<td className="px-3 py-2.5 text-right text-gray-700">
												{row.qtd_enviada}
											</td>
											<td className="px-3 py-2.5 text-right text-gray-700">
												{vendida}
											</td>
											<td className="px-3 py-2.5 text-right text-gray-700">
												{devolvida}
											</td>
											<td className="px-3 py-2.5 text-right font-semibold text-gray-900">
												{consignado}
											</td>
											<td className="px-3 py-2.5 text-gray-700">
												{fmtDate(row.data_envio)}
											</td>
											<td className="px-3 py-2.5 text-right">
												{consignado > 0 && row.status_envio !== "ABERTO" ? (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => {
															setBaixaItem(row);
															setQtdBaixa("1");
														}}
													>
														Registrar baixa
													</Button>
												) : (
													<span className="text-xs text-gray-500">-</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}

			<ProducaoModal
				open={openModal}
				onClose={() => setOpenModal(false)}
				modelos={modelos}
			/>

			<Modal
				open={Boolean(baixaItem)}
				onClose={() => setBaixaItem(null)}
				title="Baixa individual de consignação"
				footer={
					<>
						<Button
							variant="ghost"
							onClick={() => setBaixaItem(null)}
							disabled={salvandoBaixa}
						>
							Cancelar
						</Button>
						<Button onClick={confirmarBaixa} loading={salvandoBaixa}>
							Confirmar baixa
						</Button>
					</>
				}
			>
				{baixaItem && (
					<div className="flex flex-col gap-3">
						<p className="text-sm text-gray-700">
							Produto: <strong>{baixaItem.modelo_nome}</strong>
						</p>
						<p className="text-sm text-gray-700">
							Revendedor: <strong>{baixaItem.revendedor_nome}</strong>
						</p>
						<p className="text-xs text-gray-600">
							Saldo em consignação:{" "}
							{baixaItem.qtd_enviada -
								(baixaItem.qtd_vendida ?? 0) -
								(baixaItem.qtd_devolvida ?? 0)}{" "}
							un.
						</p>
						<Input
							label="Quantidade para baixa"
							type="number"
							min={1}
							max={Math.max(
								0,
								baixaItem.qtd_enviada -
									(baixaItem.qtd_vendida ?? 0) -
									(baixaItem.qtd_devolvida ?? 0)
							)}
							value={qtdBaixa}
							onChange={e => setQtdBaixa(e.target.value)}
						/>
					</div>
				)}
			</Modal>

			{drawerModeloId && (
				<div className="fixed inset-0 z-40">
					<div
						className="absolute inset-0 bg-black/35"
						onClick={() => setDrawerModeloId(null)}
						aria-hidden="true"
					/>
					<aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-[#B5D4F4] shadow-xl flex flex-col">
						<div className="px-4 py-3 border-b border-[#B5D4F4] flex items-center justify-between">
							<div>
								<h2 className="text-base font-semibold text-gray-900">
									Histórico de movimentações
								</h2>
								<p className="text-xs text-gray-500 mt-0.5">
									{modeloSelecionado?.nome ?? "Produto"} · saldo atual{" "}
									{modeloSelecionado?.disponivel ?? 0}
								</p>
							</div>
							<button
								type="button"
								onClick={() => setDrawerModeloId(null)}
								className="text-gray-400 hover:text-gray-600 rounded p-1 hover:bg-gray-100"
								aria-label="Fechar"
							>
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-4">
							{timeline.length === 0 ? (
								<p className="text-sm text-gray-500">
									Nenhuma movimentação para este produto.
								</p>
							) : (
								<ul className="flex flex-col gap-2">
									{timeline.map(item => {
										const color =
											item.tipo === "producao"
												? "bg-green-50 border-green-200 text-green-800"
												: item.tipo === "envio"
													? "bg-blue-50 border-blue-200 text-blue-800"
													: item.tipo === "venda"
														? "bg-amber-50 border-amber-200 text-amber-800"
														: "bg-gray-100 border-gray-200 text-gray-700";

										return (
											<li
												key={item.id}
												className={["rounded-lg border px-3 py-2", color].join(
													" "
												)}
											>
												<div className="flex items-center justify-between gap-2">
													<span className="text-sm font-medium">
														{item.titulo}
													</span>
													<span className="text-xs opacity-80">
														{fmtDate(item.data)}
													</span>
												</div>
												<p className="text-xs mt-1">{item.detalhe}</p>
											</li>
										);
									})}
								</ul>
							)}
						</div>
					</aside>
				</div>
			)}
		</>
	);
}
