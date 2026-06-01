"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, useToast } from "@/components/ui";
import { confirmarConferenciaRevendedor, salvarPrecoNoCadastro, editarDataEnvio, editarDataConferencia } from "../../actions";
import type { RevendedorResumo } from "../../[envio_id]/ConferenciaForm";

export interface ConferenciaItemMulti {
	envio_item_id: string;
	envio_id: string;
	modelo_id: string;
	modelo_nome: string;
	modelo_codigo: string | null;
	qtd_enviada: number;
	qtd_vendida: number;
	qtd_devolvida: number;
	preco_unitario: number | null;
	valor_minimo_unit: number | null;
}

export interface EnvioComItens {
	envio_id: string;
	data_envio: string;
	itens: ConferenciaItemMulti[];
}

interface ItemMerged {
	modelo_id: string;
	modelo_nome: string;
	modelo_codigo: string | null;
	total_restante: number;
	preco_unitario: number | null;
	valor_minimo_unit: number | null;
	/** envio_items ordered oldest-first (from server) */
	envio_items: ConferenciaItemMulti[];
}

export interface HistoricoEnvio {
	envio_id: string;
	data_envio: string;
	status: "ABERTO" | "CONFERIDO" | "ENCERRADO";
	itens: Array<{
		modelo_nome: string;
		modelo_codigo: string | null;
		qtd_enviada: number;
		qtd_vendida: number;
		qtd_devolvida: number;
	}>;
	acerto_id: string | null;
	acerto_valor: number | null;
	acerto_status: "PENDENTE" | "RECEBIDO" | null;
	data_conferencia: string | null;
}

interface Props {
	readonly revendedor: RevendedorResumo;
	readonly envios: EnvioComItens[];
	readonly historicoEnvios: HistoricoEnvio[];
}

