"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, Modal, Select, useToast } from "@/components/ui";
import { criarEnvio, resolverPrecoEnvio } from "../actions";
import {
	salvarRascunhoServidor,
	limparRascunhoServidor,
	type DraftState as ServerDraftState,
} from "./draftActions";

export interface RevendedorAtivo {
	revendedor_id: string;
	nome: string;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
}

export interface ProdutoDisponivel {
	modelo_id: string;
	codigo: string | null;
	nome: string;
	estoque_disponivel: number;
	custo_producao: number | null;
}

interface ItemSelecionado {
	modelo_id: string;
	nome: string;
	codigo: string | null;
	quantidade: number;
	preco: number;
	origem: "MODELO" | "REVENDEDOR" | "MANUAL";
	estoque_disponivel: number;
	custo_producao: number | null;
}

interface Props {
	readonly revendedores: RevendedorAtivo[];
	readonly produtos: ProdutoDisponivel[];
	readonly serverDraft: ServerDraftState | null;
}

type Step = 1 | 2 | 3;

type DraftState = {
	revendedorId: string;
	itens: ItemSelecionado[];
	step: Step;
	dataEnvio: string;
	observacao: string;
};

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(date: string) {
	return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function todayISO() {
	return new Date().toISOString().slice(0, 10);
}

const DRAFT_KEY = "novo_envio_rascunho";

function loadDraft(): DraftState | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(DRAFT_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as DraftState;
	} catch {
		return null;
	}
}

function saveDraft(data: DraftState): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

function clearDraft(): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem(DRAFT_KEY);
}