function fmtDate(d: string) {
	return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toNumber(v: string) {
	const n = Number.parseFloat(v.replace(",", "."));
	return Number.isFinite(n) ? n : 0;
}

function clamp(v: number, min: number, max: number) {
	return Math.max(min, Math.min(max, v));
}

function qtdRestante(item: ConferenciaItemMulti) {
	return item.qtd_enviada - item.qtd_vendida - item.qtd_devolvida;
}

/** Aggregate envio_items by modelo_id across all envios. */
function computeMergedItems(envios: EnvioComItens[]): ItemMerged[] {
	const map = new Map<string, ItemMerged>();
	for (const envio of envios) {
		for (const item of envio.itens) {
			if (!map.has(item.modelo_id)) {
				map.set(item.modelo_id, {
					modelo_id: item.modelo_id,
					modelo_nome: item.modelo_nome,
					modelo_codigo: item.modelo_codigo,
					total_restante: 0,
					preco_unitario: item.preco_unitario,
					valor_minimo_unit: item.valor_minimo_unit,
					envio_items: [],
				});
			}
			const m = map.get(item.modelo_id);
			if (!m) continue;
			m.total_restante += qtdRestante(item);
			m.envio_items.push(item);
		}
	}
	return Array.from(map.values());
}

/**
 * Distribute sold/returned/remaining back to individual envio_items oldest-first.
 * Sold drains first, then returned, remaining stays in newest items.
 */
function distribuirQuantidades(
	mergedItems: ItemMerged[],
	contadaState: Record<string, string>,
	devolvidaState: Record<string, string>
): Record<string, { qtdContada: number; qtdDevolvida: number }> {
	const result: Record<string, { qtdContada: number; qtdDevolvida: number }> =
		{};
	for (const m of mergedItems) {
		const contadaTotal = clamp(
			Math.floor(toNumber(contadaState[m.modelo_id] ?? "0")),
			0,
			m.total_restante
		);
		const devolvidaTotal = clamp(
			Math.floor(toNumber(devolvidaState[m.modelo_id] ?? "0")),
			0,
			m.total_restante - contadaTotal
		);
		let vendidaRestante = m.total_restante - contadaTotal - devolvidaTotal;
		let devolvidaRestante = devolvidaTotal;
		for (const item of m.envio_items) {
			const restante = qtdRestante(item);
			const vendidaItem = Math.min(restante, vendidaRestante);
			vendidaRestante -= vendidaItem;
			const devolvidaItem = Math.min(restante - vendidaItem, devolvidaRestante);
			devolvidaRestante -= devolvidaItem;
			result[item.envio_item_id] = {
				qtdContada: restante - vendidaItem - devolvidaItem,
				qtdDevolvida: devolvidaItem,
			};
		}
	}
	return result;
}

export default function ConferenciaRevendedorForm({
	revendedor,
	envios,
	historicoEnvios,
}: Props) {
	const { showToast } = useToast();
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [usarValorManual, setUsarValorManual] = useState(false);
	const [valorManual, setValorManual] = useState("");
	const [dataConferencia, setDataConferencia] = useState(() => new Date().toISOString().slice(0, 10));
	const [editingEnvioId, setEditingEnvioId] = useState<string | null>(null);
	const [editingData, setEditingData] = useState("");
	const [editingConferenciaId, setEditingConferenciaId] = useState<string | null>(null);
	const [editingConferenciaData, setEditingConferenciaData] = useState("");
	const [editingSaving, setEditingSaving] = useState(false);

	async function salvarDataEnvio(envioId: string) {
		if (!editingData) return;
		setEditingSaving(true);
		try {
			await editarDataEnvio(envioId, editingData);
			setEditingEnvioId(null);
			router.refresh();
		} catch {
			showToast("Erro ao salvar data do envio", "error");
		} finally {
			setEditingSaving(false);
		}
	}

	async function salvarDataConferencia(acertoId: string) {
		if (!editingConferenciaData) return;
		setEditingSaving(true);
		try {
			await editarDataConferencia(acertoId, editingConferenciaData);
			setEditingConferenciaId(null);
			router.refresh();
		} catch {
			showToast("Erro ao salvar data da conferência", "error");
		} finally {
			setEditingSaving(false);
		}
	}

	const mergedItems = useMemo(() => computeMergedItems(envios), [envios]);

	const envioDateMap = useMemo(
		() => Object.fromEntries(envios.map(e => [e.envio_id, e.data_envio])),
		[envios]
	);

	// State: modelo_id → "qtd ainda com revendedor"
	const [state, setState] = useState<Record<string, string>>(() =>
		Object.fromEntries(
			computeMergedItems(envios).map(m => [
				m.modelo_id,
				String(m.total_restante),
			])
		)
	);

	// State: modelo_id → "qtd devolvida ao estoque"
	const [devolvidaState, setDevolvidaState] = useState<Record<string, string>>(
		() =>
			Object.fromEntries(
				computeMergedItems(envios).map(m => [m.modelo_id, "0"])
			)
	);

	// State: modelo_id → preço editável (fallback quando não havia preço no envio)
	const [precoState, setPrecoState] = useState<Record<string, string>>(() =>
		Object.fromEntries(
			computeMergedItems(envios).map(m => {
				const preco =
					revendedor.modelo_acerto === "VALOR_MINIMO"
						? (m.valor_minimo_unit ?? 0)
						: (m.preco_unitario ?? 0);
				return [m.modelo_id, preco > 0 ? String(preco) : ""];
			})
		)
	);

	// State: modelo_id → salvar preço no cadastro ao confirmar
	const [salvarPrecoState, setSalvarPrecoState] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(
			computeMergedItems(envios).map(m => {
				const precoOriginal =
					revendedor.modelo_acerto === "VALOR_MINIMO"
						? (m.valor_minimo_unit ?? 0)
						: (m.preco_unitario ?? 0);
				return [m.modelo_id, precoOriginal === 0];
			})
		)
	);

	function setPreco(modeloId: string, value: string) {
		setPrecoState(prev => ({ ...prev, [modeloId]: value }));
	}

	const allFilled = useMemo(
		() =>
			mergedItems
				.filter(m => m.total_restante > 0)
				.every(m => state[m.modelo_id] !== ""),
		[mergedItems, state]
	);

	const resumoGlobal = useMemo(() => {
		let totalVendida = 0;
		let totalContada = 0;
		let totalDevolvida = 0;
		let totalReceberValorMinimo = 0;
		let totalSugeridoComissao = 0;
		const linhas: { nome: string; qtd: number; valor: number; semPreco: boolean }[] = [];

		for (const m of mergedItems) {
			const contada = clamp(
				Math.floor(toNumber(state[m.modelo_id] ?? "0")),
				0,
				m.total_restante
			);
			const devolvida = clamp(
				Math.floor(toNumber(devolvidaState[m.modelo_id] ?? "0")),
				0,
				m.total_restante - contada
			);
			const vendida = m.total_restante - contada - devolvida;
			totalVendida += vendida;
			totalContada += contada;
			totalDevolvida += devolvida;

			const precoUnit = toNumber(precoState[m.modelo_id] ?? "0");
			let valorItem = 0;
			if (revendedor.modelo_acerto === "VALOR_MINIMO") {
				valorItem = vendida * precoUnit;
				totalReceberValorMinimo += valorItem;
			} else {
				valorItem = vendida * precoUnit;
				totalSugeridoComissao += valorItem;
			}

			if (vendida > 0) {
				const nome = m.modelo_codigo
					? `${m.modelo_codigo} - ${m.modelo_nome}`
					: m.modelo_nome;
				linhas.push({ nome, qtd: vendida, valor: valorItem, semPreco: precoUnit === 0 });
			}
		}

		const comissaoTotal =
			revendedor.modelo_acerto === "COMISSAO"
				? (revendedor.comissao_fixa ?? 0) +
				  totalSugeridoComissao * (revendedor.comissao_pct ?? 0)
				: 0;
		const liquidoTotal = totalSugeridoComissao - comissaoTotal;

		return {
			totalVendida,
			totalContada,
			totalDevolvida,
			hasRemanentes: totalContada > 0,
			totalReceberValorMinimo,
			totalSugeridoComissao,
			comissaoTotal,
			liquidoTotal,
			linhas,
		};
	}, [mergedItems, revendedor, state, devolvidaState, precoState]);

	function setQtd(modeloId: string, value: string) {
		setState(prev => ({ ...prev, [modeloId]: value }));
	}

	function setDevolvida(modeloId: string, value: string) {
		setDevolvidaState(prev => ({ ...prev, [modeloId]: value }));
	}

	function buildEnviosInput(
		globalManual: number | undefined,
		perItem: Record<string, { qtdContada: number; qtdDevolvida: number }>,
		precoMap: Record<string, number>
	) {
		// Compute per-envio total using precoMap (user-edited prices take precedence over DB)
		const valorByEnvio: Record<string, number> = {};
		for (const envio of envios) {
			let total = 0;
			for (const item of envio.itens) {
				const dist = perItem[item.envio_item_id] ?? {
					qtdContada: qtdRestante(item),
					qtdDevolvida: 0,
				};
				const vendidaItem = qtdRestante(item) - dist.qtdContada - dist.qtdDevolvida;
				const preco = precoMap[item.modelo_id] ?? (item.preco_unitario ?? 0);
				total += vendidaItem * preco;
			}
			valorByEnvio[envio.envio_id] = total;
		}
		const totalComissao = Object.values(valorByEnvio).reduce((a, b) => a + b, 0);

		return envios.map((envio, idx) => {
			const itens = envio.itens.map(item => {
				const dist = perItem[item.envio_item_id] ?? {
					qtdContada: qtdRestante(item),
					qtdDevolvida: 0,
				};
				const vendidaItem = qtdRestante(item) - dist.qtdContada - dist.qtdDevolvida;
				const preco = precoMap[item.modelo_id] ?? (item.preco_unitario ?? 0);
				const valorVenda = vendidaItem * preco;
				return {
					envioItemId: item.envio_item_id,
					qtdContada: dist.qtdContada,
					qtdDevolvida: dist.qtdDevolvida,
					precoCliente: null,
					valorVenda: valorVenda > 0 ? valorVenda : undefined,
				};
			});

			let valorManualEnvio: number | undefined;
			const baseTotal = globalManual ?? totalComissao;
			if (totalComissao > 0) {
				valorManualEnvio = Number(
					(baseTotal * ((valorByEnvio[envio.envio_id] ?? 0) / totalComissao)).toFixed(2)
				);
			} else if (idx === 0) {
				valorManualEnvio = baseTotal;
			}

			return { envioId: envio.envio_id, itens, valorManual: valorManualEnvio };
		});
	}

	async function onConfirmar() {
		if (!allFilled) {
			showToast("Preencha todas as quantidades", "error");
			return;
		}
		if (resumoGlobal.totalVendida === 0 && resumoGlobal.totalDevolvida === 0) {
			showToast("Informe ao menos uma venda ou devolucao", "error");
			return;
		}

		const globalManual =
			revendedor.modelo_acerto === "COMISSAO" && usarValorManual
				? Math.max(0, toNumber(valorManual))
				: undefined;

		const perItem = distribuirQuantidades(mergedItems, state, devolvidaState);
		const precoMap = Object.fromEntries(
			mergedItems.map(m => [m.modelo_id, toNumber(precoState[m.modelo_id] ?? "0")])
		);
		const enviosInput = buildEnviosInput(globalManual, perItem, precoMap);

		const itensSalvar = mergedItems
			.filter(m => salvarPrecoState[m.modelo_id] && toNumber(precoState[m.modelo_id] ?? "0") > 0)
			.map(m => ({
				modelo_id: m.modelo_id,
				revendedor_id: revendedor.revendedor_id,
				preco: toNumber(precoState[m.modelo_id] ?? "0"),
				tipo: revendedor.modelo_acerto,
			}));

		setSaving(true);
		try {
			await confirmarConferenciaRevendedor(
				revendedor.revendedor_id,
				enviosInput,
				dataConferencia || undefined
			);
			if (itensSalvar.length > 0) {
				await salvarPrecoNoCadastro(itensSalvar);
			}
			const valorFinal =
				revendedor.modelo_acerto === "VALOR_MINIMO"
					? resumoGlobal.totalReceberValorMinimo
					: (globalManual ?? resumoGlobal.totalSugeridoComissao);
			const isPureReturn =
				resumoGlobal.totalVendida === 0 && resumoGlobal.totalDevolvida > 0;
			let toastMsg: string;
			if (isPureReturn) {
				toastMsg = `${resumoGlobal.totalDevolvida} un. devolvidas ao estoque`;
			} else if (resumoGlobal.hasRemanentes) {
				toastMsg = `Conferencia parcial salva — ${resumoGlobal.totalVendida} un. vendidas`;
			} else {
				toastMsg = `Conferencia concluida — ${fmtCurrency(valorFinal)} a receber de ${revendedor.nome}`;
			}
			showToast(toastMsg, "success");
			router.push("/conferencias");
			router.refresh();
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao confirmar conferencia",
				"error"
			);
		} finally {
			setSaving(false);
		}
	}

	const itensPendentes = mergedItems.filter(m => m.total_restante > 0);

	return (
		<div className="flex flex-col gap-4">
			{/* Header */}
			<header className="sticky top-0 z-10 bg-[#F4F8FD] pb-2">
				<div className="rounded-xl border border-[#B5D4F4] bg-white px-4 py-3 flex items-center justify-between gap-3">
					<div>
						<p className="text-sm font-semibold text-gray-900">
							{revendedor.nome}
						</p>
						<p className="text-xs text-gray-700">
							{envios.length === 1 ? "1 envio" : `${envios.length} envios`} em
							aberto
							{" · "}
							{itensPendentes.length} produto(s)
						</p>
					</div>
					<Badge
						variant={
							revendedor.modelo_acerto === "VALOR_MINIMO" ? "success" : "info"
						}
					>
						{revendedor.modelo_acerto === "VALOR_MINIMO"
							? "Valor por produto"
							: "Comissao"}
					</Badge>
				</div>
			</header>

			{/* Estoque atual com o revendedor */}
			<div className="rounded-xl border border-[#B5D4F4] bg-white overflow-hidden">
				<div className="px-4 py-2.5 bg-[#F4F8FD] border-b border-[#B5D4F4] flex items-center justify-between">
					<p className="text-xs font-semibold text-[#0C447C] uppercase tracking-wide">Em consignação agora</p>
					<span className="text-xs text-gray-500">
						{itensPendentes.reduce((s, m) => s + m.total_restante, 0)} un. · {itensPendentes.length} produto(s)
					</span>
				</div>
				<div className="divide-y divide-[#E6F1FB]">
					{itensPendentes.map(m => {
						const fontes = m.envio_items.filter(i => qtdRestante(i) > 0);
						return (
							<div key={m.modelo_id} className="px-4 py-3">
								<div className="flex items-center justify-between gap-2">
									<span className="text-sm text-gray-900 font-medium truncate">
										{m.modelo_codigo && <span className="text-gray-400 font-normal mr-1">{m.modelo_codigo} —</span>}
										{m.modelo_nome}
									</span>
									<span className="text-sm font-bold text-[#185FA5] shrink-0">{m.total_restante} un.</span>
								</div>
								{fontes.length > 1 && (
									<div className="mt-1 flex flex-wrap gap-1">
										{fontes.map(i => (
											<span key={i.envio_item_id} className="text-xs bg-[#E6F1FB] text-[#185FA5] rounded px-2 py-0.5">
												env. {fmtDate(envioDateMap[i.envio_id] ?? "")} — {qtdRestante(i)} un.
											</span>
										))}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* One card per merged model */}
			{itensPendentes.map(m => {
				const qtd = state[m.modelo_id] ?? "";
				const devolvidaStr = devolvidaState[m.modelo_id] ?? "0";
				const contada =
					qtd === ""
						? 0
						: clamp(Math.floor(toNumber(qtd)), 0, m.total_restante);
				const devolvida = clamp(
					Math.floor(toNumber(devolvidaStr)),
					0,
					m.total_restante - contada
				);
				const vendida = m.total_restante - contada - devolvida;

				return (
					<div
						key={m.modelo_id}
						className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3"
					>
						<div>
							<p className="text-sm font-semibold text-gray-900">
								{m.modelo_codigo ? `${m.modelo_codigo} - ` : ""}
								{m.modelo_nome}
							</p>
							<p className="text-xs text-gray-500 mt-0.5">
								{m.total_restante} un. para conferir
								{m.envio_items.length > 1 && ` · ${m.envio_items.length} envios`}
							</p>
						</div>

						{toNumber(precoState[m.modelo_id] ?? "0") === 0 && (
							<p className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
								Preço não registrado no envio — informe abaixo para calcular o valor
							</p>
						)}

						<div className="grid grid-cols-2 gap-3">
							<Input
								id={`qtd-${m.modelo_id}`}
								label="Ainda com revendedor"
								type="number"
								placeholder="0"
								min={0}
								max={m.total_restante}
								step={1}
								value={qtd}
								onChange={e => setQtd(m.modelo_id, e.target.value)}
								onBlur={e => {
									if (e.target.value === "") return;
									setQtd(
										m.modelo_id,
										String(
											clamp(
												Math.floor(toNumber(e.target.value)),
												0,
												m.total_restante
											)
										)
									);
								}}
							/>
							<Input
								id={`dev-${m.modelo_id}`}
								label="Devolver ao estoque"
								type="number"
								placeholder="0"
								min={0}
								max={m.total_restante - contada}
								step={1}
								value={devolvidaStr}
								onChange={e => setDevolvida(m.modelo_id, e.target.value)}
								onBlur={e => {
									const v =
										e.target.value === ""
											? 0
											: Math.floor(toNumber(e.target.value));
									setDevolvida(
										m.modelo_id,
										String(clamp(v, 0, m.total_restante - contada))
									);
								}}
							/>
							<div className="rounded-md border border-[#B5D4F4] bg-[#F4F8FD] px-3 py-2 flex flex-col justify-center">
								<span className="text-xs text-gray-700">Vendido</span>
								<span className="text-lg font-semibold text-[#185FA5]">
									{vendida} un.
								</span>
							</div>
							<Input
								id={`preco-${m.modelo_id}`}
								label={revendedor.modelo_acerto === "VALOR_MINIMO" ? "Valor mínimo / un." : "Preço / un."}
								type="number"
								step="0.01"
								min={0}
								placeholder="0,00"
								value={precoState[m.modelo_id] ?? ""}
								onChange={e => setPreco(m.modelo_id, e.target.value)}
								onBlur={e => {
									if (e.target.value !== "" && toNumber(e.target.value) < 0)
										setPreco(m.modelo_id, "0");
								}}
							/>
						</div>

						{toNumber(precoState[m.modelo_id] ?? "0") > 0 && (
							<label className="flex items-center gap-2 cursor-pointer select-none">
								<input
									type="checkbox"
									checked={salvarPrecoState[m.modelo_id] ?? false}
									onChange={e =>
										setSalvarPrecoState(prev => ({
											...prev,
											[m.modelo_id]: e.target.checked,
										}))
									}
									className="w-4 h-4 rounded border-[#B5D4F4] accent-[#185FA5]"
								/>
								<span className="text-xs text-gray-600">Salvar preço no cadastro</span>
							</label>
						)}
					</div>
				);
			})}

			{/* Tabela em tempo real */}
			{resumoGlobal.linhas.length > 0 && (
				<div className="rounded-xl border border-[#B5D4F4] bg-white overflow-hidden">
					<div className="px-4 py-2 bg-[#F4F8FD] border-b border-[#B5D4F4]">
						<p className="text-xs font-semibold text-[#0C447C] uppercase tracking-wide">Vendidos</p>
					</div>
					<div className="text-xs">
						{resumoGlobal.linhas.map(l => (
							<div key={l.nome} className="flex items-center justify-between px-4 py-2.5 border-b border-[#E6F1FB]">
								<span className="text-gray-800 flex-1 truncate">{l.nome}</span>
								<span className="text-gray-500 mx-3">{l.qtd} un.</span>
								<span className="font-medium text-[#185FA5]">{fmtCurrency(l.valor)}</span>
							</div>
						))}
						{revendedor.modelo_acerto === "COMISSAO" ? (
							<>
								<div className="flex items-center justify-between px-4 py-2 bg-[#F4F8FD]">
									<span className="text-gray-600">Total vendas</span>
									<span className="mx-3 text-gray-500">{resumoGlobal.totalVendida} un.</span>
									<span className="font-medium text-gray-800">{fmtCurrency(resumoGlobal.totalSugeridoComissao)}</span>
								</div>
								<div className="flex items-center justify-between px-4 py-2 bg-[#F4F8FD] border-t border-[#E6F1FB]">
									<span className="text-gray-600">Comissão</span>
									<span className="mx-3" />
									<span className="text-amber-700">− {fmtCurrency(resumoGlobal.comissaoTotal)}</span>
								</div>
								<div className="flex items-center justify-between px-4 py-2.5 bg-[#E6F1FB] font-semibold text-[#0C447C] border-t border-[#B5D4F4]">
									<span>Líquido a receber</span>
									<span className="mx-3" />
									<span>{fmtCurrency(resumoGlobal.liquidoTotal)}</span>
								</div>
							</>
						) : (
							<div className="flex items-center justify-between px-4 py-2.5 bg-[#E6F1FB] font-semibold text-[#0C447C]">
								<span>Total a receber</span>
								<span className="mx-3">{resumoGlobal.totalVendida} un.</span>
								<span>{fmtCurrency(resumoGlobal.totalReceberValorMinimo)}</span>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Confirmation panel — VALOR_MINIMO */}
			{allFilled && revendedor.modelo_acerto === "VALOR_MINIMO" && (
				<div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-4 flex flex-col gap-2">
					<p className="text-sm text-[#0C447C]">
						A receber nesta conferencia:{" "}
						<strong>{fmtCurrency(resumoGlobal.totalReceberValorMinimo)}</strong>
					</p>
					<p className="text-xs text-[#185FA5]">
						{resumoGlobal.totalVendida} un. vendidas.
						{resumoGlobal.totalDevolvida > 0 &&
							` · ${resumoGlobal.totalDevolvida} un. devolvidas.`}
						{resumoGlobal.hasRemanentes &&
							` · ${resumoGlobal.totalContada} un. ainda com o revendedor.`}
					</p>
					<Input
						label="Data da conferência"
						type="date"
						value={dataConferencia}
						onChange={e => setDataConferencia(e.target.value)}
					/>
					<Button onClick={onConfirmar} loading={saving}>
						{resumoGlobal.hasRemanentes
							? "Registrar conferencia parcial"
							: "Finalizar conferencia"}
					</Button>
				</div>
			)}

			{/* Confirmation panel — COMISSAO */}
			{allFilled && revendedor.modelo_acerto === "COMISSAO" && (
				<div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-4 flex flex-col gap-3">
					<p className="text-sm text-[#0C447C]">
						Valor sugerido nesta conferencia:{" "}
						<strong>{fmtCurrency(resumoGlobal.totalSugeridoComissao)}</strong>
					</p>
					{resumoGlobal.hasRemanentes && (
						<p className="text-xs text-[#185FA5]">
							{resumoGlobal.totalContada} un. ainda com o revendedor.
						</p>
					)}
					<Input
						label="Data da conferência"
						type="date"
						value={dataConferencia}
						onChange={e => setDataConferencia(e.target.value)}
					/>
					<Button variant="ghost" onClick={() => setUsarValorManual(v => !v)}>
						{usarValorManual
							? "Usar valor calculado"
							: "Informar valor manualmente"}
					</Button>
					{usarValorManual && (
						<Input
							label="Valor manual total"
							type="number"
							step="0.01"
							min={0}
							placeholder="0,00"
							value={valorManual}
							onChange={e => setValorManual(e.target.value)}
							onBlur={e => {
								if (e.target.value !== "" && toNumber(e.target.value) < 0)
									setValorManual("0");
							}}
						/>
					)}
					<Button onClick={onConfirmar} loading={saving}>
						{resumoGlobal.hasRemanentes
							? "Registrar conferencia parcial"
							: "Confirmar conferencia"}
					</Button>
				</div>
			)}

			{/* Histórico de envios */}
			{historicoEnvios.length > 0 && (
				<div className="flex flex-col gap-3 pt-2">
					<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
						Histórico de envios
					</p>
					{historicoEnvios.map(e => {
						const totalEnviado = e.itens.reduce((s, i) => s + i.qtd_enviada, 0);
						const totalVendido = e.itens.reduce((s, i) => s + i.qtd_vendida, 0);
						const totalDevolvido = e.itens.reduce((s, i) => s + i.qtd_devolvida, 0);
						const totalRestante = totalEnviado - totalVendido - totalDevolvido;
						const statusMap = {
							ABERTO: { variant: "warning" as const, label: "Em aberto" },
							CONFERIDO: { variant: "info" as const, label: "Acerto pendente" },
							ENCERRADO: { variant: "success" as const, label: "Encerrado" },
						};
						const { variant, label } = statusMap[e.status] ?? { variant: "info" as const, label: e.status };
						const isEditingEnvio = editingEnvioId === e.envio_id;
						const isEditingConf = editingConferenciaId === e.acerto_id;
						return (
							<div key={e.envio_id} className="rounded-xl border border-[#B5D4F4] bg-white overflow-hidden">
								{/* Header do envio */}
								<div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b border-[#E6F1FB]">
									{isEditingEnvio ? (
										<div className="flex items-center gap-2 flex-1">
											<input
												type="date"
												value={editingData}
												onChange={ev => setEditingData(ev.target.value)}
												className="rounded border border-[#B5D4F4] px-2 py-1 text-sm focus:outline-none focus:border-[#185FA5]"
											/>
											<button type="button" onClick={() => salvarDataEnvio(e.envio_id)} disabled={editingSaving} className="text-xs text-[#185FA5] hover:underline disabled:opacity-50">Salvar</button>
											<button type="button" onClick={() => setEditingEnvioId(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
										</div>
									) : (
										<div className="flex items-center gap-2">
											<p className="text-sm font-semibold text-gray-900">Envio de {fmtDate(e.data_envio)}</p>
											<button type="button" onClick={() => { setEditingEnvioId(e.envio_id); setEditingData(e.data_envio); }} className="text-xs text-gray-400 hover:text-[#185FA5]">Editar</button>
										</div>
									)}
									<Badge variant={variant}>{label}</Badge>
								</div>

								{/* Itens */}
								<div className="divide-y divide-[#E6F1FB]">
									{e.itens.map(i => {
										const restante = i.qtd_enviada - i.qtd_vendida - i.qtd_devolvida;
										return (
											<div key={`${e.envio_id}-${i.modelo_nome}`} className="px-4 py-2 flex items-start justify-between gap-3 text-xs">
												<span className="text-gray-700 truncate">
													{i.modelo_codigo ? `${i.modelo_codigo} — ` : ""}{i.modelo_nome}
												</span>
												<span className="text-right text-gray-500 shrink-0 whitespace-nowrap">
													{i.qtd_enviada} env.
													{i.qtd_vendida > 0 && <> · <span className="text-gray-800">{i.qtd_vendida} vend.</span></>}
													{i.qtd_devolvida > 0 && <> · {i.qtd_devolvida} dev.</>}
													{restante > 0 && <> · <span className="text-[#185FA5] font-semibold">{restante} restam</span></>}
												</span>
											</div>
										);
									})}
								</div>

								{/* Rodapé de totais */}
								<div className="px-4 py-2.5 bg-[#F4F8FD] border-t border-[#B5D4F4] flex items-center justify-between text-xs text-gray-600">
									<span>
										{totalVendido > 0 && `${totalVendido} vendidos`}
										{totalDevolvido > 0 && ` · ${totalDevolvido} devolvidos`}
										{totalVendido === 0 && totalDevolvido === 0 && `${totalEnviado} enviados`}
									</span>
									{totalRestante > 0
										? <span className="font-semibold text-[#185FA5]">{totalRestante} com revendedor</span>
										: <span className="text-green-700 font-medium">Todos conferidos</span>
									}
								</div>

								{/* Data da conferência */}
								{e.acerto_id && (
									<div className="px-4 py-2 border-t border-[#E6F1FB] flex items-center justify-between text-xs">
										<span className="text-gray-500">Data da conferência</span>
										{isEditingConf ? (
											<div className="flex items-center gap-2">
												<input
													type="date"
													value={editingConferenciaData}
													onChange={ev => setEditingConferenciaData(ev.target.value)}
													className="rounded border border-[#B5D4F4] px-2 py-1 text-xs focus:outline-none focus:border-[#185FA5]"
												/>
												<button type="button" onClick={() => salvarDataConferencia(e.acerto_id!)} disabled={editingSaving} className="text-[#185FA5] hover:underline disabled:opacity-50">Salvar</button>
												<button type="button" onClick={() => setEditingConferenciaId(null)} className="text-gray-400 hover:underline">Cancelar</button>
											</div>
										) : (
											<div className="flex items-center gap-2">
												<span className="font-medium text-gray-800">
													{e.data_conferencia ? fmtDate(e.data_conferencia) : <span className="text-gray-400 italic">não registrada</span>}
												</span>
												<button type="button" onClick={() => { setEditingConferenciaId(e.acerto_id); setEditingConferenciaData(e.data_conferencia ?? new Date().toISOString().slice(0, 10)); }} className="text-gray-400 hover:text-[#185FA5]">Editar</button>
											</div>
										)}
									</div>
								)}

								{/* Valor do acerto */}
								{e.acerto_valor !== null && (
									<div className="px-4 py-2 border-t border-[#E6F1FB] flex items-center justify-between text-xs">
										<span className="text-gray-500">
											{e.acerto_status === "RECEBIDO" ? "Valor recebido" : "Valor a receber"}
										</span>
										<span className={`font-semibold ${e.acerto_status === "RECEBIDO" ? "text-green-700" : "text-[#0C447C]"}`}>
											{fmtCurrency(e.acerto_valor)}
										</span>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