export default function NovoEnvioStepper({
	revendedores,
	produtos,
	serverDraft,
}: Props) {
	const { showToast } = useToast();
	const router = useRouter();

	// Prefer server draft; fall back to localStorage
	const initialDraft = useMemo<DraftState>(() => {
		if (serverDraft) return serverDraft as DraftState;
		return (
			loadDraft() ?? {
				revendedorId: "",
				itens: [],
				step: 1,
				dataEnvio: todayISO(),
				observacao: "",
			}
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const [step, setStep] = useState<Step>(initialDraft.step);
	const [revendedorId, setRevendedorId] = useState(initialDraft.revendedorId);
	const [searchProduto, setSearchProduto] = useState("");
	const [itens, setItens] = useState<ItemSelecionado[]>(initialDraft.itens);
	const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
	const [salvando, setSalvando] = useState(false);
	const [openPrint, setOpenPrint] = useState(false);
	const [dataEnvio, setDataEnvio] = useState(initialDraft.dataEnvio);
	const [observacao, setObservacao] = useState(initialDraft.observacao);

	const hasDraft = revendedorId !== "" || itens.length > 0;

	const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const submittedRef = useRef(false);

	const debouncedSaveToServer = useCallback((draft: DraftState) => {
		if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
		serverSaveTimerRef.current = setTimeout(() => {
			void salvarRascunhoServidor(draft);
		}, 1500);
	}, []);

	// Auto-save draft to localStorage + debounced server save
	useEffect(() => {
		const draft: DraftState = {
			revendedorId,
			itens,
			step,
			dataEnvio,
			observacao,
		};
		saveDraft(draft);
		debouncedSaveToServer(draft);
	}, [revendedorId, itens, step, dataEnvio, observacao, debouncedSaveToServer]);

	const revendedor = useMemo(
		() => revendedores.find(r => r.revendedor_id === revendedorId) ?? null,
		[revendedorId, revendedores]
	);

	const revendedorOptions = useMemo(
		() =>
			revendedores.map(r => ({
				value: r.revendedor_id,
				label: `${r.nome} (${r.modelo_acerto === "VALOR_MINIMO" ? "Valor por produto" : "Comissao"})`,
			})),
		[revendedores]
	);

	const produtosFiltrados = useMemo(() => {
		const bySearch = produtos.filter(p => {
			const term = searchProduto.toLowerCase();
			return (
				p.nome.toLowerCase().includes(term) ||
				(p.codigo ?? "").toLowerCase().includes(term)
			);
		});
		return bySearch.slice(0, 30);
	}, [produtos, searchProduto]);

	const total = useMemo(() => {
		return itens.reduce((acc, item) => acc + item.preco * item.quantidade, 0);
	}, [itens]);

	const totalUnidades = useMemo(
		() => itens.reduce((acc, item) => acc + item.quantidade, 0),
		[itens]
	);

	const custoTotalProducao = useMemo(
		() =>
			itens.reduce(
				(acc, item) =>
					item.custo_producao != null
						? acc + item.custo_producao * item.quantidade
						: acc,
				0
			),
		[itens]
	);

	function isSelecionado(modeloId: string) {
		return itens.some(i => i.modelo_id === modeloId);
	}

	async function adicionarProduto(produto: ProdutoDisponivel) {
		if (!revendedor) {
			showToast("Selecione um revendedor primeiro", "error");
			return;
		}
		if (itens.some(i => i.modelo_id === produto.modelo_id)) {
			return;
		}

		setLoadingPriceId(produto.modelo_id);
		try {
			const preco = await resolverPrecoEnvio(
				revendedor.revendedor_id,
				produto.modelo_id
			);

			setItens(prev => [
				...prev,
				{
					modelo_id: produto.modelo_id,
					nome: produto.nome,
					codigo: produto.codigo,
					quantidade: 1,
					preco: preco.preco ?? 0,
					origem: (preco.origem ?? "MANUAL") as
						| "MODELO"
						| "REVENDEDOR"
						| "MANUAL",
					estoque_disponivel: produto.estoque_disponivel,
					custo_producao: produto.custo_producao,
				},
			]);
		} catch {
			showToast("Erro ao resolver preco", "error");
		} finally {
			setLoadingPriceId(null);
		}
	}

	async function alternarProduto(produto: ProdutoDisponivel, checked: boolean) {
		if (checked) {
			await adicionarProduto(produto);
			return;
		}
		setItens(prev => prev.filter(i => i.modelo_id !== produto.modelo_id));
	}

	async function atualizarQuantidade(modeloId: string, quantidade: number) {
		if (!revendedor) return;
		if (!Number.isFinite(quantidade) || quantidade <= 0) return;

		setItens(prev =>
			prev.map(item =>
				item.modelo_id === modeloId ? { ...item, quantidade } : item
			)
		);

		const item = itens.find(i => i.modelo_id === modeloId);
		if (!item || item.origem === "MANUAL") return;

		try {
			const resolvido = await resolverPrecoEnvio(
				revendedor.revendedor_id,
				modeloId
			);
			if (resolvido.preco !== null) {
				setItens(prev =>
					prev.map(it =>
						it.modelo_id === modeloId
							? {
									...it,
									preco: resolvido.preco ?? it.preco,
									origem: (resolvido.origem ?? it.origem) as
										| "MODELO"
										| "REVENDEDOR"
										| "MANUAL",
								}
							: it
					)
				);
			}
		} catch {
			// mantém o preço atual se falhar
		}
	}

	function atualizarPrecoManual(modeloId: string, preco: number) {
		setItens(prev =>
			prev.map(item =>
				item.modelo_id === modeloId
					? {
							...item,
							preco: Number.isFinite(preco) ? preco : 0,
							origem: "MANUAL",
						}
					: item
			)
		);
	}

	function removerItem(modeloId: string) {
		setItens(prev => prev.filter(i => i.modelo_id !== modeloId));
	}

	async function confirmarEnvio() {
		if (submittedRef.current) return;
		if (!revendedor) {
			showToast("Selecione um revendedor", "error");
			return;
		}
		if (itens.length === 0) {
			showToast("Adicione ao menos um item", "error");
			return;
		}

		submittedRef.current = true;
		setSalvando(true);
		try {
			await criarEnvio(
				revendedor.revendedor_id,
				itens.map(i => ({
					modeloId: i.modelo_id,
					quantidade: i.quantidade,
					preco: i.preco,
					origem: i.origem,
				})),
				observacao,
				dataEnvio
			);
			showToast("Envio confirmado com sucesso", "success");
			clearDraft();
			void limparRascunhoServidor();
			router.push("/envios");
			router.refresh();
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao criar envio",
				"error"
			);
			submittedRef.current = false;
		} finally {
			setSalvando(false);
		}
	}

	return (
		<>
			<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 md:p-5 flex flex-col gap-4">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
					{[
						{ s: 1 as Step, label: "1. Revendedor" },
						{ s: 2 as Step, label: "2. Itens do envio" },
						{ s: 3 as Step, label: "3. Confirmacao" },
					].map(it => (
						<div
							key={it.s}
							className={[
								"rounded-lg border px-3 py-2 text-center text-xs md:text-sm font-medium",
								step === it.s
									? "border-[#185FA5] bg-[#E6F1FB] text-[#185FA5]"
									: "border-[#B5D4F4] bg-white text-gray-700",
							].join(" ")}
						>
							{it.label}
						</div>
					))}
				</div>

				{hasDraft && (
					<div className="flex items-center justify-between border-t border-[#E6F1FB] pt-2 text-xs text-gray-500">
						<span>Rascunho salvo automaticamente</span>
						<button
							type="button"
							onClick={() => {
								clearDraft();
								setStep(1);
								setRevendedorId("");
								setItens([]);
								setDataEnvio(todayISO());
								setObservacao("");
							}}
							className="text-red-500 hover:underline"
						>
							Limpar rascunho
						</button>
					</div>
				)}

				{step === 1 && (
					<div className="flex flex-col gap-4 max-w-xl">
						<Select
							label="Revendedor"
							placeholder="Selecione um revendedor"
							options={revendedorOptions}
							value={revendedorId}
							onChange={e => {
								setRevendedorId(e.target.value);
								setItens([]);
							}}
						/>
						<p className="text-xs text-gray-600">
							Ao trocar o revendedor, a lista de itens selecionados e precos
							sera reiniciada.
						</p>
						<div className="flex justify-end">
							<Button onClick={() => setStep(2)} disabled={!revendedorId}>
								Continuar para itens
							</Button>
						</div>
					</div>
				)}

				{step === 2 && (
					<div className="flex flex-col gap-3">
						<div className="rounded-lg border border-[#B5D4F4] bg-[#F4F8FD] p-3 flex items-center justify-between gap-3">
							<div>
								<p className="text-xs text-gray-700">Revendedor selecionado</p>
								<p className="text-sm font-semibold text-gray-900">
									{revendedor?.nome}
								</p>
							</div>
							<Button variant="ghost" size="sm" onClick={() => setStep(1)}>
								Trocar
							</Button>
						</div>

						<Input
							placeholder="Buscar produto por nome ou codigo..."
							value={searchProduto}
							onChange={e => setSearchProduto(e.target.value)}
						/>

						<div className="rounded-lg border border-[#B5D4F4] overflow-auto">
							<table className="w-full text-sm min-w-[760px]">
								<thead>
									<tr className="bg-[#F4F8FD] border-b border-[#B5D4F4]">
										<th className="px-3 py-2 text-left font-medium text-gray-600 w-10">
											Sel.
										</th>
										<th className="px-3 py-2 text-left font-medium text-gray-600">
											Produto
										</th>
										<th className="px-3 py-2 text-right font-medium text-gray-600">
											Estoque
										</th>
										<th className="px-3 py-2 text-right font-medium text-gray-600">
											Qtd
										</th>
										<th className="px-3 py-2 text-right font-medium text-gray-600">
											Preco
										</th>
										<th className="px-3 py-2 text-center font-medium text-gray-600">
											Origem
										</th>
										<th className="px-3 py-2 text-right font-medium text-gray-600">
											Custo
										</th>
										<th className="px-3 py-2 text-right font-medium text-gray-600">
											Subtotal
										</th>
									</tr>
								</thead>
								<tbody>
									{produtosFiltrados.map(p => {
										const selecionado = itens.find(
											i => i.modelo_id === p.modelo_id
										);
										return (
											<tr
												key={p.modelo_id}
												className="border-b border-[#B5D4F4] last:border-b-0"
											>
												<td className="px-3 py-2">
													<input
														type="checkbox"
														checked={isSelecionado(p.modelo_id)}
														disabled={loadingPriceId === p.modelo_id}
														onChange={e => {
															void alternarProduto(p, e.target.checked);
														}}
														className="h-4 w-4 rounded border-[#B5D4F4]"
													/>
												</td>
												<td className="px-3 py-2 text-gray-900">
													<p className="font-medium">
														{p.codigo ? `${p.codigo} - ` : ""}
														{p.nome}
													</p>
													{p.estoque_disponivel <= 0 && (
														<span className="inline-block mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700">
															Sem estoque
														</span>
													)}
												</td>
												<td className="px-3 py-2 text-right text-gray-700">
													{p.estoque_disponivel}
												</td>
												<td className="px-3 py-2 text-right">
													{selecionado ? (
														<div className="flex flex-col items-end gap-0.5">
															<input
																type="number"
																min={1}
																value={selecionado.quantidade}
																onChange={e =>
																	atualizarQuantidade(
																		selecionado.modelo_id,
																		parseInt(e.target.value || "1", 10)
																	)
																}
																className={[
																	"w-20 h-9 rounded-md border px-2 text-sm text-right",
																	selecionado.quantidade >
																	selecionado.estoque_disponivel
																		? "border-amber-400 bg-amber-50"
																		: "border-[#B5D4F4]",
																].join(" ")}
															/>
															{selecionado.quantidade >
																selecionado.estoque_disponivel && (
																<span className="text-[10px] text-amber-600 whitespace-nowrap">
																	+
																	{selecionado.quantidade -
																		selecionado.estoque_disponivel}{" "}
																	auto
																</span>
															)}
														</div>
													) : (
														<span className="text-gray-400">-</span>
													)}
												</td>
												<td className="px-3 py-2 text-right">
													{selecionado ? (
														<input
															type="number"
															step="0.01"
															min={0}
															value={selecionado.preco}
															onChange={e =>
																atualizarPrecoManual(
																	selecionado.modelo_id,
																	parseFloat(e.target.value || "0")
																)
															}
															className="w-28 h-9 rounded-md border border-[#B5D4F4] px-2 text-sm text-right"
														/>
													) : (
														<span className="text-gray-400">-</span>
													)}
												</td>
												<td className="px-3 py-2 text-center">
													{selecionado ? (
														<Badge
															variant={
																selecionado.origem === "REVENDEDOR"
																	? "info"
																	: selecionado.origem === "MODELO"
																		? "neutral"
																		: "warning"
															}
														>
															{selecionado.origem === "REVENDEDOR"
																? "Personalizado"
																: selecionado.origem === "MODELO"
																	? "Padrao"
																	: "Manual"}
														</Badge>
													) : (
														<span className="text-gray-400">-</span>
													)}
												</td>
												<td className="px-3 py-2 text-right font-medium text-gray-900">
													{selecionado
														? fmtCurrency(
																selecionado.preco * selecionado.quantidade
															)
														: "-"}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>

						<div className="rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] px-3 py-2 text-sm text-[#0C447C] flex items-center justify-between">
							<span>
								{itens.length} produtos selecionados ({totalUnidades} un.)
								{custoTotalProducao > 0 && (
									<span className="ml-2 text-gray-500">
										· custo {fmtCurrency(custoTotalProducao)}
									</span>
								)}
							</span>
							<strong>{fmtCurrency(total)}</strong>
						</div>

						<div className="flex items-center justify-between gap-2">
							<Button variant="secondary" onClick={() => setStep(1)}>
								Voltar
							</Button>
							<Button onClick={() => setStep(3)} disabled={itens.length === 0}>
								Ir para confirmacao
							</Button>
						</div>
					</div>
				)}

				{step === 3 && (
					<div className="flex flex-col gap-3">
						<div className="rounded-lg border border-[#B5D4F4] bg-[#F4F8FD] p-3 text-sm">
							<p>
								<strong>Revendedor:</strong> {revendedor?.nome}
							</p>
							<p>
								<strong>Produtos selecionados:</strong> {itens.length}
							</p>
							<p>
								<strong>Total de unidades:</strong> {totalUnidades}
							</p>
							<p>
								<strong>Valor total:</strong> {fmtCurrency(total)}
							</p>
							{custoTotalProducao > 0 && (
								<p className="text-gray-500">
									<strong>Custo de produção:</strong>{" "}
									{fmtCurrency(custoTotalProducao)}
								</p>
							)}
						</div>

						{itens.some(i => i.quantidade > i.estoque_disponivel) && (
							<div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
								<p className="font-medium mb-1">
									Entrada de estoque automática
								</p>
								<p className="text-xs mb-1">
									Os itens abaixo excedem o estoque disponível. Uma entrada de
									produção será gerada automaticamente:
								</p>
								<ul className="text-xs space-y-0.5">
									{itens
										.filter(i => i.quantidade > i.estoque_disponivel)
										.map(i => (
											<li key={i.modelo_id}>
												• {i.codigo ? `${i.codigo} - ` : ""}
												{i.nome}:{" "}
												<strong>
													+{i.quantidade - i.estoque_disponivel} un.
												</strong>{" "}
												serão adicionadas ao estoque
											</li>
										))}
								</ul>
							</div>
						)}

						<div className="rounded-lg border border-[#B5D4F4] divide-y divide-[#B5D4F4]">
							{itens.map(item => (
								<div
									key={item.modelo_id}
									className="px-3 py-2 flex items-center justify-between gap-2 text-sm"
								>
									<span className="text-gray-900">
										{item.codigo ? `${item.codigo} - ` : ""}
										{item.nome}
									</span>
									<span className="text-gray-700">
										{item.quantidade} x {fmtCurrency(item.preco)} ={" "}
										<strong>{fmtCurrency(item.quantidade * item.preco)}</strong>
									</span>
								</div>
							))}
						</div>

						<Input
							label="Data do envio"
							type="date"
							value={dataEnvio}
							onChange={e => setDataEnvio(e.target.value)}
						/>

						<div className="flex flex-col gap-1">
							<label className="text-[13px] text-gray-600 font-medium">
								Observacao
							</label>
							<textarea
								rows={3}
								className="w-full rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
								placeholder="Opcional"
								value={observacao}
								onChange={e => setObservacao(e.target.value)}
							/>
						</div>

						<div className="flex items-center justify-between gap-2">
							<Button variant="secondary" onClick={() => setStep(2)}>
								Voltar
							</Button>
							<div className="flex items-center gap-2">
								<Button variant="ghost" onClick={() => setOpenPrint(true)}>
									Imprimir ordem
								</Button>
								<Button onClick={confirmarEnvio} loading={salvando}>
									Confirmar envio
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>

			<Modal
				open={openPrint}
				onClose={() => setOpenPrint(false)}
				title="Ordem de envio"
				footer={
					<>
						<Button variant="ghost" onClick={() => setOpenPrint(false)}>
							Fechar
						</Button>
						<Button onClick={() => window.print()}>Imprimir</Button>
					</>
				}
			>
				<div className="flex flex-col gap-2 text-sm text-gray-700">
					<p>
						<strong>Revendedor:</strong> {revendedor?.nome}
					</p>
					<p>
						<strong>Data:</strong> {fmtDate(dataEnvio)}
					</p>
					<p>
						<strong>Total:</strong> {fmtCurrency(total)} ({totalUnidades} un.)
					</p>
					<div className="rounded-md border border-[#B5D4F4] divide-y divide-[#B5D4F4] mt-2">
						{itens.map(i => (
							<div
								key={i.modelo_id}
								className="px-3 py-2 flex items-center justify-between gap-2"
							>
								<span>{i.nome}</span>
								<span>
									{i.quantidade} x {fmtCurrency(i.preco)}
								</span>
							</div>
						))}
					</div>
				</div>
			</Modal>
		</>
	);
}
